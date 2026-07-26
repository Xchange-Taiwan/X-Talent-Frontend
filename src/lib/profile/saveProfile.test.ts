import { Session } from 'next-auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('@/lib/monitoring', () => ({ captureFlowFailure: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));

vi.mock('@/lib/avatar/avatarOverrideStore', () => ({
  setAvatarOverride: vi.fn(),
}));

import { setAvatarOverride } from '@/lib/avatar/avatarOverrideStore';
import {
  firstSyncedFetch,
  pollUntilSynced,
} from '@/lib/profile/pollUntilSynced';
import { defaultValues } from '@/schemas/profileSchema';
import { ExperienceType } from '@/services/profile/experienceType';
import { updateAvatar } from '@/services/profile/updateAvatar';
import { updateProfile } from '@/services/profile/updateProfile';
import type { MentorProfileVO } from '@/services/profile/user';

import { saveProfile, SaveProfileDeps } from './saveProfile';

const mockUpdateAvatar = vi.mocked(updateAvatar);
const mockUpdateProfile = vi.mocked(updateProfile);
const mockPollUntilSynced = vi.mocked(pollUntilSynced);
const mockFirstSyncedFetch = vi.mocked(firstSyncedFetch);
const mockSetAvatarOverride = vi.mocked(setAvatarOverride);

