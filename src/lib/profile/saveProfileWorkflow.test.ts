import { Session } from 'next-auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultValues } from '@/schemas/profileSchema';
import { updateAvatar } from '@/services/profile/updateAvatar';
import { updateProfile } from '@/services/profile/updateProfile';

import { saveProfileWorkflow } from './saveProfileWorkflow';

vi.mock('@/services/profile/updateProfile', () => ({
  updateProfile: vi.fn(),
}));

vi.mock('@/services/profile/updateAvatar', () => ({
  updateAvatar: vi.fn(),
}));

vi.mock('@/lib/monitoring', () => ({
  captureFlowFailure: vi.fn(),
}));

vi.mock('@/app/profile/[pageUserId]/actions', () => ({
  revalidateProfilePath: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/hooks/user/user-data/useUserData', () => ({
  clearUserDataCache: vi.fn(),
  primeUserDataCache: vi.fn(),
}));

vi.mock('@/lib/avatar/avatarOverrideStore', () => ({
  setAvatarOverride: vi.fn(),
}));

vi.mock('@/lib/profile/pollUntilSynced', () => ({
  firstSyncedFetch: vi.fn().mockResolvedValue(null),
  pollUntilSynced: vi.fn().mockResolvedValue(null),
}));

const mockUpdateProfile = vi.mocked(updateProfile);
const mockUpdateAvatar = vi.mocked(updateAvatar);

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

describe('saveProfileWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully run the profile update workflow', async () => {
    mockUpdateProfile.mockResolvedValueOnce(undefined as unknown as void);
    const updateSession = vi.fn().mockResolvedValue(mockSession);

    const result = await saveProfileWorkflow(
      baseValues,
      {
        pageUserId: 'test-user',
        isMentorOnboarding: false,
        session: mockSession,
      },
      {
        updateSession,
      }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings).toEqual([]);
    }
    expect(mockUpdateProfile).toHaveBeenCalled();
    expect(updateSession).toHaveBeenCalled();
  });

  it('should handle avatar upload failure and return error step', async () => {
    const error = new Error('Upload error');
    mockUpdateAvatar.mockRejectedValueOnce(error);
    const updateSession = vi.fn().mockResolvedValue(mockSession);

    const result = await saveProfileWorkflow(
      { ...baseValues, avatarFile: new File([], 'avatar.png') },
      {
        pageUserId: 'test-user',
        isMentorOnboarding: false,
        session: mockSession,
      },
      {
        updateSession,
      }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.step).toBe('avatar_upload');
      expect(result.error).toBe(error);
    }
  });

  it('should handle profile write failure and return error step', async () => {
    const error = new Error('Database error');
    mockUpdateProfile.mockRejectedValueOnce(error);
    const updateSession = vi.fn().mockResolvedValue(mockSession);

    const result = await saveProfileWorkflow(
      baseValues,
      {
        pageUserId: 'test-user',
        isMentorOnboarding: false,
        session: mockSession,
      },
      {
        updateSession,
      }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.step).toBe('profile_write');
      expect(result.error).toBe(error);
    }
  });

  it('should continue on soft errors and return warnings (DI test)', async () => {
    mockUpdateProfile.mockResolvedValueOnce(undefined as unknown as void);
    const updateSession = vi
      .fn()
      .mockRejectedValue(new Error('Session save failed'));
    const revalidateProfilePath = vi
      .fn()
      .mockRejectedValue(new Error('Revalidate failed'));

    const result = await saveProfileWorkflow(
      baseValues,
      {
        pageUserId: 'test-user',
        isMentorOnboarding: false,
        session: mockSession,
      },
      {
        updateSession,
        revalidateProfilePath,
      }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings).toContain('Session save failed');
      expect(result.warnings).toContain('Revalidate failed');
    }
  });

  it('should run background reconcile and update session when synced state disagrees (DI test)', async () => {
    mockUpdateProfile.mockResolvedValueOnce(undefined as unknown as void);

    let resolveReconcile: (value: unknown) => void = () => {};
    const reconcilePromise = new Promise((resolve) => {
      resolveReconcile = resolve;
    });

    let callCount = 0;
    const updateSession = vi.fn().mockImplementation(async (data: unknown) => {
      callCount++;
      if (callCount === 2) {
        resolveReconcile(data);
      }
      return mockSession;
    });

    const syncedDTO = {
      user_id: 1,
      is_mentor: false, // Disagrees with optimistic isMentor: true
      onboarding: true,
    };
    const firstSyncedFetch = vi.fn().mockResolvedValue(syncedDTO);

    const result = await saveProfileWorkflow(
      baseValues,
      {
        pageUserId: 'test-user',
        isMentorOnboarding: true, // Optimistic isMentor: true, onboarding: true
        session: mockSession,
      },
      {
        updateSession,
        firstSyncedFetch,
      }
    );

    expect(result.ok).toBe(true);

    const reconcileData = await reconcilePromise;
    expect(updateSession).toHaveBeenCalledTimes(2);
    expect(reconcileData).toEqual({
      user: {
        isMentor: false,
        onBoarding: true,
      },
    });
  });
});
