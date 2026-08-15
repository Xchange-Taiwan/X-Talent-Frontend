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
import { captureFlowFailure } from '@/lib/monitoring';
import {
  firstSyncedFetch,
  pollUntilSynced,
} from '@/lib/profile/pollUntilSynced';
import { ExperienceType } from '@/services/profile/experienceType';
import { updateAvatar } from '@/services/profile/updateAvatar';
import { updateProfile } from '@/services/profile/updateProfile';
import { baseValues, mockSession, mockUserDTO } from '@/test/fixtures/profile';
import type { MentorProfileVO } from '@/types/user';

import { saveProfile, SaveProfileDeps } from './saveProfile';

const mockUpdateAvatar = vi.mocked(updateAvatar);
const mockUpdateProfile = vi.mocked(updateProfile);
const mockPollUntilSynced = vi.mocked(pollUntilSynced);
const mockFirstSyncedFetch = vi.mocked(firstSyncedFetch);
const mockSetAvatarOverride = vi.mocked(setAvatarOverride);
const mockCaptureFlowFailure = vi.mocked(captureFlowFailure);

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
  const arg = lastCall[1] as { experiences?: unknown[] };
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
      'test-user-id',
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

  it('isMentorOnboarding: false → deps.navigate("/profile/:pageUserId"), and both revalidateProfilePath & updateSession are called before navigate', async () => {
    const navigate = vi.fn();
    const revalidateProfilePath = vi.fn().mockResolvedValue(undefined);
    const updateSession = vi.fn().mockResolvedValue(mockSession);
    const deps = makeDeps({
      isMentorOnboarding: false,
      navigate,
      revalidateProfilePath,
      updateSession,
    });
    await saveProfile(baseValues, deps);

    expect(navigate).toHaveBeenCalledWith('/profile/test-user-id');
    expect(revalidateProfilePath).toHaveBeenCalledWith('test-user-id');
    expect(updateSession).toHaveBeenCalled();

    const navigateCallIndex = navigate.mock.invocationCallOrder[0];

    // Assert that revalidateProfilePath was invoked before navigate
    const revalidateCallIndex =
      revalidateProfilePath.mock.invocationCallOrder[0];
    expect(revalidateCallIndex).toBeLessThan(navigateCallIndex);

    // Assert that updateSession was invoked and completed before navigate
    const updateSessionCallIndex = updateSession.mock.invocationCallOrder[0];
    expect(updateSessionCallIndex).toBeLessThan(navigateCallIndex);

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

  // ── Post-sync revalidate (mentor-pool ISR race) ─────────────────────────────

  it('background sync confirms latest → revalidateProfilePath is called again (post-sync)', async () => {
    mockFirstSyncedFetch.mockResolvedValueOnce(null);
    mockPollUntilSynced.mockResolvedValueOnce(mockUserDTO);

    const revalidateProfilePath = vi.fn().mockResolvedValue(undefined);
    const deps = makeDeps({ revalidateProfilePath });
    await saveProfile(baseValues, deps);

    await vi.waitFor(() => {
      expect(revalidateProfilePath).toHaveBeenCalledTimes(2);
    });
    expect(revalidateProfilePath).toHaveBeenNthCalledWith(1, 'test-user-id');
    expect(revalidateProfilePath).toHaveBeenNthCalledWith(2, 'test-user-id');
  });

  it('background sync never confirms (poll exhausted, latest stays null) → revalidateProfilePath is NOT called again', async () => {
    mockFirstSyncedFetch.mockResolvedValueOnce(null);
    mockPollUntilSynced.mockResolvedValueOnce(null);

    const revalidateProfilePath = vi.fn().mockResolvedValue(undefined);
    const deps = makeDeps({ revalidateProfilePath });
    await saveProfile(baseValues, deps);

    await Promise.resolve();
    await Promise.resolve();

    expect(revalidateProfilePath).toHaveBeenCalledTimes(1);
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
      'test-user-id',
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
      'test-user-id',
      expect.objectContaining({
        job_title: 'Senior Engineer',
        company: 'Dell',
      })
    );

    await Promise.resolve();
    await Promise.resolve();
  });

  // ── Background task failure handling ───────────────────────────────────────

  it('background reconciliation failure (firstSyncedFetch throws) → quietly caught and logged', async () => {
    mockFirstSyncedFetch.mockRejectedValueOnce(new Error('Sync fetch failed'));

    const deps = makeDeps({
      session: {
        ...mockSession,
        user: { ...mockSession.user!, id: '1' },
      },
    });
    await saveProfile(baseValues, deps);

    // Let background IIFE task execute
    await Promise.resolve();
    await Promise.resolve();

    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'profile_update',
        step: 'background_reconcile',
        message: 'Error: Sync fetch failed',
      })
    );
  });

  it('background reconciliation failure (pollUntilSynced throws) → quietly caught and logged', async () => {
    mockFirstSyncedFetch.mockResolvedValueOnce(null);
    mockPollUntilSynced.mockRejectedValueOnce(new Error('Polling failed'));

    const deps = makeDeps({
      session: {
        ...mockSession,
        user: { ...mockSession.user!, id: '1' },
      },
    });
    await saveProfile(baseValues, deps);

    // Let background IIFE task execute
    await Promise.resolve();
    await Promise.resolve();

    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'profile_update',
        step: 'background_reconcile',
        message: 'Error: Polling failed',
      })
    );
  });

  // ── Fault Tolerance for non-blocking secondary operations ──────────────────

  it('revalidateProfilePath throws → does not block saveProfile main flow or navigation', async () => {
    const navigate = vi.fn();
    const revalidateProfilePath = vi
      .fn()
      .mockRejectedValueOnce(new Error('Revalidate failed'));
    const deps = makeDeps({ navigate, revalidateProfilePath });

    await expect(saveProfile(baseValues, deps)).resolves.not.toThrow();

    expect(navigate).toHaveBeenCalledWith('/profile/test-user-id');

    await Promise.resolve();
    await Promise.resolve();
  });

  it('updateSession throws → does not block saveProfile main flow or navigation', async () => {
    const navigate = vi.fn();
    const updateSession = vi
      .fn()
      .mockRejectedValueOnce(new Error('Update session failed'));
    const deps = makeDeps({ navigate, updateSession });

    await expect(saveProfile(baseValues, deps)).resolves.not.toThrow();

    expect(navigate).toHaveBeenCalledWith('/profile/test-user-id');

    await Promise.resolve();
    await Promise.resolve();
  });

  // ── Session User ID vs Page User ID Fallback ──────────────────────────────

  it('saveProfile passes sessionUserId to firstSyncedFetch and pollUntilSynced', async () => {
    mockFirstSyncedFetch.mockResolvedValueOnce(null);
    mockPollUntilSynced.mockResolvedValueOnce(mockUserDTO);

    const deps = makeDeps({
      session: {
        user: {
          id: '88',
          name: 'Sync Test User',
          email: 'test@example.com',
          image: '',
        },
        expires: '',
      },
    });

    await saveProfile(baseValues, deps);

    await vi.waitFor(() => {
      expect(mockFirstSyncedFetch).toHaveBeenCalledWith(
        88,
        expect.any(Object),
        expect.any(String)
      );
      expect(mockPollUntilSynced).toHaveBeenCalledWith(
        88,
        expect.any(Object),
        expect.any(String)
      );
    });
  });

  it('saveProfile falls back to pageUserId as number when sessionUserId is not available', async () => {
    mockFirstSyncedFetch.mockResolvedValueOnce(null);
    mockPollUntilSynced.mockResolvedValueOnce(mockUserDTO);

    const deps = makeDeps({
      session: null, // sessionUserId is null
      pageUserId: '99', // fallback should be 99
    });

    await saveProfile(baseValues, deps);

    await vi.waitFor(() => {
      expect(mockFirstSyncedFetch).not.toHaveBeenCalled();
      expect(mockPollUntilSynced).toHaveBeenCalledWith(
        99,
        expect.any(Object),
        expect.any(String)
      );
    });
  });
});
