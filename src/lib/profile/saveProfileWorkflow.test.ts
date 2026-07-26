import { Session } from 'next-auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultValues } from '@/schemas/profileSchema';
import { MentorProfileVO } from '@/services/profile/user';

import { SaveProfileDeps, saveProfileWorkflow } from './saveProfileWorkflow';

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

const makeMockDeps = (
  overrides: Partial<SaveProfileDeps> = {}
): SaveProfileDeps => ({
  updateSession: vi.fn().mockResolvedValue(mockSession),
  updateProfile: vi.fn().mockResolvedValue(undefined),
  updateAvatar: vi.fn().mockResolvedValue('https://example.com/new-avatar.jpg'),
  revalidateProfilePath: vi.fn().mockResolvedValue(undefined),
  clearUserDataCache: vi.fn(),
  primeUserDataCache: vi.fn(),
  setAvatarOverride: vi.fn(),
  firstSyncedFetch: vi.fn().mockResolvedValue(null),
  pollUntilSynced: vi.fn().mockResolvedValue(null),
  captureFlowFailure: vi.fn(),
  ...overrides,
});

describe('saveProfileWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully run the profile update workflow', async () => {
    const deps = makeMockDeps();

    const result = await saveProfileWorkflow(
      baseValues,
      {
        pageUserId: 'test-user',
        isMentorOnboarding: false,
        session: mockSession,
      },
      deps
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings).toEqual([]);
    }
    expect(deps.updateProfile).toHaveBeenCalled();
    expect(deps.updateSession).toHaveBeenCalled();
  });

  it('should handle avatar upload failure and return error step', async () => {
    const error = new Error('Upload error');
    const deps = makeMockDeps({
      updateAvatar: vi.fn().mockRejectedValue(error),
    });

    const result = await saveProfileWorkflow(
      { ...baseValues, avatarFile: new File([], 'avatar.png') },
      {
        pageUserId: 'test-user',
        isMentorOnboarding: false,
        session: mockSession,
      },
      deps
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.step).toBe('avatar_upload');
      expect(result.error).toBe(error);
    }
    expect(deps.captureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        step: 'avatar_upload',
      })
    );
  });

  it('should handle profile write failure and return error step', async () => {
    const error = new Error('Database error');
    const deps = makeMockDeps({
      updateProfile: vi.fn().mockRejectedValue(error),
    });

    const result = await saveProfileWorkflow(
      baseValues,
      {
        pageUserId: 'test-user',
        isMentorOnboarding: false,
        session: mockSession,
      },
      deps
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.step).toBe('profile_write');
      expect(result.error).toBe(error);
    }
    expect(deps.captureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        step: 'profile_write',
      })
    );
  });

  it('should continue on soft errors and return warnings (DI test)', async () => {
    const deps = makeMockDeps({
      updateSession: vi
        .fn()
        .mockRejectedValue(new Error('Session save failed')),
      revalidateProfilePath: vi
        .fn()
        .mockRejectedValue(new Error('Revalidate failed')),
    });

    const result = await saveProfileWorkflow(
      baseValues,
      {
        pageUserId: 'test-user',
        isMentorOnboarding: false,
        session: mockSession,
      },
      deps
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings).toContain('Session save failed');
      expect(result.warnings).toContain('Revalidate failed');
    }
  });

  it('should run background reconcile and update session when synced state disagrees (DI test)', async () => {
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
    } as unknown as MentorProfileVO;
    const firstSyncedFetch = vi.fn().mockResolvedValue(syncedDTO);

    const deps = makeMockDeps({
      updateSession,
      firstSyncedFetch,
    });

    const result = await saveProfileWorkflow(
      baseValues,
      {
        pageUserId: 'test-user',
        isMentorOnboarding: true, // Optimistic isMentor: true, onboarding: true
        session: mockSession,
      },
      deps
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

  it('should robustly handle exceptions in fire-and-forget background sync task without crash (DI test)', async () => {
    const firstSyncedFetch = vi
      .fn()
      .mockRejectedValue(new Error('Background fetch crashed'));
    const pollUntilSynced = vi
      .fn()
      .mockRejectedValue(new Error('Background poll crashed'));
    const updateSession = vi.fn().mockResolvedValue(mockSession);

    const deps = makeMockDeps({
      updateSession,
      firstSyncedFetch,
      pollUntilSynced,
    });

    const result = await saveProfileWorkflow(
      baseValues,
      {
        pageUserId: 'test-user',
        isMentorOnboarding: false,
        session: mockSession,
      },
      deps
    );

    expect(result.ok).toBe(true); // Outer workflow must succeed and not be disrupted by fire-and-forget background failure

    // Allow the microtasks of fire-and-forget background async task to execute
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Reconcile or session shouldn't be updated on crashed sync fetch
    expect(updateSession).toHaveBeenCalledTimes(1); // Only optimistic update is called
  });
});
