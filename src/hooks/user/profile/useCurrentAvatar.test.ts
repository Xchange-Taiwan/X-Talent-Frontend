import { renderHook } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getLastPrimedTime,
  useUserProfileDto,
} from '@/hooks/user/user-data/useUserProfileDto';

import { useCurrentAvatar } from './useCurrentAvatar';

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}));

vi.mock('@/hooks/user/user-data/useUserProfileDto', () => ({
  useUserProfileDto: vi.fn(),
  getLastPrimedTime: vi.fn(() => 0),
}));

const mockUseSession = vi.mocked(useSession);
const mockUseUserProfileDto = vi.mocked(useUserProfileDto);
const mockGetLastPrimedTime = vi.mocked(getLastPrimedTime);

describe('useCurrentAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns avatar from cached userDto when present and in transition window', () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: '123', avatar: 'session-avatar.png' } },
      status: 'authenticated',
    } as unknown as ReturnType<typeof useSession>);
    mockUseUserProfileDto.mockReturnValue({
      userDto: { avatar: 'cached-avatar.png' },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useUserProfileDto>);
    // Active transition window (primed just now)
    mockGetLastPrimedTime.mockReturnValue(Date.now());

    const { result } = renderHook(() => useCurrentAvatar());

    expect(result.current).toBe('cached-avatar.png');
    expect(mockUseUserProfileDto).toHaveBeenCalledWith(
      123,
      'zh_TW',
      undefined,
      { enabled: false }
    );
  });

  it('returns session avatar when outside transition window even if cached userDto is present', () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: '123', avatar: 'session-avatar.png' } },
      status: 'authenticated',
    } as unknown as ReturnType<typeof useSession>);
    mockUseUserProfileDto.mockReturnValue({
      userDto: { avatar: 'cached-avatar.png' },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useUserProfileDto>);
    // Outside transition window (primed 15s ago)
    mockGetLastPrimedTime.mockReturnValue(Date.now() - 15000);

    const { result } = renderHook(() => useCurrentAvatar());

    expect(result.current).toBe('session-avatar.png');
    expect(mockUseUserProfileDto).toHaveBeenCalledWith(
      123,
      'zh_TW',
      undefined,
      { enabled: false }
    );
  });

  it('returns session avatar when userDto is not present', () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: '123', avatar: 'session-avatar.png' } },
      status: 'authenticated',
    } as unknown as ReturnType<typeof useSession>);
    mockUseUserProfileDto.mockReturnValue({
      userDto: null,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useUserProfileDto>);
    mockGetLastPrimedTime.mockReturnValue(0);

    const { result } = renderHook(() => useCurrentAvatar());

    expect(result.current).toBe('session-avatar.png');
  });

  it('returns null when neither is present', () => {
    mockUseSession.mockReturnValue({
      data: undefined,
      status: 'loading',
    } as unknown as ReturnType<typeof useSession>);
    mockUseUserProfileDto.mockReturnValue({
      userDto: null,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useUserProfileDto>);
    mockGetLastPrimedTime.mockReturnValue(0);

    const { result } = renderHook(() => useCurrentAvatar());

    expect(result.current).toBeNull();
  });
});
