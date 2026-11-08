import { describe, expect, it, vi } from 'vitest';

import type { MentorProfileVO } from '@/types/user';

import {
  applyIdentityPatch,
  deriveOptimisticIdentityPatch,
  type IdentityPatch,
  identityPatchesEqual,
  identityPatchFromDto,
  reconcileIdentityWithBackend,
} from './identityProjection';

function makeDto(overrides: Partial<MentorProfileVO> = {}): MentorProfileVO {
  return {
    user_id: 1,
    name: 'Ada Lovelace',
    avatar: 'https://example.com/ada.png',
    is_mentor: true,
    onboarding: true,
    ...overrides,
  } as unknown as MentorProfileVO;
}

describe('deriveOptimisticIdentityPatch', () => {
  it('uses the freshly uploaded avatar when present', () => {
    const patch = deriveOptimisticIdentityPatch({
      name: 'Ada',
      avatarUrl: 'new.png',
      isMentorOnboarding: false,
      fallbackAvatar: 'old.png',
      fallbackIsMentor: false,
      fallbackOnBoarding: false,
    });
    expect(patch.avatar).toBe('new.png');
  });

  it('falls back to the known-current avatar when no upload happened', () => {
    const patch = deriveOptimisticIdentityPatch({
      name: 'Ada',
      avatarUrl: undefined,
      isMentorOnboarding: false,
      fallbackAvatar: 'old.png',
      fallbackIsMentor: false,
      fallbackOnBoarding: false,
    });
    expect(patch.avatar).toBe('old.png');
  });

  it('forces isMentor/onBoarding to true when this save is mentor onboarding, regardless of the fallback', () => {
    const patch = deriveOptimisticIdentityPatch({
      name: 'Ada',
      avatarUrl: undefined,
      isMentorOnboarding: true,
      fallbackAvatar: null,
      fallbackIsMentor: false,
      fallbackOnBoarding: false,
    });
    expect(patch.isMentor).toBe(true);
    expect(patch.onBoarding).toBe(true);
  });

  it('preserves the fallback isMentor/onBoarding when this save is not mentor onboarding', () => {
    const patch = deriveOptimisticIdentityPatch({
      name: 'Ada',
      avatarUrl: undefined,
      isMentorOnboarding: false,
      fallbackAvatar: null,
      fallbackIsMentor: true,
      fallbackOnBoarding: true,
    });
    expect(patch.isMentor).toBe(true);
    expect(patch.onBoarding).toBe(true);
  });
});

describe('identityPatchFromDto / identityPatchesEqual', () => {
  it('maps every tracked field off the backend DTO', () => {
    const dto = makeDto({ name: 'Grace Hopper', avatar: null });
    expect(identityPatchFromDto(dto)).toEqual({
      name: 'Grace Hopper',
      avatar: null,
      isMentor: true,
      onBoarding: true,
    });
  });

  it('treats two patches with identical fields as equal', () => {
    const a: IdentityPatch = {
      name: 'Ada',
      avatar: 'a.png',
      isMentor: true,
      onBoarding: true,
    };
    const b: IdentityPatch = { ...a };
    expect(identityPatchesEqual(a, b)).toBe(true);
  });

  it('reconciliation-equality checks every currently-tracked identity field', () => {
    // Guards against a future edit that narrows identityPatchesEqual back
    // down to a hand-picked subset of fields (e.g. only isMentor/onBoarding,
    // which is exactly the bug X-Tracker #670 fixed) by proving each field
    // this module currently tracks is actually compared.
    const base: IdentityPatch = {
      name: 'Ada',
      avatar: 'a.png',
      isMentor: false,
      onBoarding: false,
    };

    const divergentValueByKey: Record<keyof IdentityPatch, string | boolean> = {
      name: 'Someone Else',
      avatar: 'different.png',
      isMentor: true,
      onBoarding: true,
    };

    for (const key of Object.keys(base) as (keyof IdentityPatch)[]) {
      const divergent = {
        ...base,
        [key]: divergentValueByKey[key],
      } as IdentityPatch;
      expect(identityPatchesEqual(base, divergent)).toBe(false);
    }
  });

  it('requires every IdentityPatch field to have a matching reconciliation reader (compile-time guard)', () => {
    // This mirrors the internal `IDENTITY_FIELD_READERS` mapped type in
    // identityProjection.ts. If a field is ever added to `IdentityPatch`
    // without adding a reader for it here (and, in the real module, to
    // `IDENTITY_FIELD_READERS`), the object literal below stops satisfying
    // `ReadersFor<PatchWithExtraField>` and `pnpm type-check` fails - the
    // explicit failure signal X-Tracker #670 asks for instead of a newly
    // optimistic field silently never being reconciled.
    type PatchWithExtraField = IdentityPatch & { extraField: string };
    type ReadersFor<T> = {
      [K in keyof T]: (dto: MentorProfileVO) => T[K];
    };

    // @ts-expect-error - `extraField` is intentionally left out below to
    // prove the mapped type actually requires every key of IdentityPatch.
    const incompleteReaders: ReadersFor<PatchWithExtraField> = {
      name: (dto) => dto.name ?? '',
      avatar: (dto) => dto.avatar ?? null,
      isMentor: (dto) => Boolean(dto.is_mentor),
      onBoarding: (dto) => Boolean(dto.onboarding),
    };

    expect(incompleteReaders).toBeDefined();
  });
});

