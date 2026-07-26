import { act, renderHook } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useOnboardingSubmit } from '@/hooks/user/onboarding/useOnboardingSubmit';
import { useBackgroundAvatarUpload } from '@/hooks/user/profile/useBackgroundAvatarUpload';
import { trackEvent } from '@/lib/analytics';

import { useOnboardingForm } from './useOnboardingForm';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}));

vi.mock('@/hooks/user/onboarding/useOnboardingSubmit', () => ({
  useOnboardingSubmit: vi.fn(),
}));

vi.mock('@/hooks/user/profile/useBackgroundAvatarUpload', () => ({
  useBackgroundAvatarUpload: vi.fn(),
}));

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

const mockUseRouter = vi.mocked(useRouter);
const mockUseSession = vi.mocked(useSession);
const mockUseOnboardingSubmit = vi.mocked(useOnboardingSubmit);
const mockUseBackgroundAvatarUpload = vi.mocked(useBackgroundAvatarUpload);
const mockTrackEvent = vi.mocked(trackEvent);

describe('useOnboardingForm', () => {
  const mockPush = vi.fn();
  const mockSubmitProfile = vi.fn();
  const mockKickOff = vi.fn();
  const mockConsume = vi.fn();
  const mockRollback = vi.fn();
  const mockAbort = vi.fn();

  const mockIndustries = [] as any;

  beforeEach(() => {
    vi.resetAllMocks();

    mockUseRouter.mockReturnValue({ push: mockPush } as any);
    mockUseSession.mockReturnValue({
      data: { user: { name: 'John Doe', avatar: '' } },
      status: 'authenticated',
    } as any);

    mockUseOnboardingSubmit.mockReturnValue({
      submitProfile: mockSubmitProfile,
      isSubmitting: false,
    } as any);

    mockUseBackgroundAvatarUpload.mockReturnValue({
      kickOff: mockKickOff,
      consume: mockConsume,
      rollback: mockRollback,
      abort: mockAbort,
    } as any);
  });

  it('should initialize at Step 1 and allow step-by-step submission accumulating tempData', async () => {
    const { result } = renderHook(() =>
      useOnboardingForm({ industries: mockIndustries })
    );

    expect(result.current.currentStep).toBe(1);

    // Step 1 Submit
    await act(async () => {
      result.current.onSubmitStep1({
        name: 'John Doe',
        avatar: '',
        language: 'zh_TW',
      });
    });

    expect(result.current.currentStep).toBe(2);
    expect(mockTrackEvent).toHaveBeenCalledWith({
      name: 'onboarding_step_1_completed',
      feature: 'onboarding',
    });

    // Step 2 Submit
    await act(async () => {
      result.current.onSubmitStep2({
        location: 'TWN',
        years_of_experience: '1_3',
        industry: 'TECH',
      });
    });

    expect(result.current.currentStep).toBe(3);
    expect(mockTrackEvent).toHaveBeenCalledWith({
      name: 'onboarding_step_2_completed',
      feature: 'onboarding',
    });

    // Step 3 Submit
    await act(async () => {
      result.current.onSubmitStep3({
        want_position: ['position1'],
      });
    });

    expect(result.current.currentStep).toBe(4);
    expect(mockTrackEvent).toHaveBeenCalledWith({
      name: 'onboarding_step_3_completed',
      feature: 'onboarding',
    });

    // Step 4 Submit
    await act(async () => {
      result.current.onSubmitStep4({
        want_skill: ['skill1'],
      });
    });

    expect(result.current.currentStep).toBe(5);
    expect(mockTrackEvent).toHaveBeenCalledWith({
      name: 'onboarding_step_4_completed',
      feature: 'onboarding',
    });

    // Back to Step 4
    await act(async () => {
      result.current.handleGoToPrev();
    });

    expect(result.current.currentStep).toBe(4);
  });

  it('should kickOff avatar upload if avatarFile is present in Step 1, or abort if not', async () => {
    const { result } = renderHook(() =>
      useOnboardingForm({ industries: mockIndustries })
    );

    // No avatarFile
    await act(async () => {
      result.current.onSubmitStep1({
        name: 'John Doe',
        avatar: '',
        language: 'zh_TW',
      });
    });

    expect(mockAbort).toHaveBeenCalled();
    expect(mockKickOff).not.toHaveBeenCalled();

    // With avatarFile
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    await act(async () => {
      result.current.onSubmitStep1({
        name: 'John Doe',
        avatar: '',
        avatarFile: file,
        language: 'zh_TW',
      });
    });

    expect(mockKickOff).toHaveBeenCalledWith(file, '');
  });

  it('should successfully submit Step 5, consuming avatar and submitting profile', async () => {
    const { result } = renderHook(() =>
      useOnboardingForm({ industries: mockIndustries })
    );

    // Prepare steps 1 to 4 data
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    await act(async () => {
      result.current.onSubmitStep1({
        name: 'John Doe',
        avatar: '',
        avatarFile: file,
        language: 'zh_TW',
      });
      result.current.onSubmitStep2({
        location: 'TWN',
        years_of_experience: '1_3',
        industry: 'TECH',
      });
      result.current.onSubmitStep3({ want_position: ['pos1'] });
      result.current.onSubmitStep4({ want_skill: ['skill1'] });
    });

    mockConsume.mockResolvedValue('https://s3.amazonaws.com/new-avatar.png');
    mockSubmitProfile.mockResolvedValue({} as any);

    // Step 5 submit
    await act(async () => {
      await result.current.onSubmitStep5({ want_topic: ['topic1'] });
    });

    expect(mockConsume).toHaveBeenCalledWith(file);
    expect(mockSubmitProfile).toHaveBeenCalledWith(
      {
        name: 'John Doe',
        avatar: 'https://s3.amazonaws.com/new-avatar.png',
        avatarFile: undefined,
        language: 'zh_TW',
        location: 'TWN',
        years_of_experience: '1_3',
        industry: 'TECH',
        want_position: ['pos1'],
        want_skill: ['skill1'],
        want_topic: ['topic1'],
      },
      true
    );
    expect(mockTrackEvent).toHaveBeenCalledWith({
      name: 'onboarding_completed',
      feature: 'onboarding',
    });
    expect(mockPush).toHaveBeenCalledWith('/profile/card');
  });

  it('should handle avatar upload failure on Step 5, aborting, setting error, and redirecting to Step 1', async () => {
    const { result } = renderHook(() =>
      useOnboardingForm({ industries: mockIndustries })
    );

    // Prepare steps 1 to 4 data
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    await act(async () => {
      result.current.onSubmitStep1({
        name: 'John Doe',
        avatar: '',
        avatarFile: file,
        language: 'zh_TW',
      });
      result.current.onSubmitStep2({
        location: 'TWN',
        years_of_experience: '1_3',
        industry: 'TECH',
      });
      result.current.onSubmitStep3({ want_position: ['pos1'] });
      result.current.onSubmitStep4({ want_skill: ['skill1'] });
    });

    // Mock upload failure
    mockConsume.mockRejectedValue(new Error('S3 upload error'));

    // Step 5 submit
    await act(async () => {
      await result.current.onSubmitStep5({ want_topic: ['topic1'] });
    });

    expect(mockConsume).toHaveBeenCalledWith(file);
    expect(mockAbort).toHaveBeenCalled();
    expect(result.current.step1Form.formState.errors.avatarFile?.message).toBe(
      '頭像上傳失敗，請重新選擇。'
    );
    expect(result.current.currentStep).toBe(1);
    expect(mockSubmitProfile).not.toHaveBeenCalled();
  });
});
