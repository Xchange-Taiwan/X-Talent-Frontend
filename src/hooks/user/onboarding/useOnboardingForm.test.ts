import { act, renderHook } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useToast } from '@/components/ui/use-toast';
import { useBackgroundAvatarUpload } from '@/hooks/user/profile/useBackgroundAvatarUpload';
import { trackEvent } from '@/lib/analytics';
import {
  getPendingFavoriteMentorId,
  savePendingFavoriteMentor,
} from '@/lib/favorites';
import type { ProfileSavePort } from '@/lib/profile/saveProfile';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';
import type { MentorProfileVO } from '@/types/user';

import { STEP_FIELDS, useOnboardingForm } from './useOnboardingForm';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: vi.fn(),
}));

vi.mock('@/hooks/user/profile/useBackgroundAvatarUpload', () => ({
  useBackgroundAvatarUpload: vi.fn(),
}));

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

const mockUseRouter = vi.mocked(useRouter);
const mockUseSession = vi.mocked(useSession);
const mockUseBackgroundAvatarUpload = vi.mocked(useBackgroundAvatarUpload);
const mockTrackEvent = vi.mocked(trackEvent);
const mockUseToast = vi.mocked(useToast);

describe('useOnboardingForm (single-form + commitProfileMutation #905)', () => {
  const mockPush = vi.fn();
  const mockUpdateSession = vi.fn().mockResolvedValue(null);
  const mockWriteProfile = vi.fn().mockResolvedValue(undefined);
  const mockFetchProfile = vi.fn().mockResolvedValue(null);
  const mockRevalidate = vi.fn().mockResolvedValue(undefined);
  const mockKickOff = vi.fn();
  const mockConsume = vi.fn();
  const mockRollback = vi.fn();
  const mockAbort = vi.fn();
  const mockPrefetch = vi.fn();
  const mockToast = vi.fn();

  const mockIndustries: TagCatalogsByBucket['industry'] = [
    { subject_group: 'TECH', subject: '科技與軟體' },
  ];

  function buildPort(): ProfileSavePort {
    return {
      writeProfile: mockWriteProfile,
      fetchProfile: mockFetchProfile,
      updateSession: mockUpdateSession,
      revalidateProfilePath: mockRevalidate,
      navigate: mockPush,
    };
  }

  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.clear();

    mockUpdateSession.mockResolvedValue(null);
    mockWriteProfile.mockResolvedValue(undefined);
    mockFetchProfile.mockResolvedValue(
      fromPartial<MentorProfileVO>({
        user_id: 1,
        name: 'John Doe',
        is_mentor: false,
        onboarding: true,
      })
    );
    mockRevalidate.mockResolvedValue(undefined);

    mockUseRouter.mockReturnValue({ push: mockPush } as unknown as ReturnType<
      typeof useRouter
    >);
    mockUseSession.mockReturnValue({
      data: { user: { id: '1', name: 'John Doe', avatar: '' } },
      status: 'authenticated',
      update: mockUpdateSession,
    } as unknown as ReturnType<typeof useSession>);

    mockUseBackgroundAvatarUpload.mockReturnValue({
      kickOff: mockKickOff,
      consume: mockConsume,
      rollback: mockRollback,
      abort: mockAbort,
      prefetch: mockPrefetch,
    });

    mockUseToast.mockReturnValue({
      toast: mockToast,
      toasts: [],
      dismiss: vi.fn(),
    });
  });

  it('validates STEP_FIELDS per step on a single useForm<OnboardingFormValues> and advances/rewinds cleanly', async () => {
    expect(Object.keys(STEP_FIELDS)).toEqual(['1', '2', '3', '4', '5']);

    const { result } = renderHook(() =>
      useOnboardingForm({ industries: mockIndustries, port: buildPort() })
    );

    expect(mockUseBackgroundAvatarUpload).toHaveBeenCalledWith(1);
    expect(result.current.currentStep).toBe(1);

    // Step 1 valid (hydrated from session name 'John Doe') -> advances to Step 2
    let step1Ok = false;
    await act(async () => {
      step1Ok = await result.current.advanceStep();
    });
    expect(step1Ok).toBe(true);
    expect(result.current.currentStep).toBe(2);
    expect(mockTrackEvent).toHaveBeenCalledWith({
      name: 'onboarding_step_1_completed',
      feature: 'onboarding',
    });

    // Step 2 invalid when years_of_experience is empty -> stays on Step 2
    let step2Invalid = true;
    await act(async () => {
      step2Invalid = await result.current.advanceStep();
    });
    expect(step2Invalid).toBe(false);
    expect(result.current.currentStep).toBe(2);

    // Fill Step 2 -> advances to Step 3
    act(() => {
      result.current.form.setValue('years_of_experience', '1_3');
      result.current.form.setValue('industry', 'TECH');
    });
    await act(async () => {
      await result.current.advanceStep();
    });
    expect(result.current.currentStep).toBe(3);

    // Fill Step 3 & Step 4 -> advances to Step 5, then rewind to Step 4 preserving single-form state
    act(() => {
      result.current.form.setValue('want_position', ['pos1']);
    });
    await act(async () => {
      await result.current.advanceStep();
    });
    act(() => {
      result.current.form.setValue('want_skill', ['skill1']);
    });
    await act(async () => {
      await result.current.advanceStep();
    });
    expect(result.current.currentStep).toBe(5);

    act(() => {
      result.current.handleGoToPrev();
    });
    expect(result.current.currentStep).toBe(4);
    expect(result.current.form.getValues('want_position')).toEqual(['pos1']);
  });

  it('kicks off background avatar upload on Step 1 when avatarFile is present, or aborts when absent', async () => {
    const { result } = renderHook(() =>
      useOnboardingForm({ industries: mockIndustries, port: buildPort() })
    );

    await act(async () => {
      await result.current.advanceStep();
    });
    expect(mockAbort).toHaveBeenCalled();
    expect(mockKickOff).not.toHaveBeenCalled();

    act(() => {
      result.current.handleGoToPrev();
    });
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    act(() => {
      result.current.form.setValue('avatarFile', file);
    });
    await act(async () => {
      await result.current.advanceStep();
    });
    expect(mockKickOff).toHaveBeenCalledWith(file, '');
  });

  it('commits mentee-onboarding via commitProfileMutation on Step 5, consuming avatar once and redirecting to pendingFavoriteMentor when present', async () => {
    savePendingFavoriteMentor(7482008160728084);
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    mockConsume.mockResolvedValue(
      'https://s3.amazonaws.com/new-avatar.png?v=100'
    );

    const { result } = renderHook(() =>
      useOnboardingForm({ industries: mockIndustries, port: buildPort() })
    );

    act(() => {
      result.current.form.reset({
        name: 'John Doe',
        avatar: '',
        avatarFile: file,
        language: 'zh_TW',
        location: 'TWN',
        years_of_experience: '1_3',
        industry: 'TECH',
        want_position: ['pos1'],
        want_skill: ['skill1'],
        want_topic: ['topic1'],
      });
    });

    await act(async () => {
      await result.current.submitOnboarding();
    });

    expect(mockConsume).toHaveBeenCalledWith(file);
    expect(mockWriteProfile).toHaveBeenCalledWith('1', {
      name: 'John Doe',
      avatar: 'https://s3.amazonaws.com/new-avatar.png?v=100',
      location: 'TWN',
      years_of_experience: '1_3',
      industry: 'TECH',
      language: 'zh_TW',
      is_mentor: false,
      onboarding: true,
      about: '',
      personal_statement: '',
      want_position: ['pos1'],
      want_skill: ['skill1'],
      want_topic: ['topic1'],
    });
    expect(mockRevalidate).toHaveBeenCalledWith('1');
    expect(mockPush).toHaveBeenCalledWith('/profile/7482008160728084');
    expect(getPendingFavoriteMentorId()).toBe(7482008160728084);
  });

  it('handles avatar upload failure on Step 5 by setting avatarFile error and returning to Step 1, and avoids re-consuming on write retry', async () => {
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    mockConsume.mockRejectedValueOnce(new Error('S3 error'));

    const { result } = renderHook(() => {
      const s = useOnboardingForm({
        industries: mockIndustries,
        port: buildPort(),
      });
      void s.form.formState.errors;
      return s;
    });

    act(() => {
      result.current.form.reset({
        name: 'John Doe',
        avatar: '',
        avatarFile: file,
        language: 'zh_TW',
        location: 'TWN',
        years_of_experience: '1_3',
        industry: 'TECH',
        want_position: ['pos1'],
        want_skill: ['skill1'],
        want_topic: ['topic1'],
      });
    });

    await act(async () => {
      await result.current.submitOnboarding();
    });

    expect(result.current.currentStep).toBe(1);
    expect(result.current.form.formState.errors.avatarFile?.message).toBe(
      '頭像上傳失敗，請重新選擇。'
    );
    expect(mockWriteProfile).not.toHaveBeenCalled();

    // Retry path where consume succeeds once and writeProfile fails once, then retry succeeds without re-consuming
    act(() => {
      result.current.form.setValue('avatarFile', file);
    });
    mockConsume.mockResolvedValueOnce('https://s3.amazonaws.com/ok.png?v=2');
    mockWriteProfile.mockRejectedValueOnce(new Error('500 Write Error'));

    await act(async () => {
      await result.current.submitOnboarding();
    });
    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      description: '儲存失敗，請稍後再試。',
      duration: 5000,
    });
    expect(mockConsume).toHaveBeenCalledTimes(2);

    mockConsume.mockClear();
    mockWriteProfile.mockResolvedValueOnce(undefined);

    await act(async () => {
      await result.current.submitOnboarding();
    });
    expect(mockConsume).not.toHaveBeenCalled();
    expect(mockWriteProfile).toHaveBeenCalledTimes(2);
  });
});
