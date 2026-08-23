import { renderHook } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUserProfileDto } from '@/hooks/user/user-data/useUserProfileDto';
import { registerOptimisticAvatar } from '@/lib/profile/optimisticAvatar';

import { useCurrentAvatar } from './useCurrentAvatar';

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}));

vi.mock('@/hooks/user/user-data/useUserProfileDto', () => ({
  useUserProfileDto: vi.fn(),
}));

const mockUseSession = vi.mocked(useSession);
const mockUseUserProfileDto = vi.mocked(useUserProfileDto);

describe('useCurrentAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerOptimisticAvatar(123, null);
  });

  it('returns avatar from cached userDto when present and session has no avatar', () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: '123', avatar: undefined } },
      status: 'authenticated',
    } as unknown as ReturnType<typeof useSession>);
    mockUseUserProfileDto.mockReturnValue({
      userDto: { avatar: 'cached-avatar.png' },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useUserProfileDto>);

    const { result } = renderHook(() => useCurrentAvatar());

    expect(result.current).toBe('cached-avatar.png');
    expect(mockUseUserProfileDto).toHaveBeenCalledWith(
      123,
      'zh_TW',
      undefined,
      { enabled: false }
    );
  });

  it('prioritizes session avatar over cached userDto when both are present and no optimistic transition is active', () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: '123', avatar: 'session-avatar.png' } },
      status: 'authenticated',
    } as unknown as ReturnType<typeof useSession>);
    mockUseUserProfileDto.mockReturnValue({
      userDto: { avatar: 'stale-cached-avatar.png' },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useUserProfileDto>);

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

    const { result } = renderHook(() => useCurrentAvatar());

    expect(result.current).toBeNull();
  });

  it('returns optimistic avatar during transition period, prioritizing it over both session and cached userDto', () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: '123', avatar: 'session-avatar.png' } },
      status: 'authenticated',
    } as unknown as ReturnType<typeof useSession>);
    mockUseUserProfileDto.mockReturnValue({
      userDto: { avatar: 'cached-avatar.png' },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useUserProfileDto>);

    // Register an optimistic avatar for user 123
    registerOptimisticAvatar(123, 'optimistic-avatar.png');

    const { result } = renderHook(() => useCurrentAvatar());

    expect(result.current).toBe('optimistic-avatar.png');
  });
});
