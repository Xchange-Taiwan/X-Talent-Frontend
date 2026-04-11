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

import { mockRouter } from '@/test/mocks/navigation';
import { mockSession, mockUseSession } from '@/test/mocks/nextAuth';

import { useProfileAuth } from './useProfileAuth';

const PAGE_USER_ID = 'test-user-id';

describe('useProfileAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
    });
  });

  it('status: loading → isAuthorized is false, router.push is NOT called', async () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });

    const { result } = await act(async () =>
      renderHook(() => useProfileAuth(PAGE_USER_ID))
    );

    expect(result.current.isAuthorized).toBe(false);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('session has no user id → router.push("/") is called, isAuthorized is false', async () => {
    mockUseSession.mockReturnValue({
      data: { ...mockSession, user: { ...mockSession.user, id: undefined } },
      status: 'authenticated',
    });

    const { result } = await act(async () =>
      renderHook(() => useProfileAuth(PAGE_USER_ID))
    );

    expect(mockRouter.push).toHaveBeenCalledWith('/');
    expect(result.current.isAuthorized).toBe(false);
  });

  it('loginUserId !== pageUserId → router.push("/") is called, isAuthorized is false', async () => {
    mockUseSession.mockReturnValue({
      data: {
        ...mockSession,
        user: { ...mockSession.user, id: 'different-user-id' },
      },
      status: 'authenticated',
    });

    const { result } = await act(async () =>
      renderHook(() => useProfileAuth(PAGE_USER_ID))
    );

    expect(mockRouter.push).toHaveBeenCalledWith('/');
    expect(result.current.isAuthorized).toBe(false);
  });

  it('loginUserId === pageUserId → isAuthorized is true, router.push is NOT called', async () => {
    const { result } = await act(async () =>
      renderHook(() => useProfileAuth(PAGE_USER_ID))
    );

    expect(result.current.isAuthorized).toBe(true);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
