import { act, renderHook } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useToast } from '@/components/ui/use-toast';
import { useBackgroundAvatarUpload } from '@/hooks/user/profile/useBackgroundAvatarUpload';
import { trackFormValidationFailed } from '@/lib/analytics';
import {
  getPendingFavoriteMentorId,
  savePendingFavoriteMentor,
} from '@/lib/favorites';
import { readStoredMenteeDirectionMap } from '@/lib/profile/menteeDirectionPreference';
import type { ProfileSavePort } from '@/lib/profile/saveProfile';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';
import type { MentorProfileVO } from '@/types/user';

import { useOnboardingForm } from './useOnboardingForm';

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
const mockTrackFormValidationFailed = vi.mocked(trackFormValidationFailed);
const mockUseToast = vi.mocked(useToast);

describe('useOnboardingForm (single-form + commitProfileMutation #905)', () => {
  const mockPush = vi.fn();
  const mockUpdateSession = vi.fn().mockResolvedValue(null);
  const mockWriteProfile = vi.fn().mockResolvedValue(undefined);
  const mockFetchProfile = vi.fn().mockResolvedValue(null);
  const mockRevalidate = vi.fn().mockResolvedValue(undefined);
  const mockKickOff = vi.fn();
  const mockResolve = vi.fn();
  const mockMarkCommitted = vi.fn();
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
      stage: mockKickOff,
      kickOff: mockKickOff,
      resolve: mockResolve,
      markCommitted: mockMarkCommitted,
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

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('locks onboarding role to mentee by default when NEXT_PUBLIC_ENABLE_DUAL_TRACK_V2 is disabled (#970)', () => {
    const { result } = renderHook(() =>
      useOnboardingForm({
        industries: mockIndustries,
        port: buildPort(),
      })
    );

    expect(result.current.role).toBe('mentee');
    act(() => {
      result.current.setRole('mentor');
    });
    expect(result.current.role).toBe('mentee');
  });

  it('validates Mentee single-page fields, switches to Mentor role, and submits Mentor onboarding to /profile/card when NEXT_PUBLIC_ENABLE_DUAL_TRACK_V2=true (#836)', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_DUAL_TRACK_V2', 'true');
    const { result } = renderHook(() => {
      const s = useOnboardingForm({
        industries: mockIndustries,
        port: buildPort(),
      });
      void s.form.formState.errors;
      return s;
    });

    expect(mockUseBackgroundAvatarUpload).toHaveBeenCalledWith(1);
    expect(result.current.role).toBe('mentee');

    // Submitting Mentee while years_of_experience and want_* are empty -> blocks and tracks validation failure without PII
    await act(async () => {
      await result.current.submitOnboarding();
    });
    expect(mockWriteProfile).not.toHaveBeenCalled();
    expect(mockTrackFormValidationFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: 'onboarding',
        formId: 'mentee_onboarding',
        invalidKeys: expect.arrayContaining([
          'years_of_experience',
          'want_position',
        ]),
      })
    );
    expect(
      JSON.stringify(mockTrackFormValidationFailed.mock.calls)
    ).not.toContain('John Doe');

    // Switch to Mentor role -> blocks when guidelines & Mentor fields are missing
    act(() => {
      result.current.setRole('mentor');
    });
    expect(result.current.role).toBe('mentor');

    await act(async () => {
      await result.current.submitOnboarding();
    });
    expect(mockWriteProfile).not.toHaveBeenCalled();
    expect(mockTrackFormValidationFailed).toHaveBeenLastCalledWith(
      expect.objectContaining({
        feature: 'onboarding',
        formId: 'mentor_onboarding',
        invalidKeys: expect.arrayContaining([
          'agreed_guidelines',
          'avatarFile',
          'industry',
          'about',
        ]),
      })
    );

    // Fill valid Mentor fields and submit -> writes is_mentor=true and navigates to /profile/card
    act(() => {
      result.current.form.reset({
        role: 'mentor',
        name: 'John Doe',
        avatar:
          'https://x-career-multimedia.s3.amazonaws.com/dev/files/1/avatar',
        avatarFile: undefined,
        language: 'zh_TW',
        agreed_guidelines: true,
        location: 'TWN',
        years_of_experience: 'FIVE_TO_TEN',
        industry: 'TECH',
        about: '資深前端工程師',
        have_topic: ['resume'],
        have_skill: ['react'],
        want_position: [],
        want_skill: [],
        want_topic: [],
        work_experiences: [
          {
            id: -1,
            job: 'Senior Engineer',
            company: 'XChange',
            job_period_start: '2020',
            job_period_end: 'now',
            industry: 'TECH',
            job_location: 'TWN',
            description: '前端架構',
            is_primary: true,
          },
        ],
        educations: [
          {
            id: -1,
            school: '國立臺灣大學',
            subject: '資訊工程學系',
            education_period_start: '2016',
            education_period_end: '2020',
          },
        ],
        links: {
          linkedin: '',
          facebook: '',
          instagram: '',
          twitter: '',
          youtube: '',
          github: 'https://github.com/johndoe',
          website: '',
        },
      });
    });

    await act(async () => {
      await result.current.submitOnboarding();
    });

    expect(mockWriteProfile).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({
        is_mentor: true,
        onboarding: true,
        about: '資深前端工程師',
        have_topic: ['resume'],
        have_skill: ['react'],
      })
    );
    expect(mockPush).toHaveBeenCalledWith('/profile/card');
  });

  it('kicks off background avatar upload on handleAvatarFileChange (omitting Google URL from S3 snapshot) and rolls back on preset selection', () => {
    const { result } = renderHook(() =>
      useOnboardingForm({ industries: mockIndustries, port: buildPort() })
    );

    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    act(() => {
      result.current.form.setValue(
        'avatar',
        'https://lh3.googleusercontent.com/a/ACg8ocGoogle=s512-c'
      );
      result.current.handleAvatarFileChange(file);
    });
    expect(mockKickOff).toHaveBeenCalledWith(file, '');

    const s3Url =
      'https://x-career-multimedia.s3.ap-northeast-1.amazonaws.com/avatars/1/prev.png';
    const file2 = new File(['avatar2'], 'avatar2.png', { type: 'image/png' });
    act(() => {
      result.current.form.setValue('avatar', s3Url);
      result.current.handleAvatarFileChange(file2);
    });
    expect(mockKickOff).toHaveBeenLastCalledWith(file2, s3Url);

    act(() => {
      result.current.handleSelectPresetAvatar('/avatars/default_4.webp');
    });
    expect(mockRollback).toHaveBeenCalled();
    expect(result.current.form.getValues('avatar')).toBe('default_4');
  });

  it('commits mentee-onboarding via two-phase commitProfileMutation (resolve -> writeProfile -> markCommitted) and redirects to pendingFavoriteMentor (#943)', async () => {
    savePendingFavoriteMentor(7482008160728084);
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    mockResolve.mockResolvedValue(
      'https://s3.amazonaws.com/new-avatar.png?v=100'
    );

    const { result } = renderHook(() =>
      useOnboardingForm({ industries: mockIndustries, port: buildPort() })
    );

    act(() => {
      result.current.setDirectionMap({
        pos1: { skills: ['skill1'], topics: ['topic1'] },
      });
      result.current.form.reset({
        ...result.current.form.getValues(),
        role: 'mentee',
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

    expect(mockResolve).toHaveBeenCalledWith(file);
    expect(mockMarkCommitted).toHaveBeenCalledTimes(1);
    expect(mockWriteProfile.mock.invocationCallOrder[0]).toBeLessThan(
      mockMarkCommitted.mock.invocationCallOrder[0]
    );
    expect(readStoredMenteeDirectionMap('1')).toEqual({
      pos1: { skills: ['skill1'], topics: ['topic1'] },
    });
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

  it('routes step="avatar_upload" failure to avatarFile error without toast, and retains uncommitted S3 snapshot when PUT /profile fails (#943)', async () => {
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    mockResolve.mockRejectedValueOnce(new Error('S3 error'));

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
        ...result.current.form.getValues(),
        role: 'mentee',
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

    expect(result.current.form.formState.errors.avatarFile?.message).toBe(
      '頭像上傳失敗，請重新選擇。'
    );
    expect(mockAbort).toHaveBeenCalledTimes(1);
    expect(mockToast).not.toHaveBeenCalled();
    expect(mockWriteProfile).not.toHaveBeenCalled();
    expect(mockMarkCommitted).not.toHaveBeenCalled();

    // Retry path: Step 1 resolve succeeds, Step 2 writeProfile fails -> markCommitted MUST NOT be called!
    act(() => {
      result.current.form.setValue('avatarFile', file);
    });
    mockResolve.mockResolvedValue('https://s3.amazonaws.com/ok.png?v=2');
    mockWriteProfile.mockRejectedValueOnce(new Error('500 Write Error'));

    await act(async () => {
      await result.current.submitOnboarding();
    });
    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      description: '儲存失敗，請稍後再試。',
      duration: 5000,
    });
    expect(mockMarkCommitted).not.toHaveBeenCalled();

    // Subsequent retry: writeProfile succeeds -> markCommitted IS now called!
    mockWriteProfile.mockResolvedValueOnce(undefined);
    await act(async () => {
      await result.current.submitOnboarding();
    });
    expect(mockWriteProfile).toHaveBeenCalledTimes(2);
    expect(mockMarkCommitted).toHaveBeenCalledTimes(1);
  });

  it('defaults Mentee empty avatar to default_1 and navigates to /profile/card completion page when no pending favorite exists (#973)', async () => {
    const { result } = renderHook(() =>
      useOnboardingForm({ industries: mockIndustries, port: buildPort() })
    );

    act(() => {
      result.current.form.reset({
        ...result.current.form.getValues(),
        role: 'mentee',
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

    await act(async () => {
      await result.current.submitOnboarding();
    });

    expect(mockWriteProfile).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({
        avatar: 'default_1',
        is_mentor: false,
      })
    );
    expect(mockPush).toHaveBeenCalledWith('/profile/card');
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
        ...result.current.form.getValues(),
        role: 'mentee',
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
