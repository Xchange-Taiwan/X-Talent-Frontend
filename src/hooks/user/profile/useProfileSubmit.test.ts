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

vi.mock('@/lib/profile/saveProfile', () => ({
  saveProfile: vi.fn(),
}));

vi.mock('@/lib/monitoring', () => ({
  captureFlowFailure: vi.fn(),
}));

import { captureFlowFailure } from '@/lib/monitoring';
import { saveProfile } from '@/lib/profile/saveProfile';
import { defaultValues } from '@/schemas/profileSchema';
import { mockToast } from '@/test/mocks/useToast';

import { useProfileSubmit } from './useProfileSubmit';

const mockSaveProfile = vi.mocked(saveProfile);
const mockCaptureFlowFailure = vi.mocked(captureFlowFailure);

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
  onScrollToError: vi.fn(),
  consumeAvatarUpload: vi.fn(),
  ...overrides,
});

describe('useProfileSubmit (Hook Layer)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('jobSectionError: true → returns early, onScrollToError is called, and saveProfile is NOT called', async () => {
    const onScrollToError = vi.fn();
    const { result } = renderHook(() =>
      useProfileSubmit(makeOptions({ jobSectionError: true, onScrollToError }))
    );

    await act(async () => {
      await result.current.onSubmit(baseValues);
    });

    expect(onScrollToError).toHaveBeenCalledWith('work_experiences');
    expect(mockSaveProfile).not.toHaveBeenCalled();
  });

  it('educationSectionError: true → returns early, onScrollToError is called, and saveProfile is NOT called', async () => {
    const onScrollToError = vi.fn();
    const { result } = renderHook(() =>
      useProfileSubmit(
        makeOptions({ educationSectionError: true, onScrollToError })
      )
    );

    await act(async () => {
      await result.current.onSubmit(baseValues);
    });

    expect(onScrollToError).toHaveBeenCalledWith('educations');
    expect(mockSaveProfile).not.toHaveBeenCalled();
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

  it('saveProfile throws → error is caught, captureFlowFailure reports unexpected error to Sentry, toast is called, and isSaving becomes false', async () => {
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
        step: 'unexpected',
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
});
