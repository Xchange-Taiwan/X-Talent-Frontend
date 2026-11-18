import { act, renderHook } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useToast } from '@/components/ui/use-toast';
import { useBackgroundAvatarUpload } from '@/hooks/user/profile/useBackgroundAvatarUpload';
import { trackEvent, trackFormValidationFailed } from '@/lib/analytics';
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
  trackFormValidationFailed: vi.fn(),
}));

const mockUseRouter = vi.mocked(useRouter);
const mockUseSession = vi.mocked(useSession);
const mockUseBackgroundAvatarUpload = vi.mocked(useBackgroundAvatarUpload);
const mockTrackEvent = vi.mocked(trackEvent);
const mockTrackFormValidationFailed = vi.mocked(trackFormValidationFailed);
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

    // Step 2 invalid when years_of_experience is empty -> stays on Step 2 and reports exact invalid field (not valid 'location')
    let step2Invalid = true;
    await act(async () => {
      step2Invalid = await result.current.advanceStep();
    });
    expect(step2Invalid).toBe(false);
    expect(result.current.currentStep).toBe(2);
    expect(mockTrackFormValidationFailed).toHaveBeenCalledWith({
      feature: 'onboarding',
      formId: 'mentee_onboarding',
      invalidKeys: ['years_of_experience'],
      step: 2,
    });
    expect(
      JSON.stringify(mockTrackFormValidationFailed.mock.calls)
    ).not.toContain('John Doe');

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
      result.current.form.setValue(
        'avatar',
        'https://lh3.googleusercontent.com/a/ACg8ocGoogle=s512-c'
      );
    });
    await act(async () => {
      await result.current.advanceStep();
    });
    // Google URLs are omitted from S3 rollback snapshot to avoid cross-origin CSP fetches
    expect(mockKickOff).toHaveBeenCalledWith(file, '');

    act(() => {
      result.current.handleGoToPrev();
    });
    const s3Url =
      'https://x-career-multimedia.s3.ap-northeast-1.amazonaws.com/avatars/1/prev.png';
    act(() => {
      result.current.form.setValue('avatar', s3Url);
    });
    await act(async () => {
      await result.current.advanceStep();
    });
    expect(mockKickOff).toHaveBeenLastCalledWith(file, s3Url);
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

  it('enforces full formSchema validation on submitOnboarding and rewinds to the earliest failing step if an earlier step field is invalid', async () => {
    const { result } = renderHook(() => {
      const s = useOnboardingForm({
        industries: mockIndustries,
        port: buildPort(),
      });
      void s.form.formState.errors;
      return s;
    });

    // Advance cleanly to Step 5, then corrupt Step 1's `name` directly before submitOnboarding
    act(() => {
      result.current.form.reset({
        name: 'Valid User',
        avatar: '',
        avatarFile: undefined,
        language: 'zh_TW',
        location: 'TWN',
        years_of_experience: '1_3',
        industry: 'TECH',
        want_position: ['pos1'],
        want_skill: ['skill1'],
        want_topic: ['topic1'],
      });
    });

    for (let i = 0; i < 4; i += 1) {
      await act(async () => {
        await result.current.advanceStep();
      });
    }
    expect(result.current.currentStep).toBe(5);

    act(() => {
      result.current.form.setValue('name', '');
    });

    await act(async () => {
      await result.current.submitOnboarding();
    });

    expect(mockWriteProfile).not.toHaveBeenCalled();
    expect(result.current.currentStep).toBe(1);
    expect(mockTrackFormValidationFailed).toHaveBeenCalledWith({
      feature: 'onboarding',
      formId: 'mentee_onboarding',
      invalidKeys: expect.arrayContaining(['name']),
      step: 1,
    });
  });

  it('hydrates Google name and =s512-c avatar across unauthenticated -> authenticated session transition without clobbering dirty user edits (#951)', async () => {
    let sessionState: ReturnType<typeof useSession> = {
      data: null,
      status: 'unauthenticated',
      update: mockUpdateSession,
    } as unknown as ReturnType<typeof useSession>;
    mockUseSession.mockImplementation(() => sessionState);

    const { result, rerender } = renderHook(() =>
      useOnboardingForm({ industries: mockIndustries, port: buildPort() })
    );

    // Initially unauthenticated during client router.push('/auth/onboarding')
    expect(result.current.form.getValues('name')).toBe('');
    expect(result.current.form.getValues('avatar')).toBe('');

    // SessionProvider finishes refetching /api/auth/session -> transitions to authenticated
    sessionState = {
      data: {
        user: {
          id: '951',
          name: '陳小明',
          avatar: 'https://lh3.googleusercontent.com/a/ACg8ocMing=s96-c',
        },
      },
      status: 'authenticated',
      update: mockUpdateSession,
    } as unknown as ReturnType<typeof useSession>;

    await act(async () => {
      rerender();
    });

    expect(result.current.form.getValues('name')).toBe('陳小明');
    expect(result.current.form.getValues('avatar')).toBe(
      'https://lh3.googleusercontent.com/a/ACg8ocMing=s512-c'
    );

    // User manually edits name -> subsequent session updates never overwrite dirty user input
    act(() => {
      result.current.form.setValue('name', '小明自訂名稱', {
        shouldDirty: true,
      });
    });

    sessionState = {
      data: {
        user: {
          id: '951',
          name: '另一個名字',
          avatar: 'https://lh3.googleusercontent.com/a/ACg8ocMing=s512-c',
        },
      },
      status: 'authenticated',
      update: mockUpdateSession,
    } as unknown as ReturnType<typeof useSession>;

    await act(async () => {
      rerender();
    });

    expect(result.current.form.getValues('name')).toBe('小明自訂名稱');

    // Even if user clears name back to '' (where RHF resets isDirty to false),
    // subsequent session re-renders never resurrect the prefilled Google name
    act(() => {
      result.current.form.setValue('name', '', { shouldDirty: true });
    });
    sessionState = {
      data: {
        user: {
          id: '951',
          name: '陳小明',
          avatar: 'https://lh3.googleusercontent.com/a/ACg8ocMing=s512-c',
        },
      },
      status: 'authenticated',
      update: mockUpdateSession,
    } as unknown as ReturnType<typeof useSession>;
    await act(async () => {
      rerender();
    });
    expect(result.current.form.getValues('name')).toBe('');
  });

  it('aborts slow profile backfill when submitOnboarding starts so stale session data never overwrites onBoarding: true (#951)', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: '953', name: '王大明', avatar: '', onBoarding: false },
      },
      status: 'authenticated',
      update: mockUpdateSession,
    } as unknown as ReturnType<typeof useSession>);

    let resolveSlowProfile!: (dto: MentorProfileVO | null) => void;
    mockFetchProfile
      .mockImplementationOnce(
        () =>
          new Promise<MentorProfileVO | null>((resolve) => {
            resolveSlowProfile = resolve;
          })
      )
      .mockResolvedValue(
        fromPartial<MentorProfileVO>({
          user_id: 953,
          name: '王大明',
          is_mentor: false,
          onboarding: true,
        })
      );

    const { result } = renderHook(() =>
      useOnboardingForm({ industries: mockIndustries, port: buildPort() })
    );

    act(() => {
      result.current.form.reset({
        name: '王大明',
        avatar: '',
        avatarFile: undefined,
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

    mockUpdateSession.mockClear();
    await act(async () => {
      resolveSlowProfile(
        fromPartial<MentorProfileVO>({
          user_id: 953,
          name: '王大明',
          avatar: 'https://lh3.googleusercontent.com/a/ACg8ocLate=s96-c',
          onboarding: false,
        })
      );
      await Promise.resolve();
    });

    expect(mockUpdateSession).not.toHaveBeenCalled();
  });

  it('silently backfills missing name and =s512-c avatar from profile API when authenticated session cookie lacks them (#951)', async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: '952', name: '', avatar: '' } },
      status: 'authenticated',
      update: mockUpdateSession,
    } as unknown as ReturnType<typeof useSession>);

    mockFetchProfile.mockResolvedValueOnce(
      fromPartial<MentorProfileVO>({
        user_id: 952,
        name: '林小華',
        avatar: 'https://lh3.googleusercontent.com/a/ACg8ocHua=s96-c',
        is_mentor: false,
        onboarding: false,
      })
    );

    const { result } = renderHook(() =>
      useOnboardingForm({ industries: mockIndustries, port: buildPort() })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetchProfile).toHaveBeenCalledWith(952, 'zh_TW');
    expect(result.current.form.getValues('name')).toBe('林小華');
    expect(result.current.form.getValues('avatar')).toBe(
      'https://lh3.googleusercontent.com/a/ACg8ocHua=s512-c'
    );
    expect(mockUpdateSession).toHaveBeenCalledWith({
      user: {
        name: '林小華',
        avatar: 'https://lh3.googleusercontent.com/a/ACg8ocHua=s512-c',
      },
    });
  });

  it('completes profile backfill cleanly under React.StrictMode double-effect mount/cleanup/remount (#951)', async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: '954', name: '', avatar: '' } },
      status: 'authenticated',
      update: mockUpdateSession,
    } as unknown as ReturnType<typeof useSession>);

    mockFetchProfile.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve(
              fromPartial<MentorProfileVO>({
                user_id: 954,
                name: '嚴格模式測試',
                avatar:
                  'https://lh3.googleusercontent.com/a/ACg8ocStrict=s96-c',
                onboarding: false,
              })
            );
          }, 10);
        })
    );

    const { result } = renderHook(
      () =>
        useOnboardingForm({ industries: mockIndustries, port: buildPort() }),
      { wrapper: React.StrictMode }
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });

    expect(result.current.form.getValues('name')).toBe('嚴格模式測試');
    expect(result.current.form.getValues('avatar')).toBe(
      'https://lh3.googleusercontent.com/a/ACg8ocStrict=s512-c'
    );
  });

  it('awaits in-flight backfill updateSession and uses latest updateSession closure when submitting (#951)', async () => {
    let resolveBackfillUpdate!: () => void;
    const staleDeadClosureUpdate = vi.fn().mockResolvedValue(undefined);
    const liveFreshClosureUpdate = vi.fn().mockResolvedValue(null);

    let currentUpdateFn: typeof mockUpdateSession = vi.fn(
      () =>
        new Promise<null>((resolve) => {
          // Simulate NextAuth replacing update closure with a dead no-op while loading,
          // then restoring a fresh closure once backfill update resolves
          currentUpdateFn = staleDeadClosureUpdate;
          resolveBackfillUpdate = () => {
            currentUpdateFn = liveFreshClosureUpdate;
            resolve(null);
          };
        })
    );

    mockUseSession.mockImplementation(
      () =>
        ({
          data: {
            user: { id: '955', name: '', avatar: '', onBoarding: false },
          },
          status: 'authenticated',
          update: currentUpdateFn,
        }) as unknown as ReturnType<typeof useSession>
    );

    mockFetchProfile
      .mockResolvedValueOnce(
        fromPartial<MentorProfileVO>({
          user_id: 955,
          name: '張小美',
          avatar: 'https://lh3.googleusercontent.com/a/ACg8ocMei=s96-c',
          onboarding: false,
        })
      )
      .mockResolvedValue(
        fromPartial<MentorProfileVO>({
          user_id: 955,
          name: '張小美',
          is_mentor: false,
          onboarding: true,
        })
      );

    // Omit updateSession override in port so useOnboardingForm's own savePort.updateSession is exercised
    const portWithoutUpdateOverride: Partial<ProfileSavePort> = {
      writeProfile: mockWriteProfile,
      fetchProfile: mockFetchProfile,
      revalidateProfilePath: mockRevalidate,
      navigate: mockPush,
    };

    const { result, rerender } = renderHook(() =>
      useOnboardingForm({
        industries: mockIndustries,
        port: portWithoutUpdateOverride,
      })
    );

    // Let fetchProfile (2 microtask ticks) resolve and start backfill updateSession (now in flight)
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    rerender();

    act(() => {
      result.current.form.setValue('years_of_experience', '1_3');
      result.current.form.setValue('industry', 'TECH');
      result.current.form.setValue('want_position', ['pos1']);
      result.current.form.setValue('want_skill', ['skill1']);
      result.current.form.setValue('want_topic', ['topic1']);
    });

    // Start submitOnboarding while backfill updateSession is still in flight
    let submitDone = false;
    let pendingSubmit!: Promise<void>;
    act(() => {
      pendingSubmit = result.current.submitOnboarding();
    });

    act(() => {
      resolveBackfillUpdate();
    });
    rerender();

    await act(async () => {
      await pendingSubmit;
      submitDone = true;
    });

    expect(submitDone).toBe(true);
    expect(staleDeadClosureUpdate).not.toHaveBeenCalled();
    expect(liveFreshClosureUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({
          onBoarding: true,
        }),
      })
    );
  });
});
