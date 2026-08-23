import { renderHook } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUserProfileDto } from '@/hooks/user/user-data/useUserProfileDto';

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
  });

  it('returns avatar from cached userDto when present', () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: '123', avatar: 'session-avatar.png' } },
      status: 'authenticated',
    } as any);
    mockUseUserProfileDto.mockReturnValue({
      userDto: { avatar: 'cached-avatar.png' },
      isLoading: false,
      error: null,
    } as any);

    const { result } = renderHook(() => useCurrentAvatar());

    expect(result.current).toBe('cached-avatar.png');
    expect(mockUseUserProfileDto).toHaveBeenCalledWith(123, 'zh_TW');
  });

  it('returns session avatar when userDto is not present', () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: '123', avatar: 'session-avatar.png' } },
      status: 'authenticated',
    } as any);
    mockUseUserProfileDto.mockReturnValue({
      userDto: null,
      isLoading: false,
      error: null,
    } as any);

    const { result } = renderHook(() => useCurrentAvatar());

    expect(result.current).toBe('session-avatar.png');
  });

  it('returns null when neither is present', () => {
    mockUseSession.mockReturnValue({
      data: undefined,
      status: 'loading',
    } as any);
    mockUseUserProfileDto.mockReturnValue({
      userDto: null,
      isLoading: true,
      error: null,
    } as any);

    const { result } = renderHook(() => useCurrentAvatar());

    expect(result.current).toBeNull();
  });
});
