import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

vi.mock('next-auth/react', async () => {
  const { nextAuthMockFactory } = await import('@/test/mocks/nextAuth');
  return nextAuthMockFactory();
});

const mockUseUserProfileDto = vi.fn();
vi.mock('@/hooks/user/user-data/useUserProfileDto', () => ({
  useUserProfileDto: (...args: unknown[]) => mockUseUserProfileDto(...args),
}));

const mockCommitProfileMutation = vi.fn().mockResolvedValue({});
vi.mock('@/lib/profile/saveProfile', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/profile/saveProfile')>();
  return {
    ...actual,
    commitProfileMutation: (...args: unknown[]) =>
      mockCommitProfileMutation(...args),
  };
});

const mockTrackFormValidationFailed = vi.fn();
vi.mock('@/lib/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/analytics')>();
  return {
    ...actual,
    trackFormValidationFailed: (...args: unknown[]) =>
      mockTrackFormValidationFailed(...args),
  };
});

const mockOnError = vi.fn();
const mockScrollToField = vi.fn();
vi.mock('./useFormErrorScroll', () => ({
  useFormErrorScroll: () => ({
    formRef: { current: null },
    onError: mockOnError,
    scrollToField: mockScrollToField,
  }),
}));

vi.mock('@/services/profile/updateAvatar', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/services/profile/updateAvatar')>();
  return {
    ...actual,
    updateAvatar: vi.fn(),
  };
});

vi.mock('@/services/profile/getAvatarSnapshot', () => ({
  getAvatarSnapshot: vi.fn(),
}));

import { getAvatarSnapshot } from '@/services/profile/getAvatarSnapshot';
import { updateAvatar } from '@/services/profile/updateAvatar';
import { mockUserDTO } from '@/test/fixtures/profile';

import { useProfileEditorSession } from './useProfileEditorSession';

const mockUpdateAvatar = vi.mocked(updateAvatar);
const mockGetAvatarSnapshot = vi.mocked(getAvatarSnapshot);

