import { captureFlowFailure } from '@/lib/monitoring';
import type { MentorProfileVO } from '@/types/user';

/**
 * The subset of a user's profile that gets projected onto every "who is
 * this user, right now" surface in the app: the header avatar, the account
 * menu, the mentor-status copy, etc. Historically these four fields were
 * derived twice (once for the profile DTO cache, once for the NextAuth
 * session) inside `saveProfile`, with no guarantee the two derivations
 * agreed, and reconciled against backend truth for only two of the four
 * (see `reconcileIdentityWithBackend` below).
 *
 * `IDENTITY_FIELD_READERS` below is typed as a mapped type over
 * `keyof IdentityPatch`, so adding a field here without adding a matching
 * reader fails to type-check (`pnpm type-check`) instead of silently
 * shipping an optimistic value that never gets reconciled. See
 * `identityProjection.test.ts` for the guard test.
 */
export interface IdentityPatch {
  name: string;
  avatar: string | null;
  isMentor: boolean;
  onBoarding: boolean;
}

type IdentityFieldReaders = {
  [K in keyof IdentityPatch]: (dto: MentorProfileVO) => IdentityPatch[K];
};

const IDENTITY_FIELD_READERS: IdentityFieldReaders = {
  name: (dto) => dto.name ?? '',
  avatar: (dto) => dto.avatar ?? null,
  isMentor: (dto) => Boolean(dto.is_mentor),
  onBoarding: (dto) => Boolean(dto.onboarding),
};

const IDENTITY_PATCH_KEYS = Object.keys(IDENTITY_FIELD_READERS) as Array<
  keyof IdentityPatch
>;

/**
 * Maps a backend-confirmed profile DTO onto the identity subset. Used both
 * to build the "backend truth" side of a reconciliation diff and (via
 * `identityPatchesEqual`) to decide whether reconciliation needs to write
 * anything at all.
 */
export function identityPatchFromDto(dto: MentorProfileVO): IdentityPatch {
  const patch: Partial<IdentityPatch> = {};
  for (const key of IDENTITY_PATCH_KEYS) {
    (patch as Record<keyof IdentityPatch, unknown>)[key] =
      IDENTITY_FIELD_READERS[key](dto);
  }
  return patch as IdentityPatch;
}

/**
 * Field-by-field comparison over every key `IdentityPatch` currently
 * declares - never a hand-written list of field names, so a field added to
 * the interface is automatically included here too.
 */
export function identityPatchesEqual(
  a: IdentityPatch,
  b: IdentityPatch
): boolean {
  return IDENTITY_PATCH_KEYS.every((key) => a[key] === b[key]);
}

export interface DeriveOptimisticIdentityPatchInput {
  /** The name value from the just-submitted form - always trusted as-is. */
  name: string;
  /** The freshly uploaded avatar URL, if any avatar upload happened. */
  avatarUrl: string | undefined;
  /**
   * True when this save is the mentor-onboarding flow completing, in which
   * case `isMentor`/`onBoarding` are known to flip to true regardless of
   * whatever the caller's prior known values were.
   */
  isMentorOnboarding: boolean;
  /** Best-known current avatar, used when this save didn't touch it. */
  fallbackAvatar: string | null | undefined;
  fallbackIsMentor: boolean | undefined;
  fallbackOnBoarding: boolean | undefined;
}

/**
 * The single derivation of the optimistic identity patch. Called once per
 * `saveProfile` invocation - both the profile DTO cache write and the
 * NextAuth session write apply the same result instead of each recomputing
 * their own guess of "what did this save just change".
 */
export function deriveOptimisticIdentityPatch(
  input: DeriveOptimisticIdentityPatchInput
): IdentityPatch {
  return {
    name: input.name,
    avatar: input.avatarUrl ?? input.fallbackAvatar ?? null,
    isMentor: input.isMentorOnboarding
      ? true
      : (input.fallbackIsMentor ?? false),
    onBoarding: input.isMentorOnboarding
      ? true
      : (input.fallbackOnBoarding ?? false),
  };
}

export interface IdentityApplyTargets {
  /** Writes `patch` into the profile DTO cache, merged with the rest of the DTO. */
  primeProfileDto: (patch: IdentityPatch) => void;
  /** Writes `patch` into the NextAuth session, merged with the rest of the session user. */
  updateSession: (patch: IdentityPatch) => Promise<unknown>;
}

/**
 * Applies an identity patch to both projection targets. The profile DTO
 * cache write is synchronous and always attempted first (matching prior
 * behavior); the session write is awaited but never allowed to fail the
 * caller's flow - a failed session update here is a best-effort background
 * concern, not a reason to block navigation.
 */
export async function applyIdentityPatch(
  patch: IdentityPatch,
  targets: IdentityApplyTargets
): Promise<void> {
  targets.primeProfileDto(patch);
  try {
    await targets.updateSession(patch);
  } catch (e) {
    captureFlowFailure({
      flow: 'profile_update',
      step: 'apply_identity_patch',
      message: e instanceof Error ? e.message : 'updateSession failed',
      level: 'warning',
    });
  }
}

export interface IdentityReconcileTargets {
  updateSession: (patch: IdentityPatch) => Promise<unknown>;
}

/**
 * Compares the identity patch that was optimistically applied against the
 * backend-confirmed profile DTO, and - if they disagree on any field -
 * writes the backend's version back through the same `updateSession` path
 * `applyIdentityPatch` used. A no-op when `latest` is unavailable (the
 * optimistic value stands until the next successful sync) or already
 * matches every tracked field.
 */
export async function reconcileIdentityWithBackend(
  optimistic: IdentityPatch,
  latest: MentorProfileVO | null,
  targets: IdentityReconcileTargets
): Promise<void> {
  if (!latest) return;

  const truth = identityPatchFromDto(latest);
  if (identityPatchesEqual(optimistic, truth)) return;

  try {
    await targets.updateSession(truth);
  } catch (e) {
    captureFlowFailure({
      flow: 'profile_update',
      step: 'reconcile_identity_with_backend',
      message: e instanceof Error ? e.message : 'updateSession failed',
      level: 'warning',
    });
  }
}