const mockUserDTO: MentorProfileVO = {
  user_id: 1,
  name: 'Test User',
  avatar: 'https://example.com/avatar.jpg',
  job_title: 'Engineer',
  company: 'Acme',
  years_of_experience: '1_3',
  location: 'Taiwan',
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

const makeDeps = (
  overrides: Partial<SaveProfileDeps> = {}
): SaveProfileDeps => ({
  pageUserId: 'test-user-id',
  isMentorOnboarding: false,
  session: mockSession,
  updateSession: vi.fn().mockResolvedValue(mockSession),
  navigate: vi.fn(),
  revalidateProfilePath: vi.fn().mockResolvedValue(undefined),
  clearUserDataCache: vi.fn(),
  primeUserDataCache: vi.fn(),
  ...overrides,
});

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

describe('saveProfile (Deep Module)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateProfile.mockResolvedValue(undefined);
    mockPollUntilSynced.mockResolvedValue(mockUserDTO);
    mockFirstSyncedFetch.mockResolvedValue(null);
  });

  // ── Avatar upload ──────────────────────────────────────────────────────────

  it('no avatarFile → updateAvatar is NOT called', async () => {
    const deps = makeDeps();
    await saveProfile({ ...baseValues, avatarFile: undefined }, deps);
    expect(mockUpdateAvatar).not.toHaveBeenCalled();

    await Promise.resolve();
    await Promise.resolve();
  });

  it('avatarFile present + upload succeeds → returned URL is used in profile payload and setAvatarOverride is called', async () => {
    const newAvatarUrl = 'https://example.com/new-avatar.jpg';
    mockUpdateAvatar.mockResolvedValueOnce(newAvatarUrl);

    const file = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' });
    const deps = makeDeps();
    await saveProfile({ ...baseValues, avatarFile: file }, deps);

    expect(mockUpdateAvatar).toHaveBeenCalledWith(file);
    expect(mockUpdateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ avatar: newAvatarUrl })
    );
    expect(mockSetAvatarOverride).toHaveBeenCalledWith('1', newAvatarUrl);

    await Promise.resolve();
    await Promise.resolve();
  });

  it('avatarFile present + updateAvatar throws → throws error', async () => {
    mockUpdateAvatar.mockRejectedValueOnce(new Error('Upload failed'));

    const file = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' });
    const deps = makeDeps();

    await expect(
      saveProfile({ ...baseValues, avatarFile: file }, deps)
    ).rejects.toThrow('Upload failed');

    await Promise.resolve();
    await Promise.resolve();
  });

  // ── Service failures ───────────────────────────────────────────────────────

  it('updateProfile throws → throws error', async () => {
    mockUpdateProfile.mockRejectedValueOnce(new Error('Profile update failed'));
    const deps = makeDeps();

    await expect(saveProfile(baseValues, deps)).rejects.toThrow(
      'Profile update failed'
    );

    await Promise.resolve();
    await Promise.resolve();
  });

  // ── Inline experiences ────────────────────────────────────────────────────

  it('no dirtyFields → updateProfile fires with full experiences inline (legacy callers send everything)', async () => {
    const deps = makeDeps();
    await saveProfile(baseValues, deps);

    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    expect(categoriesIn(lastExperiences())).toEqual([
      ExperienceType.WORK,
      ExperienceType.EDUCATION,
      ExperienceType.LINK,
    ]);

    await Promise.resolve();
    await Promise.resolve();
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

    const deps = makeDeps({
      dirtyFields: { work_experiences: [{ job: true }] },
    });
    await saveProfile(valuesWithWork, deps);

    const exp = lastExperiences() as
      | { category: string; mentor_experiences_metadata: { data: unknown[] } }[]
      | undefined;
    expect(exp).toBeDefined();
    const work = exp!.find((e) => e.category === ExperienceType.WORK);
    expect(work?.mentor_experiences_metadata.data).toHaveLength(1);

    await Promise.resolve();
    await Promise.resolve();
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

    const deps = makeDeps({ dirtyFields: { name: true } });
    await saveProfile(valuesWithEverything, deps);

    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    expect(lastExperiences()).toBeUndefined();

    await Promise.resolve();
    await Promise.resolve();
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

    const deps = makeDeps({
      dirtyFields: { linkedin: { url: true } },
    });
    await saveProfile(valuesWithLink, deps);

    const exp = lastExperiences() as
      | { category: string; mentor_experiences_metadata: { data: unknown[] } }[]
      | undefined;
    expect(exp).toBeDefined();
    const links = exp!.find((e) => e.category === ExperienceType.LINK);
    expect(links?.mentor_experiences_metadata.data).toHaveLength(1);

    await Promise.resolve();
    await Promise.resolve();
  });

  // ── Navigation & Sequence ──────────────────────────────────────────────────

  it('isMentorOnboarding: false → deps.navigate("/profile/:pageUserId") and revalidateProfilePath is called before navigate', async () => {
    const navigate = vi.fn();
    const revalidateProfilePath = vi.fn().mockResolvedValue(undefined);
    const deps = makeDeps({
      isMentorOnboarding: false,
      navigate,
      revalidateProfilePath,
    });
    await saveProfile(baseValues, deps);

    expect(navigate).toHaveBeenCalledWith('/profile/test-user-id');
    expect(revalidateProfilePath).toHaveBeenCalledWith('test-user-id');

    // Assert that revalidateProfilePath was invoked before navigate
    const revalidateCallIndex =
      revalidateProfilePath.mock.invocationCallOrder[0];
    const navigateCallIndex = navigate.mock.invocationCallOrder[0];
    expect(revalidateCallIndex).toBeLessThan(navigateCallIndex);

    await Promise.resolve();
    await Promise.resolve();
  });

  it('isMentorOnboarding: true → deps.navigate("/profile/card")', async () => {
    const navigate = vi.fn();
    const deps = makeDeps({ isMentorOnboarding: true, navigate });
    await saveProfile(baseValues, deps);

    expect(navigate).toHaveBeenCalledWith('/profile/card');

    await Promise.resolve();
    await Promise.resolve();
  });

  // ── Optimistic flow: poll runs in the background ───────────────────────────

  it('navigation does not wait for pollUntilSynced to resolve', async () => {
    let resolvePoll: (value: MentorProfileVO | null) => void = () => {};
    mockPollUntilSynced.mockReturnValueOnce(
      new Promise<MentorProfileVO | null>((resolve) => {
        resolvePoll = resolve;
      })
    );

    const navigate = vi.fn();
    const deps = makeDeps({ navigate });
    await saveProfile(baseValues, deps);

    expect(navigate).toHaveBeenCalledWith('/profile/test-user-id');
    resolvePoll(null);

    await Promise.resolve();
    await Promise.resolve();
  });

  it('optimistic session update preserves current isMentor / onBoarding (does not flicker from latest=null)', async () => {
    mockPollUntilSynced.mockResolvedValueOnce(null);

    const updateSession = vi.fn().mockResolvedValue(mockSession);
    const deps = makeDeps({ updateSession });
    await saveProfile(baseValues, deps);

    expect(updateSession).toHaveBeenCalled();
    const firstCallArg = updateSession.mock.calls[0][0] as {
      user: { isMentor?: boolean; onBoarding?: boolean };
    };
    expect(firstCallArg.user.isMentor).toBe(true);
    expect(firstCallArg.user.onBoarding).toBe(true);

    await Promise.resolve();
    await Promise.resolve();
  });

  it('isMentorOnboarding: true with mentee session → optimistic update flips isMentor/onBoarding to true', async () => {
    const menteeSession: Session = {
      ...mockSession,
      user: { ...mockSession.user!, isMentor: false, onBoarding: false },
    };
    const updateSession = vi.fn().mockResolvedValue(menteeSession);
    const deps = makeDeps({
      session: menteeSession,
      updateSession,
      isMentorOnboarding: true,
    });
    await saveProfile(baseValues, deps);

    const firstCallArg = updateSession.mock.calls[0][0] as {
      user: { isMentor?: boolean; onBoarding?: boolean };
    };
    expect(firstCallArg.user.isMentor).toBe(true);
    expect(firstCallArg.user.onBoarding).toBe(true);

    await Promise.resolve();
    await Promise.resolve();
  });

  it('isMentorOnboarding: true with mentee session → reconcile is a no-op when backend confirms is_mentor=true', async () => {
    const menteeSession: Session = {
      ...mockSession,
      user: { ...mockSession.user!, isMentor: false, onBoarding: false },
    };
    mockPollUntilSynced.mockResolvedValueOnce({
      ...mockUserDTO,
      is_mentor: true,
      onboarding: true,
    });
    const updateSession = vi.fn().mockResolvedValue(menteeSession);
    const deps = makeDeps({
      session: menteeSession,
      updateSession,
      isMentorOnboarding: true,
    });
    await saveProfile(baseValues, deps);

    await Promise.resolve();
    await Promise.resolve();

    expect(updateSession).toHaveBeenCalledTimes(1);
  });

  it('background reconcile patches session when latest disagrees with optimistic role', async () => {
    mockPollUntilSynced.mockResolvedValueOnce({
      ...mockUserDTO,
      is_mentor: false,
      onboarding: true,
    });

    const updateSession = vi.fn().mockResolvedValue(mockSession);
    const deps = makeDeps({ updateSession });
    await saveProfile(baseValues, deps);

    await Promise.resolve();
    await Promise.resolve();

    expect(updateSession).toHaveBeenCalledTimes(2);
    const reconcileArg = updateSession.mock.calls[1][0] as {
      user: { isMentor?: boolean; onBoarding?: boolean };
    };
    expect(reconcileArg.user.isMentor).toBe(false);
    expect(reconcileArg.user.onBoarding).toBe(true);
  });

  it('background reconcile is a no-op when latest matches optimistic session', async () => {
    mockPollUntilSynced.mockResolvedValueOnce({
      ...mockUserDTO,
      is_mentor: true,
      onboarding: true,
    });

    const updateSession = vi.fn().mockResolvedValue(mockSession);
    const deps = makeDeps({ updateSession });
    await saveProfile(baseValues, deps);

    await Promise.resolve();
    await Promise.resolve();

    expect(updateSession).toHaveBeenCalledTimes(1);
  });

  // ── Cache prime vs fallback ────────────────────────────────────────────────

  it('firstSyncedFetch returns dto → primeUserDataCache called, pollUntilSynced NOT called', async () => {
    mockFirstSyncedFetch.mockResolvedValueOnce(mockUserDTO);

    const customClearUserDataCache = vi.fn();
    const customPrimeUserDataCache = vi.fn();
    const deps = makeDeps({
      isMentorOnboarding: true,
      clearUserDataCache: customClearUserDataCache,
      primeUserDataCache: customPrimeUserDataCache,
    });
    await saveProfile(baseValues, deps);

    await Promise.resolve();
    await Promise.resolve();

    expect(customClearUserDataCache).toHaveBeenCalledWith(
      Number(mockSession.user!.id),
      'zh_TW'
    );
    expect(customPrimeUserDataCache).toHaveBeenCalledWith(
      Number(mockSession.user!.id),
      'zh_TW',
      mockUserDTO
    );
    expect(mockPollUntilSynced).not.toHaveBeenCalled();
  });

  it('firstSyncedFetch returns null → falls back to clearUserDataCache + pollUntilSynced', async () => {
    mockFirstSyncedFetch.mockResolvedValueOnce(null);

    const customClearUserDataCache = vi.fn();
    const customPrimeUserDataCache = vi.fn();
    const deps = makeDeps({
      isMentorOnboarding: true,
      clearUserDataCache: customClearUserDataCache,
      primeUserDataCache: customPrimeUserDataCache,
    });
    await saveProfile(baseValues, deps);

    await Promise.resolve();
    await Promise.resolve();

    expect(customPrimeUserDataCache).not.toHaveBeenCalled();
    expect(customClearUserDataCache).toHaveBeenCalledWith(
      Number(mockSession.user!.id),
      'zh_TW'
    );
    expect(mockPollUntilSynced).toHaveBeenCalled();
  });

  // ── Background avatar upload ──────────────────────────────────────────────

  it('consumeAvatarUpload, when provided, is used instead of direct updateAvatar', async () => {
    const consumed = 'https://example.com/from-bg.jpg';
    const consumeAvatarUpload = vi.fn().mockResolvedValue(consumed);

    const file = new File(['c'], 'avatar.jpg', { type: 'image/jpeg' });
    const deps = makeDeps({ consumeAvatarUpload });
    await saveProfile({ ...baseValues, avatarFile: file }, deps);

    expect(consumeAvatarUpload).toHaveBeenCalledWith(file);
    expect(mockUpdateAvatar).not.toHaveBeenCalled();
    expect(mockUpdateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ avatar: consumed })
    );

    await Promise.resolve();
    await Promise.resolve();
  });

  // ── Dirty-field skip ───────────────────────────────────────────────────────

  it('dirtyFields = {} → no PUTs fire', async () => {
    const deps = makeDeps({ dirtyFields: {} });
    await saveProfile(baseValues, deps);

    expect(mockUpdateProfile).not.toHaveBeenCalled();

    await Promise.resolve();
    await Promise.resolve();
  });

  it('isMentorOnboarding: true forces updateProfile even with empty dirtyFields', async () => {
    const deps = makeDeps({ isMentorOnboarding: true, dirtyFields: {} });
    await saveProfile(baseValues, deps);

    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);

    await Promise.resolve();
    await Promise.resolve();
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

    const deps = makeDeps();
    await saveProfile(valuesWithPrimary, deps);

    expect(mockUpdateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        job_title: 'Senior Engineer',
        company: 'Dell',
      })
    );

    await Promise.resolve();
    await Promise.resolve();
  });
});
