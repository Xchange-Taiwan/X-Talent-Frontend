import type { Session } from 'next-auth';

import { trackEvent } from '@/lib/analytics';
import { getPendingFavoriteProfilePath } from '@/lib/favorites';
import {
  applyIdentityPatch,
  type IdentitySnapshot,
  reconcileIdentityWithBackend,
} from '@/lib/identity/identityProjection';
import { mentorPoolReadModel } from '@/lib/mentor/mentorPoolReadModel';
import { captureFlowFailure } from '@/lib/monitoring';
import {
  CONVERGENCE_BUDGET,
  FAST_CONVERGENCE_BUDGET,
  type FetchProfileRecordFn,
  ProfileRecordAdapter,
  runConvergence,
  type SearchMentorsFn,
} from '@/lib/profile/convergence';
import {
  type MenteeOnboardingIntentValues,
  planProfileMutation,
  type PlanProfileMutationContext,
  type ProfileMutationIntent,
  type ProfileMutationPlan,
} from '@/lib/profile/planProfileMutation';
import { confirmProfileSynced } from '@/lib/profile/pollUntilSynced';
import { profileReadModel } from '@/lib/profile/profileReadModel';
import type { ProfileDirtyFields } from '@/lib/profile/profileSaveAdapter';
import type { ProfileFormValues } from '@/schemas/profileSchema';
import type { AvatarUploadSession } from '@/services/profile/avatarUploadSession';
import { updateAvatar } from '@/services/profile/updateAvatar';
import {
  type MentorProfileWritePayload,
  updateProfile,
} from '@/services/profile/updateProfile';
import type { IndustryOption } from '@/types/tagCatalog';
import type { MentorProfileVO } from '@/types/user';

export {
  type MenteeOnboardingIntentValues,
  planProfileMutation,
  type PlanProfileMutationContext,
  type ProfileMutationIntent,
  type ProfileMutationPlan,
};

const DEFAULT_FAST_FETCH_TIMEOUT_MS = 800;

export type ProfileMutationFailureStep = 'avatar_upload' | 'profile_write';

/**
 * Custom error subclass marking errors that have already been explicitly logged
 * via `captureFlowFailure` inside `commitProfileMutation`, preventing
 * double-reporting by outer hooks and surfacing the named failure `step`.
 */
export class LoggedError extends Error {
  readonly step?: ProfileMutationFailureStep;

  constructor(
    message?: string,
    options?: { cause?: unknown; step?: ProfileMutationFailureStep }
  ) {
    super(message, options);
    this.name = 'LoggedError';
    this.step = options?.step;
    Object.setPrototypeOf(this, LoggedError.prototype);
  }
}

export interface SaveProfileConvergenceBudget {
  fastFetchTimeoutMs?: number;
  profileMaxRetries?: number;
  profileIntervalMs?: number;
  searchIndexMaxRetries?: number;
  searchIndexIntervalMs?: number;
}

export interface CommitProfileContext {
  pageUserId?: string;
  session?: Session | null;
  industryCatalog?: readonly IndustryOption[];
  convergenceBudget?: SaveProfileConvergenceBudget;
  navigationTarget?: string;
}

export interface SaveProfileContext {
  pageUserId: string;
  isMentorOnboarding: boolean;
  session?: Session | null;
  dirtyFields?: ProfileDirtyFields;
  currentDto?: MentorProfileVO | null;
  industryCatalog?: readonly IndustryOption[];
  convergenceBudget?: SaveProfileConvergenceBudget;
}

export type AvatarMutationSession = Pick<
  AvatarUploadSession,
  'resolve' | 'markCommitted'
> &
  Partial<Pick<AvatarUploadSession, 'abort' | 'rollback'>>;

export interface ProfileSavePort {
  avatarSession?: AvatarMutationSession;
  uploadAvatar?: (
    file: File,
    userId: number | undefined
  ) => Promise<string | undefined>;
  writeProfile?: (
    pageUserId: string,
    payload: MentorProfileWritePayload
  ) => Promise<void>;
  fetchProfile?: FetchProfileRecordFn;
  searchMentors?: SearchMentorsFn;
  updateSession: (data: unknown) => Promise<Session | null>;
  revalidateProfilePath: (pageUserId: string) => Promise<void>;
  navigate: (path: string) => void;
}

export type SaveProfileAdapters = ProfileSavePort;

export interface SaveProfileDeps extends SaveProfileContext, ProfileSavePort {}

