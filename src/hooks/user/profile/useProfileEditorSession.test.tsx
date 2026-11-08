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

const mockUseEditProfileData = vi.fn();
vi.mock('./useEditProfileData', () => ({
  useEditProfileData: (...args: unknown[]) => mockUseEditProfileData(...args),
}));

const mockOnSubmit = vi.fn().mockResolvedValue({});
vi.mock('./useProfileSubmit', () => ({
  useProfileSubmit: () => ({
    onSubmit: mockOnSubmit,
    isSaving: false,
  }),
}));

const mockScrollToField = vi.fn();
vi.mock('./useFormErrorScroll', () => ({
  useFormErrorScroll: () => ({
    formRef: { current: null },
    onError: vi.fn(),
    scrollToField: mockScrollToField,
  }),
}));

vi.mock('@/services/profile/updateAvatar', () => ({
  updateAvatar: vi.fn(),
}));

vi.mock('@/services/profile/getAvatarSnapshot', () => ({
  getAvatarSnapshot: vi.fn(),
}));

import { getAvatarSnapshot } from '@/services/profile/getAvatarSnapshot';
import { updateAvatar } from '@/services/profile/updateAvatar';
import { mockUserDTO } from '@/test/fixtures/profile';

import { useProfileEditorSession } from './useProfileEditorSession';

const mockUpdateAvatar = vi.mocked(updateAvatar);
const mockGetAvatarSnapshot = vi.mocked(getAvatarSnapshot);

describe('useProfileEditorSession (#787)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseEditProfileData.mockReturnValue({
      userDto: { ...mockUserDTO, user_id: 1, name: 'Initial Name' },
      isMentor: false,
      isError: false,
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
    mockUseEditProfileData.mockReturnValue({
      userDto: {
        ...mockUserDTO,
        user_id: 1,
        name: 'Background Refetched Name',
      },
      isMentor: false,
      isError: false,
    });
    rerender({ pageUserId: '1' });

    // Dirty form state must NOT be clobbered!
    expect(result.current.form.getValues('name')).toBe('Dirty Edited Name');

    // Switching to pageUserId '2' while SWR still returns user 1's stale DTO must NOT lock hydration
    rerender({ pageUserId: '2' });
    expect(result.current.isHydrating).toBe(true);

    // Once user 2's DTO arrives, hydration completes for pageUserId '2'
    mockUseEditProfileData.mockReturnValue({
      userDto: { ...mockUserDTO, user_id: 2, name: 'Second User Name' },
      isMentor: false,
      isError: false,
    });
    rerender({ pageUserId: '2' });

    expect(result.current.isHydrating).toBe(false);
    expect(result.current.form.getValues('name')).toBe('Second User Name');
  });

  it('blocks submit and scrolls to work_experiences or educations when section validation flags an error, and delegates to onSubmit once errors clear', async () => {
    const { result } = renderHook(() =>
      useProfileEditorSession({
        pageUserId: '1',
        isAuthorized: true,
        isMentorOnboarding: false,
      })
    );

    act(() => {
      result.current.form.reset({
        ...result.current.form.getValues(),
        name: 'Valid Name',
        location: 'TWN',
        years_of_experience: '1-3',
        want_position: ['frontend'],
        want_skill: ['react'],
        want_topic: ['career'],
      });
      result.current.setJobSectionError(true);
    });

    await act(async () => {
      await result.current.handleFormSubmit();
    });

    expect(mockScrollToField).toHaveBeenCalledWith('work_experiences');
    expect(mockOnSubmit).not.toHaveBeenCalled();

    mockScrollToField.mockClear();
    act(() => {
      result.current.setJobSectionError(false);
      result.current.setEducationSectionError(true);
    });

    await act(async () => {
      await result.current.handleFormSubmit();
    });

    expect(mockScrollToField).toHaveBeenCalledWith('educations');
    expect(mockOnSubmit).not.toHaveBeenCalled();

    // Clearing both section errors allows handleFormSubmit to invoke onSubmit
    mockScrollToField.mockClear();
    act(() => {
      result.current.setEducationSectionError(false);
    });

    await act(async () => {
      await result.current.handleFormSubmit();
    });

    expect(mockScrollToField).not.toHaveBeenCalled();
    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
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
});