describe('useProfileEditorSession (#787 / #905)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCommitProfileMutation.mockResolvedValue({});
    mockUseUserProfileDto.mockReturnValue({
      userDto: {
        ...mockUserDTO,
        user_id: 1,
        name: 'Initial Name',
        is_mentor: false,
      },
      error: null,
    });
  });

  it('hydrates the form once per pageUserId and preserves dirty form state during background SWR DTO revalidation', () => {
    const { result, rerender } = renderHook(
      ({ pageUserId }) =>
        useProfileEditorSession({
          pageUserId,
          isAuthorized: true,
          isMentorOnboarding: false,
        }),
      { initialProps: { pageUserId: '1' } }
    );

    expect(result.current.isHydrating).toBe(false);
    expect(result.current.form.getValues('name')).toBe('Initial Name');

    // User edits the name field locally (dirty form state)
    act(() => {
      result.current.form.setValue('name', 'Dirty Edited Name', {
        shouldDirty: true,
      });
    });
    expect(result.current.form.getValues('name')).toBe('Dirty Edited Name');

    // Background SWR revalidation delivers a new DTO object reference for the same user
    mockUseUserProfileDto.mockReturnValue({
      userDto: {
        ...mockUserDTO,
        user_id: 1,
        name: 'Background Refetched Name',
      },
      error: null,
    });
    rerender({ pageUserId: '1' });

    // Dirty form state must NOT be clobbered!
    expect(result.current.form.getValues('name')).toBe('Dirty Edited Name');

    // Switching to pageUserId '2' while SWR still returns user 1's stale DTO must NOT lock hydration
    rerender({ pageUserId: '2' });
    expect(result.current.isHydrating).toBe(true);

    // Once user 2's DTO arrives, hydration completes for pageUserId '2'
    mockUseUserProfileDto.mockReturnValue({
      userDto: { ...mockUserDTO, user_id: 2, name: 'Second User Name' },
      error: null,
    });
    rerender({ pageUserId: '2' });

    expect(result.current.isHydrating).toBe(false);
    expect(result.current.form.getValues('name')).toBe('Second User Name');
  });

  it('blocks submit and surfaces formState.errors when work_experiences or educations have start > end periods, and delegates to onSubmit once valid', async () => {
    const { result } = renderHook(() => {
      const session = useProfileEditorSession({
        pageUserId: '1',
        isAuthorized: true,
        isMentorOnboarding: false,
      });
      void session.form.formState.errors;
      return session;
    });

    act(() => {
      result.current.form.reset({
        ...result.current.form.getValues(),
        name: 'Valid Name',
        location: 'TWN',
        years_of_experience: '1-3',
        want_position: ['frontend'],
        want_skill: ['react'],
        want_topic: ['career'],
        work_experiences: [
          {
            id: 0,
            job: 'Engineer',
            company: 'Acme',
            job_period_start: '2024',
            job_period_end: '2020',
            industry: 'tech',
            job_location: 'TWN',
            description: 'Building products',
            is_primary: true,
          },
        ],
      });
    });

    await act(async () => {
      await result.current.handleFormSubmit();
    });

    expect(mockOnError).toHaveBeenCalledWith(
      expect.objectContaining({
        work_experiences: expect.anything(),
      }),
      undefined
    );
    expect(
      result.current.form.formState.errors.work_experiences?.[0]?.job_period_end
        ?.message
    ).toBe('開始年份不可大於結束年份');
    expect(mockCommitProfileMutation).not.toHaveBeenCalled();

    mockOnError.mockClear();
    act(() => {
      result.current.form.setValue('work_experiences.0.job_period_end', '2024');
      result.current.form.setValue('educations', [
        {
          id: 0,
          subject: 'CS',
          school: '國立臺灣大學',
          education_period_start: '2025',
          education_period_end: '2021',
        },
      ]);
    });

    await act(async () => {
      await result.current.handleFormSubmit();
    });

    expect(mockOnError).toHaveBeenCalledWith(
      expect.objectContaining({
        educations: expect.anything(),
      }),
      undefined
    );
    expect(
      result.current.form.formState.errors.educations?.[0]?.education_period_end
        ?.message
    ).toBe('開始年份不可大於結束年份');
    expect(mockCommitProfileMutation).not.toHaveBeenCalled();

    mockOnError.mockClear();
    act(() => {
      result.current.form.setValue('educations.0.education_period_end', 'now');
    });

    await act(async () => {
      await result.current.handleFormSubmit();
    });

    expect(mockOnError).not.toHaveBeenCalled();
    expect(mockCommitProfileMutation).toHaveBeenCalledTimes(1);
  });

  it('automatically rolls back an unconsumed S3 avatar upload when the session unmounts', async () => {
    mockUpdateAvatar.mockResolvedValueOnce(
      'https://s3.amazonaws.com/bucket/new.png'
    );
    mockGetAvatarSnapshot.mockResolvedValue(
      new Blob(['old-bytes'], { type: 'image/png' })
    );

    const { result, unmount } = renderHook(() =>
      useProfileEditorSession({
        pageUserId: '1',
        isAuthorized: true,
        isMentorOnboarding: false,
      })
    );

    const file = new File(['new-bytes'], 'avatar.png', { type: 'image/png' });
    await act(async () => {
      result.current.handleAvatarFileChange(file);
      await Promise.resolve();
    });

    expect(mockUpdateAvatar).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockUpdateAvatar).toHaveBeenCalledTimes(2);
  });

  it('does not double-rollback when confirmLeave is invoked before unmount (#787)', async () => {
    mockUpdateAvatar.mockResolvedValueOnce(
      'https://s3.amazonaws.com/bucket/new.png'
    );
    mockGetAvatarSnapshot.mockResolvedValue(
      new Blob(['old-bytes'], { type: 'image/png' })
    );

    const { result, unmount } = renderHook(() =>
      useProfileEditorSession({
        pageUserId: '1',
        isAuthorized: true,
        isMentorOnboarding: false,
      })
    );

    const file = new File(['new-bytes'], 'avatar.png', { type: 'image/png' });
    await act(async () => {
      result.current.handleAvatarFileChange(file);
      await Promise.resolve();
    });

    expect(mockUpdateAvatar).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.confirmLeave();
      await Promise.resolve();
    });

    expect(mockUpdateAvatar).toHaveBeenCalledTimes(2);

    unmount();
    await act(async () => {
      await Promise.resolve();
    });

    // Must remain 2 (1 initial upload + 1 rollback), never a 3rd duplicate rollback
    expect(mockUpdateAvatar).toHaveBeenCalledTimes(2);
  });

  it('forwards hydrated userDto, industryCatalog, and explicit pageUserId into commitProfileMutation (#889 / #905)', async () => {
    const industryCatalog = [
      { subject_group: 'finance', subject: '金融與銀行' },
    ];

    const { result } = renderHook(() =>
      useProfileEditorSession({
        pageUserId: '1',
        isAuthorized: true,
        isMentorOnboarding: false,
        industryCatalog,
      })
    );

    act(() => {
      result.current.form.reset({
        ...result.current.form.getValues(),
        name: 'Initial Name',
        location: 'TWN',
        years_of_experience: '1_3',
        want_position: ['frontend'],
        want_skill: ['react'],
        want_topic: ['career'],
      });
    });

    await act(async () => {
      await result.current.handleFormSubmit();
    });

    expect(mockCommitProfileMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'edit',
        currentDto: expect.objectContaining({
          user_id: 1,
          name: 'Initial Name',
        }),
      }),
      expect.objectContaining({
        pageUserId: '1',
        industryCatalog,
      }),
      expect.any(Object)
    );
  });

  it('tracks form_validation_failed with profile_edit vs mentor_onboarding formId without PII and forwards (errors, event) to onError (#950)', async () => {
    const { result: editHook } = renderHook(() =>
      useProfileEditorSession({
        pageUserId: '1',
        isAuthorized: true,
        isMentorOnboarding: false,
      })
    );

    act(() => {
      editHook.current.form.setValue('name', '');
    });

    await act(async () => {
      await editHook.current.handleFormSubmit();
    });

    expect(mockTrackFormValidationFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: 'profile',
        formId: 'profile_edit',
        invalidKeys: expect.arrayContaining(['name']),
      })
    );
    expect(mockOnError).toHaveBeenCalledWith(
      expect.objectContaining({ name: expect.anything() }),
      undefined
    );

    mockTrackFormValidationFailed.mockClear();
    mockOnError.mockClear();

    const { result: mentorHook } = renderHook(() =>
      useProfileEditorSession({
        pageUserId: '1',
        isAuthorized: true,
        isMentorOnboarding: true,
      })
    );

    act(() => {
      mentorHook.current.form.setValue('name', '');
    });

    await act(async () => {
      await mentorHook.current.handleFormSubmit();
    });

    expect(mockTrackFormValidationFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: 'profile',
        formId: 'mentor_onboarding',
        invalidKeys: expect.arrayContaining(['name']),
      })
    );
    expect(
      JSON.stringify(mockTrackFormValidationFailed.mock.calls)
    ).not.toContain('Initial Name');
  });

  it('skips background S3 upload for invalid avatar files, selects preset avatar, and prompts on unsaved Mentee direction map changes (#959)', async () => {
    mockUpdateAvatar.mockResolvedValue('https://cdn.example.com/ok.jpg');
    mockUseUserProfileDto.mockReturnValue({
      userDto: {
        ...mockUserDTO,
        user_id: 1,
        name: 'Mentee User',
        is_mentor: false,
        want_position: ['uiux', 'fe'],
        want_skill: ['ux_research'],
        want_topic: [],
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useProfileEditorSession({
        pageUserId: '1',
        isAuthorized: true,
        isMentorOnboarding: false,
      })
    );

    // 1. Before saving, changing only directionMap (form.isDirty === false) opens unsaved prompt on leave
    expect(result.current.form.formState.isDirty).toBe(false);
    act(() => {
      result.current.setDirectionMap({
        uiux: { skills: [], topics: [] },
        fe: { skills: ['ux_research'], topics: [] },
      });
    });
    act(() => {
      result.current.handleGoToPrev();
    });
    expect(result.current.isPromptOpen).toBe(true);
    act(() => {
      result.current.cancelLeave();
    });

    // 2. Invalid MIME type must not trigger updateAvatar S3 upload
    const badFile = new File(['bad'], 'malicious.svg', {
      type: 'image/svg+xml',
    });
    act(() => {
      result.current.handleAvatarFileChange(badFile);
    });
    expect(mockUpdateAvatar).not.toHaveBeenCalled();

    // 3. Valid file kicks off S3 upload, then preset selection overrides with preset code 'default_3'
    const goodFile = new File(['ok'], 'photo.png', { type: 'image/png' });
    await act(async () => {
      result.current.handleAvatarFileChange(goodFile);
      await Promise.resolve();
    });
    expect(mockUpdateAvatar).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.handleSelectPresetAvatar('/avatars/default_3.webp');
    });
    expect(result.current.form.getValues('avatar')).toBe('default_3');
    expect(result.current.form.getValues('avatarFile')).toBeUndefined();

    // 4. Legacy 2-position want_position is preserved on hydration without silent truncation,
    // and blocked on submit until user reduces to 1 position
    await act(async () => {
      await result.current.handleFormSubmit();
    });
    expect(mockCommitProfileMutation).not.toHaveBeenCalled();
    expect(result.current.form.formState.errors.want_position?.message).toBe(
      '目前僅開放選擇 1 個職位方向'
    );

    act(() => {
      result.current.form.setValue('want_position', ['fe'], {
        shouldDirty: true,
        shouldValidate: true,
      });
    });

    // Submit form -> verify commitProfileMutation receives preset code 'default_3' (not S3 URL)
    await act(async () => {
      await result.current.handleFormSubmit();
    });
    expect(mockCommitProfileMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        values: expect.objectContaining({
          avatar: 'default_3',
          avatarFile: undefined,
          want_position: ['fe'],
        }),
      }),
      expect.anything(),
      expect.anything()
    );
  });

  it('re-hydrates form values when isMentorOnboarding toggles on the same pageUserId (#1336)', () => {
    mockUseUserProfileDto.mockReturnValue({
      userDto: {
        ...mockUserDTO,
        user_id: 1,
        name: 'Mentee User',
        avatar: '',
        is_mentor: false,
        want_position: ['frontend_engineer'],
      },
      error: null,
    });

    const { result, rerender } = renderHook(
      ({ isMentorOnboarding }: { isMentorOnboarding: boolean }) =>
        useProfileEditorSession({
          pageUserId: '1',
          isAuthorized: true,
          isMentorOnboarding,
        }),
      { initialProps: { isMentorOnboarding: false } }
    );

    expect(result.current.isMentorRole).toBe(false);
    expect(result.current.form.getValues('is_mentor')).toBe(false);
    expect(result.current.form.getValues('avatar')).toBe('');
    expect(result.current.form.getValues('want_position')).toEqual([
      'frontend_engineer',
    ]);

    rerender({ isMentorOnboarding: true });

    expect(result.current.isMentorRole).toBe(true);
    expect(result.current.form.getValues('is_mentor')).toBe(true);
    expect(result.current.form.getValues('avatar')).toBe('default_1');
    expect(result.current.form.getValues('want_position')).toEqual([
      'frontend_engineer',
    ]);
  });
});