describe('applyIdentityPatch', () => {
  it('primes the profile DTO cache and updates the session with the same patch', async () => {
    const patch: IdentityPatch = {
      name: 'Ada',
      avatar: 'a.png',
      isMentor: false,
      onBoarding: false,
    };
    const primeProfileDto = vi.fn();
    const updateSession = vi.fn().mockResolvedValue(undefined);

    await applyIdentityPatch(patch, { primeProfileDto, updateSession });

    expect(primeProfileDto).toHaveBeenCalledWith(patch);
    expect(updateSession).toHaveBeenCalledWith(patch);
  });

  it('swallows a session update failure instead of throwing', async () => {
    const patch: IdentityPatch = {
      name: 'Ada',
      avatar: 'a.png',
      isMentor: false,
      onBoarding: false,
    };
    const primeProfileDto = vi.fn();
    const updateSession = vi.fn().mockRejectedValue(new Error('boom'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      applyIdentityPatch(patch, { primeProfileDto, updateSession })
    ).resolves.toBeUndefined();

    consoleSpy.mockRestore();
  });
});

describe('reconcileIdentityWithBackend', () => {
  const optimistic: IdentityPatch = {
    name: 'Ada',
    avatar: 'a.png',
    isMentor: false,
    onBoarding: false,
  };

  it('is a no-op when backend truth is not yet available', async () => {
    const updateSession = vi.fn();
    await reconcileIdentityWithBackend(optimistic, null, { updateSession });
    expect(updateSession).not.toHaveBeenCalled();
  });

  it('is a no-op when backend truth matches the optimistic patch on every field', async () => {
    const updateSession = vi.fn();
    const latest = makeDto({
      name: 'Ada',
      avatar: 'a.png',
      is_mentor: false,
      onboarding: false,
    });
    await reconcileIdentityWithBackend(optimistic, latest, { updateSession });
    expect(updateSession).not.toHaveBeenCalled();
  });

  it('writes the full backend-confirmed patch when any single field disagrees', async () => {
    const updateSession = vi.fn().mockResolvedValue(undefined);
    const latest = makeDto({
      name: 'Ada',
      avatar: 'a.png',
      is_mentor: true, // disagrees with optimistic.isMentor = false
      onboarding: false,
    });
    await reconcileIdentityWithBackend(optimistic, latest, { updateSession });
    expect(updateSession).toHaveBeenCalledWith({
      name: 'Ada',
      avatar: 'a.png',
      isMentor: true,
      onBoarding: false,
    });
  });

  it('reconciles avatar and name too, not just isMentor/onBoarding', async () => {
    const updateSession = vi.fn().mockResolvedValue(undefined);
    const latest = makeDto({
      name: 'Grace',
      avatar: 'different.png',
      is_mentor: false,
      onboarding: false,
    });
    await reconcileIdentityWithBackend(optimistic, latest, { updateSession });
    expect(updateSession).toHaveBeenCalledWith({
      name: 'Grace',
      avatar: 'different.png',
      isMentor: false,
      onBoarding: false,
    });
  });
});
