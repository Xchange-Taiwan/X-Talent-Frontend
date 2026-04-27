import { act, renderHook } from '@testing-library/react';
import { Session } from 'next-auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

vi.mock('@/services/profile/updateAvatar', () => ({
  updateAvatar: vi.fn(),
}));

vi.mock('@/services/profile/updateProfile', () => ({
  updateProfile: vi.fn(),
}));

vi.mock('@/services/profile/upsertExperience', () => ({
  upsertMentorExperience: vi.fn(),
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
import { upsertMentorExperience } from '@/services/profile/upsertExperience';
import type { MentorProfileVO } from '@/services/profile/user';
import { mockRouter } from '@/test/mocks/navigation';

import { useProfileSubmit } from './useProfileSubmit';

const mockUpdateAvatar = vi.mocked(updateAvatar);
const mockUpdateProfile = vi.mocked(updateProfile);
const mockUpsertMentorExperience = vi.mocked(upsertMentorExperience);
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
  interested_positions: { interests: [], language: null },
  skills: { interests: [], language: null },
  topics: { interests: [], language: null },
  industry: {
    id: 1,
    category: 'INDUSTRY',
    subject_group: 'tech',
    subject: 'software',
    language: 'zh_TW',
    profession_metadata: { desc: '', icon: '' },
  },
  onboarding: true,
  is_mentor: true,
  language: 'zh_TW',
  personal_statement: null,
  about: null,
  seniority_level: null,
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
  interested_positions: ['engineer'],
  skills: ['TypeScript'],
  topics: ['frontend'],
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

describe('useProfileSubmit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateProfile.mockResolvedValue(undefined);
    mockUpsertMentorExperience.mockResolvedValue(undefined);
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
    expect(mockUpsertMentorExperience).not.toHaveBeenCalled();
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
    expect(mockUpsertMentorExperience).not.toHaveBeenCalled();
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

  it('upsertMentorExperience throws → isSaving returns to false', async () => {
    mockUpsertMentorExperience.mockRejectedValueOnce(
      new Error('Upsert failed')
    );

    const valuesWithWork = {
      ...baseValues,
      work_experiences: [
        {
          id: 1,
          job: 'Engineer',
          company: 'Acme',
          jobPeriodStart: '2020',
          jobPeriodEnd: '2023',
          industry: 'tech',
          jobLocation: 'Taiwan',
          description: 'Built things',
        },
      ],
    };

    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit(valuesWithWork);
    });

    expect(result.current.isSaving).toBe(false);
  });

  // ── Conditional upserts ────────────────────────────────────────────────────

  it('work_experiences is empty → work experience upsert is NOT called', async () => {
    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit({ ...baseValues, work_experiences: [] });
    });

    const workCalls = mockUpsertMentorExperience.mock.calls.filter(
      ([type]) => type === ExperienceType.WORK
    );
    expect(workCalls).toHaveLength(0);
  });

  it('educations is empty → education upsert is NOT called', async () => {
    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit({ ...baseValues, educations: [] });
    });

    const educationCalls = mockUpsertMentorExperience.mock.calls.filter(
      ([type]) => type === ExperienceType.EDUCATION
    );
    expect(educationCalls).toHaveLength(0);
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
      // Flush microtasks so any inline reconcile after prime runs.
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockPrimeUserDataCache).toHaveBeenCalledWith(
      Number(mockSession.user!.id),
      'zh_TW',
      mockUserDTO
    );
    expect(mockClearUserDataCache).not.toHaveBeenCalled();
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

  // ── Parallel writes ────────────────────────────────────────────────────────

  it('updateProfile and experience upserts run concurrently (no sequential wait)', async () => {
    let resolveProfile: () => void = () => {};
    let profileStartedAt = 0;
    let experienceStartedAt = 0;

    mockUpdateProfile.mockImplementationOnce(() => {
      profileStartedAt = performance.now();
      return new Promise<void>((resolve) => {
        resolveProfile = () => resolve();
      });
    });
    mockUpsertMentorExperience.mockImplementationOnce(async () => {
      experienceStartedAt = performance.now();
    });

    const valuesWithWork = {
      ...baseValues,
      work_experiences: [
        {
          id: 1,
          job: 'Engineer',
          company: 'Acme',
          jobPeriodStart: '2020',
          jobPeriodEnd: 'now',
          industry: 'tech',
          jobLocation: 'TWN',
          description: 'desc',
          isPrimary: true,
        },
      ],
    };

    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    const submitPromise = act(async () => {
      await result.current.onSubmit(valuesWithWork);
    });

    // Let microtasks drain so both PUTs have a chance to be invoked.
    await Promise.resolve();
    await Promise.resolve();

    // Experience upsert must NOT be gated on updateProfile resolving.
    expect(mockUpsertMentorExperience).toHaveBeenCalled();
    expect(experienceStartedAt).toBeGreaterThan(0);
    expect(profileStartedAt).toBeGreaterThan(0);

    resolveProfile();
    await submitPromise;
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

  // ── Primary job persistence ────────────────────────────────────────────────

  it('work experience upsert includes isPrimary in payload', async () => {
    const valuesWithPrimary = {
      ...baseValues,
      work_experiences: [
        {
          id: 1,
          job: 'Engineer',
          company: 'Acme',
          jobPeriodStart: '2020',
          jobPeriodEnd: 'now',
          industry: 'tech',
          jobLocation: 'TWN',
          description: 'desc',
          isPrimary: false,
        },
        {
          id: 2,
          job: 'Senior Engineer',
          company: 'Dell',
          jobPeriodStart: '2015',
          jobPeriodEnd: '2019',
          industry: 'tech',
          jobLocation: 'TWN',
          description: 'desc',
          isPrimary: true,
        },
      ],
    };

    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit(valuesWithPrimary);
    });

    const workCall = mockUpsertMentorExperience.mock.calls.find(
      ([type]) => type === ExperienceType.WORK
    );
    expect(workCall).toBeDefined();
    const payload = workCall![2];
    const data = (
      payload.mentor_experiences_metadata as {
        data: { isPrimary?: boolean }[];
      }
    ).data;
    expect(data[0].isPrimary).toBe(false);
    expect(data[1].isPrimary).toBe(true);
  });
});
