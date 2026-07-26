import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUserProfileDto } from '@/hooks/user/user-data/useUserProfileDto';
import { MentorProfileVO } from '@/services/profile/user';

import { useEditProfileData } from './useEditProfileData';

// Mock useUserProfileDto
vi.mock('@/hooks/user/user-data/useUserProfileDto', () => ({
  useUserProfileDto: vi.fn(),
}));

const mockUseUserProfileDto = vi.mocked(useUserProfileDto);

describe('useEditProfileData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
        isAuthorized: true,
      })
    );

    expect(result.current.isMentor).toBe(false);
    expect(result.current.isPageLoading).toBe(true);
    expect(result.current.isError).toBe(false);
    expect(result.current.userDto).toBeNull();
  });

  it('sets loaded states and derives correct isMentor when isAuthorized is true and userDto is successfully fetched', () => {
    const mockUserDto = {
      id: 1,
      username: 'test_user',
      is_mentor: true,
    } as unknown as MentorProfileVO;

    mockUseUserProfileDto.mockReturnValue({
      userDto: mockUserDto,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() =>
      useEditProfileData({
        userId: 1,
        isAuthorized: true,
      })
    );

    expect(result.current.isMentor).toBe(true);
    expect(result.current.isPageLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.userDto).toEqual(mockUserDto);
  });

  it('keeps isPageLoading=true when unauthorized even if userDto is fetched', () => {
    const mockUserDto = {
      id: 1,
      username: 'test_user',
      is_mentor: true,
    } as unknown as MentorProfileVO;

    mockUseUserProfileDto.mockReturnValue({
      userDto: mockUserDto,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() =>
      useEditProfileData({
        userId: 1,
        isAuthorized: false,
      })
    );

    expect(result.current.isMentor).toBe(true); // Derived directly, but page remains in loading
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
        isAuthorized: true,
      })
    );

    expect(result.current.isMentor).toBe(false);
    expect(result.current.isPageLoading).toBe(false);
    expect(result.current.isError).toBe(true);
  });

  it('clears isError status on successful resolution', () => {
    const mockUserDto = {
      id: 1,
      username: 'test_user',
      is_mentor: false,
    } as unknown as MentorProfileVO;

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
          isAuthorized: true,
        },
      }
    );

    expect(result.current.isError).toBe(true);
    expect(result.current.isPageLoading).toBe(false);

    // 2) Mock resolution
    mockUseUserProfileDto.mockReturnValue({
      userDto: mockUserDto,
      isLoading: false,
      error: null,
    });

    rerender({
      userId: 1,
      isAuthorized: true,
    });

    expect(result.current.isError).toBe(false);
    expect(result.current.isPageLoading).toBe(false);
    expect(result.current.userDto).toEqual(mockUserDto);
  });
});
