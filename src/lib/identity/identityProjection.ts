import { captureFlowFailure } from '@/lib/monitoring';
import {
  decode,
  fromWireExperiences,
  type PersonalLink,
} from '@/lib/profile/experienceCodec';
import type { MentorProfileVO } from '@/types/user';

/**
 * The 7 profile-backed `Session['user']` fields projected onto every "who is
 * this user, right now" surface in the app (Header, account dropdown, share
 * profile dialog, profile edit guard, etc.).
 *
 * Both `IDENTITY_FIELD_READERS` and `IDENTITY_FIELD_COMPARATORS` are mapped
 * types over `keyof TrackedIdentityFields`, so adding a field here without
 * defining both its DTO reader and its reconciliation comparator fails
 * `pnpm type-check` at compile time.
 */
export interface TrackedIdentityFields {
  name: string;
  avatar: string | null;
  isMentor: boolean;
  onBoarding: boolean;
  jobTitle: string | undefined;
  company: string | undefined;
  personalLinks: PersonalLink[];
}

export interface IdentitySnapshot extends TrackedIdentityFields {
  /** Session cache-buster timestamp carried alongside the 7 DTO-backed fields. */
  avatarUpdatedAt?: number;
}

export type IdentityPatch = IdentitySnapshot;
export type OptimisticIdentityProjection = IdentitySnapshot;

type IdentityFieldReaders = {
  [K in keyof TrackedIdentityFields]: (
    dto: MentorProfileVO
  ) => TrackedIdentityFields[K];
};

type IdentityFieldComparators = {
  [K in keyof TrackedIdentityFields]: (
    a: TrackedIdentityFields[K],
    b: TrackedIdentityFields[K]
  ) => boolean;
};

function personalLinksEqual(
  a: readonly PersonalLink[],
  b: readonly PersonalLink[]
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every(
    (link, index) =>
      link.platform === b[index]?.platform && link.url === b[index]?.url
  );
}

const IDENTITY_FIELD_READERS: IdentityFieldReaders = {
  name: (dto) => dto.name ?? '',
  avatar: (dto) => dto.avatar ?? null,
  isMentor: (dto) => Boolean(dto.is_mentor),
  onBoarding: (dto) => Boolean(dto.onboarding),
  jobTitle: (dto) => dto.job_title || undefined,
  company: (dto) => dto.company || undefined,
  personalLinks: (dto) =>
    decode(fromWireExperiences(dto.experiences)).personalLinks,
};

const IDENTITY_FIELD_COMPARATORS: IdentityFieldComparators = {
  name: (a, b) => a === b,
  avatar: (a, b) => a === b,
  isMentor: (a, b) => a === b,
  onBoarding: (a, b) => a === b,
  jobTitle: (a, b) => (a || undefined) === (b || undefined),
  company: (a, b) => (a || undefined) === (b || undefined),
  personalLinks: personalLinksEqual,
};

const TRACKED_IDENTITY_KEYS = Object.keys(IDENTITY_FIELD_READERS) as Array<
  keyof TrackedIdentityFields
>;

export interface IdentitySnapshotFromDtoOptions {
  avatarUpdatedAt?: number;
}

/**
 * Projects the full 7-field identity snapshot off a backend or cached
 * `MentorProfileVO`, optionally carrying `avatarUpdatedAt` cache-buster
 * metadata for session writes.
 */
export function identitySnapshotFromDto(
  dto: MentorProfileVO,
  options?: IdentitySnapshotFromDtoOptions
): IdentitySnapshot {
  const fields: Partial<TrackedIdentityFields> = {};
  for (const key of TRACKED_IDENTITY_KEYS) {
    (fields as Record<keyof TrackedIdentityFields, unknown>)[key] =
      IDENTITY_FIELD_READERS[key](dto);
  }
  return {
    ...(fields as TrackedIdentityFields),
    ...(options?.avatarUpdatedAt !== undefined
      ? { avatarUpdatedAt: options.avatarUpdatedAt }
      : {}),
  };
}