async function fastSyncProfileRecord(
  userId: number,
  expectedDto: Partial<MentorProfileVO>,
  timeoutMs: number,
  fetchProfileFn?: FetchProfileRecordFn,
  language = 'zh_TW'
): Promise<MentorProfileVO | null> {
  if (!userId || Number.isNaN(userId)) return null;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });

  const adapter = new ProfileRecordAdapter(
    userId,
    expectedDto,
    fetchProfileFn,
    language
  );

  const fetchPromise = adapter
    .fetch()
    .then((latest) => {
      if (latest && adapter.isCaughtUp(latest)) return latest;
      return null;
    })
    .catch(() => null);

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Shared profile write pipeline across `edit`, `mentor-onboarding`, and
 * `mentee-onboarding` modes:
 * 1. Resolves any pending `avatarFile` via two-phase `AvatarUploadSession` (retaining
 *    prior S3 avatar snapshot until Step 2 commits) or `uploadAvatar` fallback
 * 2. Plans the mutation in a single pass via `planProfileMutation`, writes
 *    `PUT /v1/mentors/{id}/profile`, and commits the avatar session only on success
 * 3. Invalidates `mentorPoolReadModel` and triggers ISR + `updateTag` revalidation
 * 4. Applies synchronous optimistic `MentorProfileVO` priming + NextAuth session patch
 * 5. Navigates immediately to target route
 * 6. Runs background full-field convergence (`ProfileRecordAdapter` + mentor search index)
 */
