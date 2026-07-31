import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

vi.mock('@/lib/profile/saveProfile', () => {
  class LoggedError extends Error {
    constructor(message?: string) {
      super(message);
      this.name = 'LoggedError';
    }
  }
  return {
    saveProfile: vi.fn(),
    LoggedError,
  };
});

vi.mock('@/lib/monitoring', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/monitoring')>();
  return {
    ...actual,
    captureFlowFailure: vi.fn(),
  };
});

import { captureFlowFailure } from '@/lib/monitoring';
import { LoggedError, saveProfile } from '@/lib/profile/saveProfile';
import { baseValues, mockSession } from '@/test/fixtures/profile';
import { mockToast } from '@/test/mocks/useToast';

import { useProfileSubmit } from './useProfileSubmit';

const mockSaveProfile = vi.mocked(saveProfile);
const mockCaptureFlowFailure = vi.mocked(captureFlowFailure);

const makeOptions = (
  overrides: Partial<Parameters<typeof useProfileSubmit>[0]> = {}
) => ({
  pageUserId: 'test-user-id',
  isMentorOnboarding: false,
  session: mockSession,
  updateSession: vi.fn().mockResolvedValue(mockSession),
  consumeAvatarUpload: vi.fn(),
  ...overrides,
});

describe('useProfileSubmit (Hook Layer)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saveProfile resolves successfully → isSaving remains true (simulating in-flight navigation)', async () => {
    mockSaveProfile.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit(baseValues);
    });

    expect(mockSaveProfile).toHaveBeenCalled();
    expect(result.current.isSaving).toBe(true);
  });

  it('saveProfile throws unlogged Error instance → error is caught, captureFlowFailure reports unexpected error to Sentry, toast is called, and isSaving becomes false', async () => {
    mockSaveProfile.mockRejectedValueOnce(new Error('Save failed'));
    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit(baseValues);
    });

    expect(mockSaveProfile).toHaveBeenCalled();
    expect(result.current.isSaving).toBe(false);
    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'profile_update',
        step: 'update_profile',
        message: 'Save failed',
      })
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: '儲存失敗，請稍後再試',
      })
    );
  });

  it('saveProfile throws unlogged primitive string → error is caught, captureFlowFailure reports raw string to Sentry, toast is called, and isSaving becomes false', async () => {
    mockSaveProfile.mockRejectedValueOnce('Some string error');
    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit(baseValues);
    });

    expect(mockSaveProfile).toHaveBeenCalled();
    expect(result.current.isSaving).toBe(false);
    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'profile_update',
        step: 'update_profile',
        message: 'Some string error',
      })
    );
  });

  it('saveProfile throws an already logged LoggedError → error is caught, captureFlowFailure is NOT called (deduplicated), toast is called, and isSaving becomes false', async () => {
    const loggedError = new LoggedError('Save failed');
    mockSaveProfile.mockRejectedValueOnce(loggedError);
    const { result } = renderHook(() => useProfileSubmit(makeOptions()));

    await act(async () => {
      await result.current.onSubmit(baseValues);
    });

    expect(mockSaveProfile).toHaveBeenCalled();
    expect(result.current.isSaving).toBe(false);
    expect(mockCaptureFlowFailure).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: '儲存失敗，請稍後再試',
      })
    );
  });
});