export const identityPatchFromDto = identitySnapshotFromDto;
export const optimisticIdentityFromDto = identitySnapshotFromDto;

/**
 * Field-by-field comparison over every key `TrackedIdentityFields` declares
 * (`avatarUpdatedAt` cache-buster metadata is intentionally excluded from
 * backend DTO equality).
 */
export function identitySnapshotsEqual(
  a: IdentitySnapshot,
  b: IdentitySnapshot
): boolean {
  return TRACKED_IDENTITY_KEYS.every((key) => {
    const compare = IDENTITY_FIELD_COMPARATORS[key] as (
      left: TrackedIdentityFields[typeof key],
      right: TrackedIdentityFields[typeof key]
    ) => boolean;
    return compare(a[key], b[key]);
  });
}

export const identityPatchesEqual = identitySnapshotsEqual;

export interface DeriveOptimisticIdentityPatchInput {
  /** The name value from the just-submitted form - always trusted as-is. */
  name: string;
  /** The freshly uploaded avatar URL, if any avatar upload happened. */
  avatarUrl: string | undefined;
  /** Optional cache-buster timestamp for `Session['user']['avatarUpdatedAt']`. */
  avatarUpdatedAt?: number;
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
  jobTitle?: string | undefined;
  company?: string | undefined;
  personalLinks?: PersonalLink[];
}

/**
 * Single derivation of the full 7+1 optimistic identity snapshot. Both the
 * `profileReadModel` write and the NextAuth session write apply the same
 * snapshot so there is zero drift between projection targets.
 */
export function deriveOptimisticIdentitySnapshot(
  input: DeriveOptimisticIdentityPatchInput
): IdentitySnapshot {
  return {
    name: input.name,
    avatar: input.avatarUrl ?? input.fallbackAvatar ?? null,
    ...(input.avatarUpdatedAt !== undefined
      ? { avatarUpdatedAt: input.avatarUpdatedAt }
      : {}),
    isMentor: input.isMentorOnboarding
      ? true
      : (input.fallbackIsMentor ?? false),
    onBoarding: input.isMentorOnboarding
      ? true
      : (input.fallbackOnBoarding ?? false),
    jobTitle: input.jobTitle || undefined,
    company: input.company || undefined,
    personalLinks: input.personalLinks ? [...input.personalLinks] : [],
  };
}

export const deriveOptimisticIdentityPatch = deriveOptimisticIdentitySnapshot;

export interface IdentityApplyTargets {
  /** Writes `snapshot` into the profile read model, merged with the rest of the DTO. */
  primeProfileDto: (snapshot: IdentitySnapshot) => void;
  /** Writes `snapshot` into the NextAuth session. */
  updateSession: (snapshot: IdentitySnapshot) => Promise<unknown>;
}

/**
 * Applies an identity snapshot to both projection targets. The profile read
 * model write is synchronous and always attempted first; the session write is
 * awaited but never allowed to fail the caller's flow.
 */
export async function applyIdentityPatch(
  snapshot: IdentitySnapshot,
  targets: IdentityApplyTargets
): Promise<void> {
  targets.primeProfileDto(snapshot);
  try {
    await targets.updateSession(snapshot);
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
  updateSession: (snapshot: IdentitySnapshot) => Promise<unknown>;
}

/**
 * Compares the identity snapshot that was optimistically applied against the
 * backend-confirmed profile DTO across all 7 `Session['user']` fields, and -
 * if they disagree on any field - writes backend `truth` back through
 * `updateSession` while preserving `avatarUpdatedAt`.
 */
export async function reconcileIdentityWithBackend(
  optimistic: IdentitySnapshot,
  latest: MentorProfileVO | null,
  targets: IdentityReconcileTargets
): Promise<void> {
  if (!latest) return;

  const truth = identitySnapshotFromDto(latest, {
    avatarUpdatedAt: optimistic.avatarUpdatedAt,
  });
  if (identitySnapshotsEqual(optimistic, truth)) return;

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