export async function commitProfileMutation(
  intent: ProfileMutationIntent,
  context: CommitProfileContext,
  port: ProfileSavePort
): Promise<MentorProfileVO> {
  const {
    session = null,
    industryCatalog,
    convergenceBudget,
    navigationTarget,
  } = context;
  const {
    avatarSession,
    uploadAvatar: uploadAvatarPort,
    writeProfile: writeProfilePort,
    fetchProfile: fetchProfilePort,
    searchMentors: searchMentorsPort,
    updateSession,
    revalidateProfilePath,
    navigate,
  } = port;

  const sessionUser = session?.user;
  const resolvedPageUserId = context.pageUserId ?? sessionUser?.id ?? '';
  const sessionUserId = sessionUser?.id ? Number(sessionUser.id) : null;
  const validSessionUserId =
    sessionUserId !== null && !Number.isNaN(sessionUserId)
      ? sessionUserId
      : null;
  const resolvedUserId = validSessionUserId ?? Number(resolvedPageUserId);
  const hasValidResolvedUserId =
    Boolean(resolvedUserId) && !Number.isNaN(resolvedUserId);

  const fastFetchTimeoutMs =
    convergenceBudget?.fastFetchTimeoutMs ?? DEFAULT_FAST_FETCH_TIMEOUT_MS;
  const profileMaxRetries =
    convergenceBudget?.profileMaxRetries ?? CONVERGENCE_BUDGET.maxRetries;
  const profileIntervalMs =
    convergenceBudget?.profileIntervalMs ?? CONVERGENCE_BUDGET.intervalMs;
  const searchIndexMaxRetries =
    convergenceBudget?.searchIndexMaxRetries ??
    FAST_CONVERGENCE_BUDGET.maxRetries;
  const searchIndexIntervalMs =
    convergenceBudget?.searchIndexIntervalMs ??
    FAST_CONVERGENCE_BUDGET.intervalMs;

  // Step 1: Resolve Avatar (Phase 1 — retains pre-edit S3 snapshot until Step 2 succeeds)
  async function step1ResolveAvatar(): Promise<string | undefined> {
    if (!intent.values.avatarFile) {
      return undefined;
    }

    try {
      const uploadTargetUserId =
        validSessionUserId ??
        (hasValidResolvedUserId ? resolvedUserId : undefined);
      if (avatarSession) {
        return await avatarSession.resolve(intent.values.avatarFile);
      }
      if (uploadAvatarPort) {
        return await uploadAvatarPort(
          intent.values.avatarFile,
          uploadTargetUserId
        );
      }
      return await updateAvatar(intent.values.avatarFile, uploadTargetUserId);
    } catch (err) {
      avatarSession?.abort?.();
      captureFlowFailure({
        flow: 'profile_update',
        step: 'avatar_upload',
        message: err instanceof Error ? err.message : 'Avatar upload failed',
        level: 'warning',
      });
      throw new LoggedError(
        err instanceof Error ? err.message : 'Avatar upload failed',
        { cause: err, step: 'avatar_upload' }
      );
    }
  }

  // Step 2: Write Profile & Commit Two-Phase Avatar Session
  async function step2WriteProfile(plan: ProfileMutationPlan): Promise<void> {
    try {
      if (plan.shouldWriteProfile) {
        const writeFn = writeProfilePort ?? updateProfile;
        await writeFn(plan.resolvedPageUserId, plan.wirePayload);
      }
      avatarSession?.markCommitted();
    } catch (err) {
      captureFlowFailure({
        flow: 'profile_update',
        step: 'profile_write',
        message: err instanceof Error ? err.message : 'Profile write failed',
      });
      throw new LoggedError(
        err instanceof Error ? err.message : 'Profile write failed',
        { cause: err, step: 'profile_write' }
      );
    }
  }

  // Step 3: Cache Invalidation & Server Path Revalidation
  // Note: Do NOT call `profileReadModel.invalidateUser(resolvedUserId)` before
  // priming the optimistic DTO — synchronously clearing the active user's DTO
  // while `EditProfileContainer` is still mounted and awaiting async server
  // revalidation causes `useUserProfileDto` to emit `USER_NOT_FOUND` and
  // briefly flash "載入失敗，請稍後再試。" before navigation completes.
  async function step3RevalidateServerPaths(targetPageUserId: string) {
    mentorPoolReadModel.invalidateAfterMutation();

    if (targetPageUserId) {
      await revalidateProfilePath(targetPageUserId).catch((e) => {
        console.error('revalidateProfilePath failed:', e);
      });
    }
  }

  function buildSessionIdentityUpdater(): (
    snapshot: IdentitySnapshot
  ) => Promise<Session | null> {
    return (snapshot: IdentitySnapshot) =>
      updateSession({
        user: {
          id: sessionUser?.id,
          name: snapshot.name,
          avatar: snapshot.avatar,
          avatarUpdatedAt: snapshot.avatarUpdatedAt,
          isMentor: snapshot.isMentor,
          onBoarding: snapshot.onBoarding,
          msg: sessionUser?.msg,
          personalLinks: snapshot.personalLinks,
          jobTitle: snapshot.jobTitle ?? '',
          company: snapshot.company ?? '',
        },
      });
  }

  // Step 4: Apply the optimistic identity snapshot & prime profileReadModel
  async function step4ApplyOptimisticIdentity(
    plan: ProfileMutationPlan,
    updateSessionIdentity: (
      snapshot: IdentitySnapshot
    ) => Promise<Session | null>
  ): Promise<MentorProfileVO> {
    if (plan.hasValidResolvedUserId) {
      // Evict alternate language cache entries while immediately priming the
      // active language synchronously so active subscribers never observe a
      // null DTO gap during revalidation / session sync.
      for (const altLang of ['zh_TW', 'en_US']) {
        if (altLang !== plan.resolvedLanguage) {
          profileReadModel.evict({
            userId: plan.resolvedUserId,
            language: altLang,
          });
        }
      }
      profileReadModel.prime(
        { userId: plan.resolvedUserId, language: plan.resolvedLanguage },
        plan.optimisticDto
      );
    }

    await step3RevalidateServerPaths(plan.resolvedPageUserId);

    await applyIdentityPatch(plan.identitySnapshot, {
      primeProfileDto: () => {
        if (plan.hasValidResolvedUserId) {
          profileReadModel.prime(
            { userId: plan.resolvedUserId, language: plan.resolvedLanguage },
            plan.optimisticDto
          );
        }
      },
      updateSession: updateSessionIdentity,
    });

    return plan.optimisticDto;
  }

  // Step 5: Immediate Navigation
  function step5ImmediateNavigation(plan: ProfileMutationPlan) {
    if (intent.mode === 'mentee-onboarding') {
      trackEvent({ name: 'onboarding_completed', feature: 'onboarding' });
      const target =
        navigationTarget ?? getPendingFavoriteProfilePath() ?? '/profile/card';
      navigate(target);
      return;
    }

    trackEvent({ name: 'profile_update_submitted', feature: 'profile' });
    if (navigationTarget) {
      navigate(navigationTarget);
    } else if (plan.isMentorOnboarding) {
      navigate('/profile/card');
    } else {
      navigate(`/profile/${plan.resolvedPageUserId}`);
    }
  }

  // Step 6: Background Prime & Reconcile
  function step6BackgroundReconcile(
    plan: ProfileMutationPlan,
    updateSessionIdentity: (
      snapshot: IdentitySnapshot
    ) => Promise<Session | null>
  ) {
    void (async () => {
      try {
        let latest: MentorProfileVO | null = null;
        if (plan.validSessionUserId) {
          latest = await fastSyncProfileRecord(
            plan.validSessionUserId,
            plan.expectedRecordDto,
            fastFetchTimeoutMs,
            fetchProfilePort,
            plan.resolvedLanguage
          );
          if (latest) {
            profileReadModel.prime(
              {
                userId: plan.validSessionUserId,
                language: plan.resolvedLanguage,
              },
              latest
            );
          }
        }
        if (!latest && plan.hasValidResolvedUserId) {
          const recordAdapter = new ProfileRecordAdapter(
            plan.resolvedUserId,
            plan.expectedRecordDto,
            fetchProfilePort,
            plan.resolvedLanguage
          );
          const { confirmed, latest: polled } = await runConvergence(
            recordAdapter,
            profileMaxRetries,
            profileIntervalMs
          );
          latest = polled;
          if (confirmed && polled) {
            profileReadModel.prime(
              { userId: plan.resolvedUserId, language: plan.resolvedLanguage },
              polled
            );
          }
        }

        await reconcileIdentityWithBackend(plan.identitySnapshot, latest, {
          updateSession: updateSessionIdentity,
        });

        const isMentorRelevant =
          intent.mode === 'mentee-onboarding'
            ? false
            : plan.isMentorOnboarding ||
              Boolean(sessionUser?.isMentor) ||
              Boolean(latest?.is_mentor);

        await confirmProfileSynced(
          plan.resolvedUserId,
          plan.cardFields,
          isMentorRelevant,
          async () => {
            mentorPoolReadModel.invalidateAfterMutation();
            if (plan.resolvedPageUserId) {
              await revalidateProfilePath(plan.resolvedPageUserId).catch(
                (e: unknown) => {
                  captureFlowFailure({
                    flow: 'profile_update',
                    step: 'post_sync_revalidate',
                    message: e instanceof Error ? e.message : String(e),
                    level: 'warning',
                  });
                }
              );
            }
          },
          {
            maxRetries: searchIndexMaxRetries,
            intervalMs: searchIndexIntervalMs,
            searchMentors: searchMentorsPort,
          }
        );
      } catch (e) {
        captureFlowFailure({
          flow: 'profile_update',
          step: 'background_reconcile',
          message: String(e),
        });
      }
    })();
  }

  // Enforce the execution order of the six steps structurally
  const uploadedAvatarUrl = await step1ResolveAvatar();
  const plan = planProfileMutation(intent, {
    pageUserId: context.pageUserId,
    session,
    industryCatalog,
    uploadedAvatarUrl,
  });
  await step2WriteProfile(plan);

  const updateSessionIdentity = buildSessionIdentityUpdater();
  const optimisticDto = await step4ApplyOptimisticIdentity(
    plan,
    updateSessionIdentity
  );
  step5ImmediateNavigation(plan);
  step6BackgroundReconcile(plan, updateSessionIdentity);

  return optimisticDto;
}

