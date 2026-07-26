import { renderHook } from '@testing-library/react';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  MockInstance,
  vi,
} from 'vitest';

import { useUserProfileDto } from '@/hooks/user/user-data/useUserProfileDto';
import { MentorProfileVO } from '@/services/profile/user';

import { useEditProfileData } from './useEditProfileData';

// Mock useUserProfileDto
vi.mock('@/hooks/user/user-data/useUserProfileDto', () => ({
  useUserProfileDto: vi.fn(),
}));

const mockUseUserProfileDto = vi.mocked(useUserProfileDto);

describe('useEditProfileData', () => {
  let originalFetch: typeof global.fetch;
  let consoleSpy: MockInstance;

  beforeAll(() => {
    // Suppress console.error during hook tests and prevent next-auth log rejections
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((url) => {
      if (String(url).includes('/api/auth/_log')) {
        return Promise.resolve(
          new Response(JSON.stringify({}), { status: 200 })
        );
      }
      return originalFetch(url);
    });
  });

  afterAll(() => {
    consoleSpy.mockRestore();
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initially returns false for isMentor/isError and null for userDto', () => {
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
    expect(result.current.isError).toBe(false);
    expect(result.current.userDto).toBeNull();
  });

  it('sets loaded states and derives correct isMentor when userDto is successfully fetched', () => {
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
    expect(result.current.isError).toBe(false);
    expect(result.current.userDto).toEqual(mockUserDto);
  });

  it('derives correct states even if userDto is fetched with different role', () => {
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

    expect(result.current.isMentor).toBe(true);
    expect(result.current.isError).toBe(false);
  });

  it('sets isError to true when fetching fails with an error', () => {
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
    expect(result.current.userDto).toEqual(mockUserDto);
  });

  it('safely serializes object errors to prevent Sentry PII capturing while preserving message debugging value', () => {
    const mockErrorObject = {
      message: 'Failed to fetch',
      config: { headers: { Authorization: 'Bearer token123' } },
    };

    mockUseUserProfileDto.mockReturnValue({
      userDto: null,
      isLoading: false,
      error: mockErrorObject as unknown as string,
    });

    renderHook(() =>
      useEditProfileData({
        userId: 1,
        isAuthorized: true,
      })
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to fetch user data:',
      'Failed to fetch'
    );
  });

  it('keeps isError as false when background focus revalidation fails but we already have userDto loaded', () => {
    const mockUserDto = {
      id: 1,
      username: 'test_user',
      is_mentor: false,
    } as unknown as MentorProfileVO;

    // 1) First render succeeds with data
    mockUseUserProfileDto.mockReturnValue({
      userDto: mockUserDto,
      isLoading: false,
      error: null,
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

    expect(result.current.isError).toBe(false);
    expect(result.current.userDto).toEqual(mockUserDto);

    // 2) SWR triggers background revalidation on window focus and fails with network error, but keeps cached userDto
    mockUseUserProfileDto.mockReturnValue({
      userDto: mockUserDto,
      isLoading: false,
      error: 'Background Focus Sync Timeout',
    });

    rerender({
      userId: 1,
      isAuthorized: true,
    });

    // It should tolerate background error, keeping isError=false so the form does not unmount!
    expect(result.current.isError).toBe(false);
    expect(result.current.userDto).toEqual(mockUserDto);
  });
});
