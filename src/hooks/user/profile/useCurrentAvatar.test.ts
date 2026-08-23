import { renderHook } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { registerOptimisticAvatar } from '@/lib/profile/optimisticAvatar';

import { useCurrentAvatar } from './useCurrentAvatar';

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}));

const mockUseSession = vi.mocked(useSession);

describe('useCurrentAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerOptimisticAvatar(123, null);
  });

  it('returns session avatar when present', () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: '123', avatar: 'session-avatar.png' } },
      status: 'authenticated',
    } as unknown as ReturnType<typeof useSession>);

    const { result } = renderHook(() => useCurrentAvatar());

    expect(result.current).toBe('session-avatar.png');
  });

  it('returns null when session has no avatar', () => {
    mockUseSession.mockReturnValue({
      data: undefined,
      status: 'loading',
    } as unknown as ReturnType<typeof useSession>);

    const { result } = renderHook(() => useCurrentAvatar());

    expect(result.current).toBeNull();
  });

  it('returns optimistic avatar during transition period, prioritizing it over session avatar', () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: '123', avatar: 'session-avatar.png' } },
      status: 'authenticated',
    } as unknown as ReturnType<typeof useSession>);

    // Register an optimistic avatar for user 123
    registerOptimisticAvatar(123, 'optimistic-avatar.png');

    const { result } = renderHook(() => useCurrentAvatar());

    expect(result.current).toBe('optimistic-avatar.png');
  });
});
