import { fromPartial } from '@total-typescript/shoehorn';
import fs from 'fs';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';

import { encode, toWireExperiences } from '@/lib/profile/experienceCodec';
import type { MentorProfileVO } from '@/types/user';

import {
  applyIdentityPatch,
  deriveOptimisticIdentityPatch,
  type IdentityPatch,
  identityPatchesEqual,
  identityPatchFromDto,
  type IdentitySnapshot,
  identitySnapshotFromDto,
  optimisticIdentityFromDto,
  type OptimisticIdentityProjection,
  reconcileIdentityWithBackend,
  type TrackedIdentityFields,
} from './identityProjection';

function makeDto(overrides: Partial<MentorProfileVO> = {}): MentorProfileVO {
  return fromPartial<MentorProfileVO>({
    user_id: 1,
    name: 'Ada Lovelace',
    avatar: 'https://example.com/ada.png',
    is_mentor: true,
    onboarding: true,
    job_title: null,
    company: null,
    experiences: [],
    ...overrides,
  });
}

describe('identityProjection architectural boundaries (#936)', () => {
  it('contains zero react, next/*, next-auth/react, or @/hooks/** imports', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, 'identityProjection.ts'),
      'utf8'
    );

    expect(source).not.toMatch(/from\s+['"]react['"]/);
    expect(source).not.toMatch(/from\s+['"]next\//);
    expect(source).not.toMatch(/from\s+['"]next-auth\/react['"]/);
    expect(source).not.toMatch(/from\s+['"]@\/hooks\//);
  });

  it('delegates LINK experience decoding in bffAuth.ts to experienceCodec without duplicating isPersonalLink filter loops', () => {
    const bffSource = fs.readFileSync(
      path.resolve(__dirname, '../auth/bffAuth.ts'),
      'utf8'
    );

    expect(bffSource).toMatch(/from\s+['"]@\/lib\/profile\/experienceCodec['"]/);
    expect(bffSource).not.toMatch(/function\s+isPersonalLink\b/);
  });
});

describe('deriveOptimisticIdentityPatch', () => {
  it('uses the freshly uploaded avatar when present and defaults optional profile fields cleanly', () => {
    const patch = deriveOptimisticIdentityPatch({
      name: 'Ada',
      avatarUrl: 'new.png',
      isMentorOnboarding: false,
      fallbackAvatar: 'old.png',
      fallbackIsMentor: false,
      fallbackOnBoarding: false,
    });
    expect(patch).toEqual({
      name: 'Ada',
      avatar: 'new.png',
      isMentor: false,
      onBoarding: false,
      jobTitle: undefined,
      company: undefined,
      personalLinks: [],
    });
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

  it('projects full 7+1 IdentitySnapshot fields including jobTitle, company, personalLinks, and avatarUpdatedAt', () => {
    const snapshot: IdentitySnapshot = deriveOptimisticIdentityPatch({
      name: 'Ada Lovelace',
      avatarUrl: 'https://cdn.example.com/ada-v2.png',
      avatarUpdatedAt: 1754000000123,
      isMentorOnboarding: true,
      fallbackAvatar: 'https://cdn.example.com/ada-v1.png',
      fallbackIsMentor: false,
      fallbackOnBoarding: false,
      jobTitle: 'Principal Engineer',
      company: 'Analytical Engine Co',
      personalLinks: [
        { platform: 'github', url: 'https://github.com/ada' },
      ],
    });

    expect(snapshot).toEqual({
      name: 'Ada Lovelace',
      avatar: 'https://cdn.example.com/ada-v2.png',
      avatarUpdatedAt: 1754000000123,
      isMentor: true,
      onBoarding: true,
      jobTitle: 'Principal Engineer',
      company: 'Analytical Engine Co',
      personalLinks: [
        { platform: 'github', url: 'https://github.com/ada' },
      ],
    });
  });
});

describe('identitySnapshotFromDto / identityPatchesEqual', () => {
  it('maps all 7 Session.user fields off the backend DTO via experienceCodec.decode and keeps aliases unified', () => {
    const { experiences } = encode({
      workExperiences: [],
      educations: [],
      personalLinks: [
        { platform: 'linkedin', url: 'https://linkedin.com/in/grace' },
      ],
    });
    const dto = makeDto({
      name: 'Grace Hopper',
      avatar: null,
      job_title: 'Rear Admiral',
      company: 'US Navy',
      experiences: toWireExperiences(experiences),
    });

    const expected: OptimisticIdentityProjection = {
      name: 'Grace Hopper',
      avatar: null,
      isMentor: true,
      onBoarding: true,
      jobTitle: 'Rear Admiral',
      company: 'US Navy',
      personalLinks: [
        { platform: 'linkedin', url: 'https://linkedin.com/in/grace' },
      ],
    };

    expect(identitySnapshotFromDto(dto)).toEqual(expected);
    expect(identityPatchFromDto(dto)).toEqual(expected);
    expect(optimisticIdentityFromDto(dto)).toEqual(expected);
  });

  it('normalizes empty string or null job_title and company on DTO to undefined', () => {
    const dtoEmpty = makeDto({ job_title: '', company: '' });
    expect(identitySnapshotFromDto(dtoEmpty)).toMatchObject({
      jobTitle: undefined,
      company: undefined,
    });
  });

  it('treats two snapshots with identical tracked fields (including cloned personalLinks and differing avatarUpdatedAt) as equal', () => {
    const a: IdentityPatch = {
      name: 'Ada',
      avatar: 'a.png',
      avatarUpdatedAt: 100,
      isMentor: true,
      onBoarding: true,
      jobTitle: 'Engineer',
      company: 'XChange',
      personalLinks: [{ platform: 'github', url: 'https://github.com/ada' }],
    };
    const b: IdentityPatch = {
      ...a,
      avatarUpdatedAt: 200,
      personalLinks: [{ platform: 'github', url: 'https://github.com/ada' }],
    };
    expect(identityPatchesEqual(a, b)).toBe(true);
  });

  it('reconciliation-equality checks every one of the 7 tracked Session.user fields', () => {
    const base: TrackedIdentityFields = {
      name: 'Ada',
      avatar: 'a.png',
      isMentor: false,
      onBoarding: false,
      jobTitle: 'Engineer',
      company: 'Acme',
      personalLinks: [{ platform: 'github', url: 'https://github.com/ada' }],
    };

    const divergentValueByKey: {
      [K in keyof TrackedIdentityFields]: TrackedIdentityFields[K];
    } = {
      name: 'Someone Else',
      avatar: 'different.png',
      isMentor: true,
      onBoarding: true,
      jobTitle: 'Staff Engineer',
      company: 'XChange',
      personalLinks: [
        { platform: 'linkedin', url: 'https://linkedin.com/in/ada' },
      ],
    };

    for (const key of Object.keys(base) as Array<keyof TrackedIdentityFields>) {
      const divergent: IdentitySnapshot = {
        ...base,
        [key]: divergentValueByKey[key],
      };
      expect(identityPatchesEqual(base, divergent)).toBe(false);
    }
  });

  it('requires every TrackedIdentityFields key to have a matching reconciliation reader (compile-time guard)', () => {
    type FieldsWithExtra = TrackedIdentityFields & { extraField: string };
    type ReadersFor<T> = {
      [K in keyof T]: (dto: MentorProfileVO) => T[K];
    };

    // @ts-expect-error - `extraField` is intentionally left out below to
    // prove the mapped type actually requires every key of TrackedIdentityFields.
    const incompleteReaders: ReadersFor<FieldsWithExtra> = {
      name: (dto) => dto.name ?? '',
      avatar: (dto) => dto.avatar ?? null,
      isMentor: (dto) => Boolean(dto.is_mentor),
      onBoarding: (dto) => Boolean(dto.onboarding),
      jobTitle: (dto) => dto.job_title || undefined,
      company: (dto) => dto.company || undefined,
      personalLinks: () => [],
    };

    expect(incompleteReaders).toBeDefined();
  });
});

describe('applyIdentityPatch', () => {
  it('primes the profile DTO cache and updates the session with the same full snapshot', async () => {
    const patch: IdentityPatch = {
      name: 'Ada',
      avatar: 'a.png',
      avatarUpdatedAt: 1700000000000,
      isMentor: false,
      onBoarding: false,
      jobTitle: 'Engineer',
      company: 'Acme',
      personalLinks: [{ platform: 'github', url: 'https://github.com/ada' }],
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
      jobTitle: undefined,
      company: undefined,
      personalLinks: [],
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
  const optimistic: IdentitySnapshot = {
    name: 'Ada',
    avatar: 'a.png',
    avatarUpdatedAt: 1750000000000,
    isMentor: false,
    onBoarding: false,
    jobTitle: 'Engineer',
    company: 'Acme',
    personalLinks: [{ platform: 'github', url: 'https://github.com/ada' }],
  };

  it('is a no-op when backend truth is not yet available', async () => {
    const updateSession = vi.fn();
    await reconcileIdentityWithBackend(optimistic, null, { updateSession });
    expect(updateSession).not.toHaveBeenCalled();
  });

  it('is a no-op when backend truth matches the optimistic snapshot across all 7 fields', async () => {
    const updateSession = vi.fn();
    const { experiences } = encode({
      workExperiences: [],
      educations: [],
      personalLinks: [{ platform: 'github', url: 'https://github.com/ada' }],
    });
    const latest = makeDto({
      name: 'Ada',
      avatar: 'a.png',
      is_mentor: false,
      onboarding: false,
      job_title: 'Engineer',
      company: 'Acme',
      experiences: toWireExperiences(experiences),
    });
    await reconcileIdentityWithBackend(optimistic, latest, { updateSession });
    expect(updateSession).not.toHaveBeenCalled();
  });

  it('writes the full backend-confirmed snapshot (preserving avatarUpdatedAt) when any single field disagrees', async () => {
    const updateSession = vi.fn().mockResolvedValue(undefined);
    const { experiences } = encode({
      workExperiences: [],
      educations: [],
      personalLinks: [{ platform: 'github', url: 'https://github.com/ada' }],
    });
    const latest = makeDto({
      name: 'Ada',
      avatar: 'a.png',
      is_mentor: true,
      onboarding: false,
      job_title: 'Engineer',
      company: 'Acme',
      experiences: toWireExperiences(experiences),
    });
    await reconcileIdentityWithBackend(optimistic, latest, { updateSession });
    expect(updateSession).toHaveBeenCalledWith({
      name: 'Ada',
      avatar: 'a.png',
      avatarUpdatedAt: 1750000000000,
      isMentor: true,
      onBoarding: false,
      jobTitle: 'Engineer',
      company: 'Acme',
      personalLinks: [{ platform: 'github', url: 'https://github.com/ada' }],
    });
  });

  it('reconciles jobTitle, company, and personalLinks when backend truth diverges even if 4 legacy fields match (#936)', async () => {
    const updateSession = vi.fn().mockResolvedValue(undefined);
    const { experiences } = encode({
      workExperiences: [],
      educations: [],
      personalLinks: [
        { platform: 'linkedin', url: 'https://linkedin.com/in/ada-backend' },
      ],
    });
    const latest = makeDto({
      name: 'Ada',
      avatar: 'a.png',
      is_mentor: false,
      onboarding: false,
      job_title: 'Principal Architect',
      company: 'Babbage Labs',
      experiences: toWireExperiences(experiences),
    });

    await reconcileIdentityWithBackend(optimistic, latest, { updateSession });

    expect(updateSession).toHaveBeenCalledWith({
      name: 'Ada',
      avatar: 'a.png',
      avatarUpdatedAt: 1750000000000,
      isMentor: false,
      onBoarding: false,
      jobTitle: 'Principal Architect',
      company: 'Babbage Labs',
      personalLinks: [
        { platform: 'linkedin', url: 'https://linkedin.com/in/ada-backend' },
      ],
    });
  });
});