/**
 * Compatibility wrapper retained for Stage 1 callers (`useProfileSubmit`)
 * delegating directly to canonical `commitProfileMutation`.
 */
export async function saveProfile(
  values: ProfileFormValues,
  context: SaveProfileContext,
  port: ProfileSavePort
): Promise<MentorProfileVO>;

export async function saveProfile(
  values: ProfileFormValues,
  deps: SaveProfileDeps
): Promise<MentorProfileVO>;

export async function saveProfile(
  values: ProfileFormValues,
  contextOrDeps: SaveProfileContext | SaveProfileDeps,
  portArg?: ProfileSavePort
): Promise<MentorProfileVO> {
  const port: ProfileSavePort = portArg
    ? portArg
    : 'updateSession' in contextOrDeps
      ? contextOrDeps
      : (() => {
          throw new Error('Missing ProfileSavePort');
        })();

  return commitProfileMutation(
    {
      mode: contextOrDeps.isMentorOnboarding ? 'mentor-onboarding' : 'edit',
      values,
      dirtyFields: contextOrDeps.dirtyFields,
      currentDto: contextOrDeps.currentDto,
    },
    {
      pageUserId: contextOrDeps.pageUserId,
      session: contextOrDeps.session,
      industryCatalog: contextOrDeps.industryCatalog,
      convergenceBudget: contextOrDeps.convergenceBudget,
    },
    port
  );
}
