import { act, renderHook } from '@testing-library/react';
import { Session } from 'next-auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

vi.mock('@/services/profile/updateAvatar', () => ({
  updateAvatar: vi.fn(),
}));

vi.mock('@/services/profile/updateProfile', () => ({
  updateProfile: vi.fn(),
}));

vi.mock('@/lib/profile/pollUntilSynced', () => ({
  pollUntilSynced: vi.fn(),
  firstSyncedFetch: vi.fn(),
}));

vi.mock('@/hooks/user/user-data/useUserData', () => ({
  clearUserDataCache: vi.fn(),
  primeUserDataCache: vi.fn(),
}));

vi.mock('@/lib/monitoring', () => ({ captureFlowFailure: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));

import { defaultValues } from '@/components/profile/edit/profileSchema';
import {
  clearUserDataCache,
  primeUserDataCache,
} from '@/hooks/user/user-data/useUserData';
import {
  firstSyncedFetch,
  pollUntilSynced,
} from '@/lib/profile/pollUntilSynced';
import { ExperienceType } from '@/services/profile/experienceType';
import { updateAvatar } from '@/services/profile/updateAvatar';
import { updateProfile } from '@/services/profile/updateProfile';
import type { MentorProfileVO } from '@/services/profile/user';
import { mockRouter } from '@/test/mocks/navigation';
import { mockToast } from '@/test/mocks/useToast';

import { useProfileSubmit } from './useProfileSubmit';

const mockUpdateAvatar = vi.mocked(updateAvatar);
const mockUpdateProfile = vi.mocked(updateProfile);
const mockPollUntilSynced = vi.mocked(pollUntilSynced);
const mockFirstSyncedFetch = vi.mocked(firstSyncedFetch);
const mockPrimeUserDataCache = vi.mocked(primeUserDataCache);
const mockClearUserDataCache = vi.mocked(clearUserDataCache);

const mockUserDTO: MentorProfileVO = {
  user_id: 1,
  name: 'Test User',
  avatar: 'https://example.com/avatar.jpg',
  job_title: 'Engineer',
  company: 'Acme',
  years_of_experience: '1_3',
  location: 'Taiwan',
  // BFF emits industry as the enriched TagVO-shape Dict on read; OpenAPI
  // generator normalises it to `Record<string, never>` because the BFF
  // model annotates it `Optional[Dict[str, Any]]`. Cast through to express
  // the runtime shape without committing the test to the TagVO interface.
  industry: {
    id: 1,
    kind: 'industry',
    subject_group: 'tech',
    subject: 'software',
    language: 'zh_TW',
  } as unknown as MentorProfileVO['industry'],
  onboarding: true,
  is_mentor: true,
  language: 'zh_TW',
  personal_statement: null,
  about: null,
  seniority_level: null,
  want_position: null,
  want_skill: null,
  want_topic: null,
  have_skill: null,
  have_topic: null,
};

const mockSession: Session = {
  user: {
    // Real sessions store user_id as a numeric string. The cache key is
    // built via Number(id) so a non-numeric placeholder would silently
    // become NaN and skip the cache prime path.
    id: '1',
    name: 'Test User',
    email: 'test@example.com',
    onBoarding: true,
    isMentor: true,
  },
  accessToken: 'mock-token',
  expires: '2099-01-01T00:00:00.000Z',
};

const baseValues = {
  ...defaultValues,
  name: 'Test User',
  location: 'Taiwan',
  years_of_experience: '1_3',
  want_position: ['engineer'],
  want_skill: ['TypeScript'],
  want_topic: ['frontend'],
};

const makeOptions = (
  overrides: Partial<Parameters<typeof useProfileSubmit>[0]> = {}
) => ({
  pageUserId: 'test-user-id',
  isMentorOnboarding: false,
  session: mockSession,
  updateSession: vi.fn().mockResolvedValue(mockSession),
  jobSectionError: false,
  educationSectionError: false,
  ...overrides,
});

// Pull the experiences array from the most-recent updateProfile call. Tests
// assert against this shape rather than counting separate experience PUTs;
// experiences travel inline now.
function lastExperiences(): unknown[] | undefined {
  const lastCall =
    mockUpdateProfile.mock.calls[mockUpdateProfile.mock.calls.length - 1];
  if (!lastCall) return undefined;
  const arg = lastCall[0] as { experiences?: unknown[] };
  return arg.experiences;
}

function categoriesIn(payload: unknown): string[] {
  if (!Array.isArray(payload)) return [];
  return (payload as { category?: string }[]).map((e) => e.category ?? '');
}

describe('useProfileSubmit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateProfile.mockResolvedValue(undefined);
    mockPollUntilSynced.mockResolvedValue(mockUserDTO);
    // Default: backend has not synced fast enough → exercise the historical
    // clear-cache + background-poll fallback. Tests covering the new prime
    // path override this per-case.
    mockFirstSyncedFetch.mockResolvedValue(null);
  });

  // ── Guard clauses ──────────────────────────────────────────────────────────

  it('jobSectionError: true → returns early, no service is called', async () => {
    const { result } = renderHook(() =>
      useProfileSubmit(makeOptions({ jobSectionError: true }))
    );

    await act(async () => {
      await result.current.onSubmit(baseValues);
    });

    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(mockPollUntilSynced).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('educationSectionError: true → returns early, no service is called', async () => {
    const { result } = renderHook(() =>
      useProfileSubmit(makeOptions({ educationSectionError: true }))
    );

    await act(async () => {
      await result.current.onSubmit(baseValues);
    });

    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(mockPollUntilSynced).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  // ── Avatar upload ──────────────────────────────────────────────────────────

  it('no avatarFile → updateAvatar is NOT called', async () => {
    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit({ ...baseValues, avatarFile: undefined });
    });

    expect(mockUpdateAvatar).not.toHaveBeenCalled();
  });

  it('avatarFile present + upload succeeds → returned URL is used in profile payload', async () => {
    const newAvatarUrl = 'https://example.com/new-avatar.jpg';
    mockUpdateAvatar.mockResolvedValueOnce(newAvatarUrl);

    const file = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' });
    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit({ ...baseValues, avatarFile: file });
    });

    expect(mockUpdateAvatar).toHaveBeenCalledWith(file);
    expect(mockUpdateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ avatar: newAvatarUrl })
    );
  });

  it('avatarFile present + updateAvatar throws → isSaving returns to false', async () => {
    mockUpdateAvatar.mockRejectedValueOnce(new Error('Upload failed'));

    const file = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' });
    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit({ ...baseValues, avatarFile: file });
    });

    expect(result.current.isSaving).toBe(false);
  });

  // ── Service failures ───────────────────────────────────────────────────────

  it('updateProfile throws → isSaving returns to false', async () => {
    mockUpdateProfile.mockRejectedValueOnce(new Error('Profile update failed'));

    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit(baseValues);
    });

    expect(result.current.isSaving).toBe(false);
  });

  // ── Error feedback (toast) ────────────────────────────────────────────────

  it('updateProfile throws → destructive toast with generic save-failed message', async () => {
    mockUpdateProfile.mockRejectedValueOnce(new Error('Profile update failed'));

    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit(baseValues);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: '儲存失敗，請稍後再試',
      })
    );
  });

  it('avatar upload throws → destructive toast still fires (inner catch re-throws)', async () => {
    mockUpdateAvatar.mockRejectedValueOnce(new Error('Upload failed'));

    const file = new File(['c'], 'avatar.jpg', { type: 'image/jpeg' });
    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit({ ...baseValues, avatarFile: file });
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );
  });

  it('happy path → no toast is fired', async () => {
    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit(baseValues);
    });

    expect(mockToast).not.toHaveBeenCalled();
  });

  // ── Inline experiences ────────────────────────────────────────────────────

  it('no dirtyFields → updateProfile fires with full experiences inline (legacy callers send everything)', async () => {
    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit(baseValues);
    });

    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    // baseValues has empty work/edu/links → still send all 3 categories so
    // backend overwrites with empty data arrays.
    expect(categoriesIn(lastExperiences())).toEqual([
      ExperienceType.WORK,
      ExperienceType.EDUCATION,
      ExperienceType.LINK,
    ]);
  });

  it('work_experiences dirty → experiences batch in payload reflects work data', async () => {
    const valuesWithWork = {
      ...baseValues,
      work_experiences: [
        {
          id: 0,
          job: 'Engineer',
          company: 'Acme',
          job_period_start: '2020',
          job_period_end: 'now',
          industry: 'tech',
          job_location: 'TWN',
          description: 'desc',
          is_primary: true,
        },
      ],
    };

    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit(valuesWithWork, {
        work_experiences: [{ job: true }],
      });
    });

    const exp = lastExperiences() as
      | { category: string; mentor_experiences_metadata: { data: unknown[] } }[]
      | undefined;
    expect(exp).toBeDefined();
    const work = exp!.find((e) => e.category === ExperienceType.WORK);
    expect(work?.mentor_experiences_metadata.data).toHaveLength(1);
  });

  it('only `name` dirty → experiences are NOT sent (backend leaves the column alone)', async () => {
    const valuesWithEverything = {
      ...baseValues,
      work_experiences: [
        {
          id: 0,
          job: 'Engineer',
          company: 'Acme',
          job_period_start: '2020',
          job_period_end: 'now',
          industry: 'tech',
          job_location: 'TWN',
          description: 'desc',
        },
      ],
    };

    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit(valuesWithEverything, { name: true });
    });

    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    expect(lastExperiences()).toBeUndefined();
  });

  it('dirty link field triggers experiences inline (nested dirtyFields shape)', async () => {
    const valuesWithLink = {
      ...baseValues,
      linkedin: {
        id: -1,
        url: 'https://linkedin.com/in/me',
        platform: 'linkedin',
      },
    };

    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit(valuesWithLink, {
        // RHF reports nested dirty as { url: true } for object fields.
        linkedin: { url: true },
      });
    });

    const exp = lastExperiences() as
      | { category: string; mentor_experiences_metadata: { data: unknown[] } }[]
      | undefined;
    expect(exp).toBeDefined();
    const links = exp!.find((e) => e.category === ExperienceType.LINK);
    expect(links?.mentor_experiences_metadata.data).toHaveLength(1);
  });

  // ── Navigation on success ──────────────────────────────────────────────────

  it('isMentorOnboarding: false → router.push("/profile/:pageUserId")', async () => {
    const { result } = renderHook(() =>
      useProfileSubmit(
        makeOptions({ isMentorOnboarding: false, pageUserId: 'test-user-id' })
      )
    );

    await act(async () => {
      await result.current.onSubmit(baseValues);
    });

    expect(mockRouter.push).toHaveBeenCalledWith('/profile/test-user-id');
  });

  it('isMentorOnboarding: true → router.push("/profile/card")', async () => {
    const { result } = renderHook(() =>
      useProfileSubmit(makeOptions({ isMentorOnboarding: true }))
    );

    await act(async () => {
      await result.current.onSubmit(baseValues);
    });

    expect(mockRouter.push).toHaveBeenCalledWith('/profile/card');
  });

  // ── Optimistic flow: poll runs in the background ───────────────────────────

  it('navigation does not wait for pollUntilSynced to resolve', async () => {
    // Never-resolving promise simulates a slow backend sync. The user must
    // still be navigated away within a single tick.
    let resolvePoll: (value: MentorProfileVO | null) => void = () => {};
    mockPollUntilSynced.mockReturnValueOnce(
      new Promise<MentorProfileVO | null>((resolve) => {
        resolvePoll = resolve;
      })
    );

    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit(baseValues);
    });

    expect(mockRouter.push).toHaveBeenCalledWith('/profile/test-user-id');
    // Cleanly settle the dangling promise to avoid leaking into later tests.
    resolvePoll(null);
  });

  it('optimistic session update preserves current isMentor / onBoarding (does not flicker from latest=null)', async () => {
    // Background poll resolves to null (e.g. backend never synced) — the
    // session update made BEFORE the navigation must still reflect the
    // pre-submit isMentor/onBoarding values.
    mockPollUntilSynced.mockResolvedValueOnce(null);

    const updateSession = vi.fn().mockResolvedValue(mockSession);
    const { result } = renderHook(() =>
      useProfileSubmit(makeOptions({ updateSession }))
    );

    await act(async () => {
      await result.current.onSubmit(baseValues);
    });

    expect(updateSession).toHaveBeenCalled();
    const firstCallArg = updateSession.mock.calls[0][0] as {
      user: { isMentor?: boolean; onBoarding?: boolean };
    };
    expect(firstCallArg.user.isMentor).toBe(true);
    expect(firstCallArg.user.onBoarding).toBe(true);
  });

  it('background reconcile patches session when latest disagrees with optimistic role', async () => {
    // Optimistic session: isMentor=true. Backend poll says isMentor=false.
    mockPollUntilSynced.mockResolvedValueOnce({
      ...mockUserDTO,
      is_mentor: false,
      onboarding: true,
    });

    const updateSession = vi.fn().mockResolvedValue(mockSession);
    const { result } = renderHook(() =>
      useProfileSubmit(makeOptions({ updateSession }))
    );

    await act(async () => {
      await result.current.onSubmit(baseValues);
      // Flush microtasks so the .then() reconcile callback runs.
      await Promise.resolve();
      await Promise.resolve();
    });

    // First call: optimistic. Second call: reconcile.
    expect(updateSession).toHaveBeenCalledTimes(2);
    const reconcileArg = updateSession.mock.calls[1][0] as {
      user: { isMentor?: boolean; onBoarding?: boolean };
    };
    expect(reconcileArg.user.isMentor).toBe(false);
    expect(reconcileArg.user.onBoarding).toBe(true);
  });

  it('background reconcile is a no-op when latest matches optimistic session', async () => {
    // Backend agrees with optimistic state — no second updateSession call.
    mockPollUntilSynced.mockResolvedValueOnce({
      ...mockUserDTO,
      is_mentor: true,
      onboarding: true,
    });

    const updateSession = vi.fn().mockResolvedValue(mockSession);
    const { result } = renderHook(() =>
      useProfileSubmit(makeOptions({ updateSession }))
    );

    await act(async () => {
      await result.current.onSubmit(baseValues);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(updateSession).toHaveBeenCalledTimes(1);
  });

  // ── Cache prime vs fallback ────────────────────────────────────────────────

  it('firstSyncedFetch returns dto → primeUserDataCache called, pollUntilSynced NOT called', async () => {
    mockFirstSyncedFetch.mockResolvedValueOnce(mockUserDTO);

    const { result } = renderHook(() =>
      useProfileSubmit(makeOptions({ isMentorOnboarding: true }))
    );

    await act(async () => {
      await result.current.onSubmit(baseValues);
      // Flush microtasks so the background prime + reconcile resolve.
      await Promise.resolve();
      await Promise.resolve();
    });

    // Cache is cleared optimistically pre-navigation; the prime that follows
    // the background firstSyncedFetch refills it with the synced dto.
    expect(mockClearUserDataCache).toHaveBeenCalledWith(
      Number(mockSession.user!.id),
      'zh_TW'
    );
    expect(mockPrimeUserDataCache).toHaveBeenCalledWith(
      Number(mockSession.user!.id),
      'zh_TW',
      mockUserDTO
    );
    expect(mockPollUntilSynced).not.toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith('/profile/card');
  });

  it('firstSyncedFetch returns null → falls back to clearUserDataCache + pollUntilSynced', async () => {
    mockFirstSyncedFetch.mockResolvedValueOnce(null);

    const { result } = renderHook(() =>
      useProfileSubmit(makeOptions({ isMentorOnboarding: true }))
    );

    await act(async () => {
      await result.current.onSubmit(baseValues);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockPrimeUserDataCache).not.toHaveBeenCalled();
    expect(mockClearUserDataCache).toHaveBeenCalledWith(
      Number(mockSession.user!.id),
      'zh_TW'
    );
    expect(mockPollUntilSynced).toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith('/profile/card');
  });

  it('prime path: inline reconcile patches session when primed latest disagrees with optimistic role', async () => {
    mockFirstSyncedFetch.mockResolvedValueOnce({
      ...mockUserDTO,
      is_mentor: false,
      onboarding: true,
    });

    const updateSession = vi.fn().mockResolvedValue(mockSession);
    const { result } = renderHook(() =>
      useProfileSubmit(makeOptions({ updateSession }))
    );

    await act(async () => {
      await result.current.onSubmit(baseValues);
      await Promise.resolve();
      await Promise.resolve();
    });

    // Optimistic + inline reconcile (no background poll second call).
    expect(mockPollUntilSynced).not.toHaveBeenCalled();
    expect(updateSession).toHaveBeenCalledTimes(2);
    const reconcileArg = updateSession.mock.calls[1][0] as {
      user: { isMentor?: boolean; onBoarding?: boolean };
    };
    expect(reconcileArg.user.isMentor).toBe(false);
    expect(reconcileArg.user.onBoarding).toBe(true);
  });

  // ── Background avatar upload ──────────────────────────────────────────────

  it('consumeAvatarUpload, when provided, is used instead of direct updateAvatar', async () => {
    const consumed = 'https://example.com/from-bg.jpg';
    const consumeAvatarUpload = vi.fn().mockResolvedValue(consumed);

    const file = new File(['c'], 'avatar.jpg', { type: 'image/jpeg' });
    const { result } = renderHook(() =>
      useProfileSubmit(makeOptions({ consumeAvatarUpload }))
    );

    await act(async () => {
      await result.current.onSubmit({ ...baseValues, avatarFile: file });
    });

    expect(consumeAvatarUpload).toHaveBeenCalledWith(file);
    expect(mockUpdateAvatar).not.toHaveBeenCalled();
    expect(mockUpdateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ avatar: consumed })
    );
  });

  // ── Dirty-field skip ───────────────────────────────────────────────────────

  it('dirtyFields = {} → no PUTs fire', async () => {
    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit(baseValues, {});
    });

    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it('isMentorOnboarding: true forces updateProfile even with empty dirtyFields', async () => {
    const { result } = renderHook(() =>
      useProfileSubmit(makeOptions({ isMentorOnboarding: true }))
    );

    await act(async () => {
      await result.current.onSubmit(baseValues, {});
    });

    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
  });

  it('avatarFile present with empty dirtyFields → updateProfile still fires with new avatar', async () => {
    const newAvatarUrl = 'https://example.com/new.jpg';
    mockUpdateAvatar.mockResolvedValueOnce(newAvatarUrl);
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });

    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit({ ...baseValues, avatarFile: file }, {});
    });

    expect(mockUpdateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ avatar: newAvatarUrl })
    );
  });

  it('navigation does not wait for firstSyncedFetch to resolve', async () => {
    // Background prime must not block router.push — even a slow first-sync
    // fetch leaves the user on the loading screen too long.
    let resolveFirst: (value: MentorProfileVO | null) => void = () => {};
    mockFirstSyncedFetch.mockReturnValueOnce(
      new Promise<MentorProfileVO | null>((resolve) => {
        resolveFirst = resolve;
      })
    );

    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit(baseValues);
    });

    expect(mockRouter.push).toHaveBeenCalledWith('/profile/test-user-id');
    // Settle so the dangling background promise doesn't leak into other tests.
    resolveFirst(null);
  });

  // ── Primary job persistence ────────────────────────────────────────────────

  it('updateProfile payload mirrors job_title / company from the primary work experience', async () => {
    const valuesWithPrimary = {
      ...baseValues,
      work_experiences: [
        {
          id: 0,
          job: 'Engineer',
          company: 'Acme',
          job_period_start: '2020',
          job_period_end: 'now',
          industry: 'tech',
          job_location: 'TWN',
          description: 'desc',
          is_primary: false,
        },
        {
          id: 1,
          job: 'Senior Engineer',
          company: 'Dell',
          job_period_start: '2015',
          job_period_end: '2019',
          industry: 'tech',
          job_location: 'TWN',
          description: 'desc',
          is_primary: true,
        },
      ],
    };

    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit(valuesWithPrimary);
    });

    expect(mockUpdateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        job_title: 'Senior Engineer',
        company: 'Dell',
      })
    );
  });

  it('updateProfile payload falls back to the first work experience when none is primary', async () => {
    const valuesNoPrimary = {
      ...baseValues,
      work_experiences: [
        {
          id: 0,
          job: 'Engineer',
          company: 'Acme',
          job_period_start: '2020',
          job_period_end: 'now',
          industry: 'tech',
          job_location: 'TWN',
          description: 'desc',
        },
        {
          id: 1,
          job: 'Senior Engineer',
          company: 'Dell',
          job_period_start: '2015',
          job_period_end: '2019',
          industry: 'tech',
          job_location: 'TWN',
          description: 'desc',
        },
      ],
    };

    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit(valuesNoPrimary);
    });

    expect(mockUpdateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        job_title: 'Engineer',
        company: 'Acme',
      })
    );
  });

  it('updateProfile payload uses empty strings when no work experiences exist', async () => {
    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit(baseValues);
    });

    expect(mockUpdateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ job_title: '', company: '' })
    );
  });

  it('work_experiences dirty triggers updateProfile so job_title / company stay in sync', async () => {
    const valuesWithWork = {
      ...baseValues,
      work_experiences: [
        {
          id: 0,
          job: 'Engineer',
          company: 'Acme',
          job_period_start: '2020',
          job_period_end: 'now',
          industry: 'tech',
          job_location: 'TWN',
          description: 'desc',
          is_primary: true,
        },
      ],
    };

    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit(valuesWithWork, {
        work_experiences: [{ is_primary: true }],
      });
    });

    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    expect(mockUpdateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ job_title: 'Engineer', company: 'Acme' })
    );
  });

  it('work experiences inline batch includes is_primary in payload', async () => {
    const valuesWithPrimary = {
      ...baseValues,
      work_experiences: [
        {
          id: 0,
          job: 'Engineer',
          company: 'Acme',
          job_period_start: '2020',
          job_period_end: 'now',
          industry: 'tech',
          job_location: 'TWN',
          description: 'desc',
          is_primary: false,
        },
        {
          id: 1,
          job: 'Senior Engineer',
          company: 'Dell',
          job_period_start: '2015',
          job_period_end: '2019',
          industry: 'tech',
          job_location: 'TWN',
          description: 'desc',
          is_primary: true,
        },
      ],
    };

    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit(valuesWithPrimary);
    });

    const exp = lastExperiences() as
      | {
          category: string;
          mentor_experiences_metadata: { data: { is_primary?: boolean }[] };
        }[]
      | undefined;
    const work = exp!.find((e) => e.category === ExperienceType.WORK);
    expect(work?.mentor_experiences_metadata.data[0].is_primary).toBe(false);
    expect(work?.mentor_experiences_metadata.data[1].is_primary).toBe(true);
  });
});
