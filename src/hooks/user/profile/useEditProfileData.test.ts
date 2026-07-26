import { renderHook } from '@testing-library/react';
import { UseFormReturn } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUserProfileDto } from '@/hooks/user/user-data/useUserProfileDto';
import { mapVoToFormValues } from '@/lib/profile/profileSaveAdapter';
import { ProfileFormValues } from '@/schemas/profileSchema';

import { useEditProfileData } from './useEditProfileData';

// Mock mapVoToFormValues
vi.mock('@/lib/profile/profileSaveAdapter', () => ({
  mapVoToFormValues: vi.fn(),
}));

// Mock useUserProfileDto
vi.mock('@/hooks/user/user-data/useUserProfileDto', () => ({
  useUserProfileDto: vi.fn(),
}));

const mockMapVoToFormValues = vi.mocked(mapVoToFormValues);
const mockUseUserProfileDto = vi.mocked(useUserProfileDto);

describe('useEditProfileData', () => {
  let mockForm: UseFormReturn<ProfileFormValues>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockForm = {
      reset: vi.fn(),
    } as unknown as UseFormReturn<ProfileFormValues>;
  });

  it('initially returns default loading states and false for isMentor/isError', () => {
    mockUseUserProfileDto.mockReturnValue({
      userDto: null,
      isLoading: true,
      error: null,
    });

    const { result } = renderHook(() =>
      useEditProfileData({
        userId: 1,
        form: mockForm,
        isAuthorized: true,
        isMentorOnboarding: false,
      })
    );

    expect(result.current.isMentor).toBe(false);
    expect(result.current.isPageLoading).toBe(true);
    expect(result.current.isError).toBe(false);
    expect(mockForm.reset).not.toHaveBeenCalled();
  });

  it('populates form and sets loaded states when isAuthorized is true and userDto is successfully fetched', () => {
    const mockUserDto = { id: 1, username: 'test_user' } as any;
    const mockFormValues = { is_mentor: true } as any;

    mockUseUserProfileDto.mockReturnValue({
      userDto: mockUserDto,
      isLoading: false,
      error: null,
    });
    mockMapVoToFormValues.mockReturnValue(mockFormValues);

    const { result } = renderHook(() =>
      useEditProfileData({
        userId: 1,
        form: mockForm,
        isAuthorized: true,
        isMentorOnboarding: false,
      })
    );

    expect(mockMapVoToFormValues).toHaveBeenCalledWith(mockUserDto, false);
    expect(mockForm.reset).toHaveBeenCalledWith(mockFormValues);
    expect(result.current.isMentor).toBe(true);
    expect(result.current.isPageLoading).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('keeps isPageLoading=true and does not reset form when unauthorized even if userDto is fetched', () => {
    const mockUserDto = { id: 1, username: 'test_user' } as any;

    mockUseUserProfileDto.mockReturnValue({
      userDto: mockUserDto,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() =>
      useEditProfileData({
        userId: 1,
        form: mockForm,
        isAuthorized: false,
        isMentorOnboarding: false,
      })
    );

    expect(mockForm.reset).not.toHaveBeenCalled();
    expect(result.current.isMentor).toBe(false);
    expect(result.current.isPageLoading).toBe(true);
    expect(result.current.isError).toBe(false);
  });

  it('sets isError to true and finishes loading when fetching fails with an error', () => {
    mockUseUserProfileDto.mockReturnValue({
      userDto: null,
      isLoading: false,
      error: 'Fetch failed',
    });

    const { result } = renderHook(() =>
      useEditProfileData({
        userId: 1,
        form: mockForm,
        isAuthorized: true,
        isMentorOnboarding: false,
      })
    );

    expect(result.current.isMentor).toBe(false);
    expect(result.current.isPageLoading).toBe(false);
    expect(result.current.isError).toBe(true);
  });

  it('clears isError status and sets values on successful background retry/resolution', () => {
    const mockUserDto = { id: 1, username: 'test_user' } as any;
    const mockFormValues = { is_mentor: false } as any;

    // 1) First render starts with error
    mockUseUserProfileDto.mockReturnValue({
      userDto: null,
      isLoading: false,
      error: 'Network Timeout',
    });

    const { result, rerender } = renderHook(
      (props) => useEditProfileData(props),
      {
        initialProps: {
          userId: 1,
          form: mockForm,
          isAuthorized: true,
          isMentorOnboarding: false,
        },
      }
    );

    expect(result.current.isError).toBe(true);
    expect(result.current.isPageLoading).toBe(false);

    // 2) Mock background retry success
    mockUseUserProfileDto.mockReturnValue({
      userDto: mockUserDto,
      isLoading: false,
      error: null,
    });
    mockMapVoToFormValues.mockReturnValue(mockFormValues);

    rerender({
      userId: 1,
      form: mockForm,
      isAuthorized: true,
      isMentorOnboarding: false,
    });

    // It should successfully recover, reset isError, and populate form values
    expect(result.current.isError).toBe(false);
    expect(result.current.isPageLoading).toBe(false);
    expect(mockForm.reset).toHaveBeenCalledWith(mockFormValues);
  });
});
