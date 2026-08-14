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

vi.mock('@/hooks/user/auth/useSessionHint', () => ({
  useSessionHint: vi.fn(),
}));

import { useSessionHint } from '@/hooks/user/auth/useSessionHint';
import { mockRouter } from '@/test/mocks/navigation';
import { mockSession, mockUseSession } from '@/test/mocks/nextAuth';

import { useProfileAuth } from './useProfileAuth';

const PAGE_USER_ID = 'test-user-id';
const mockUseSessionHint = vi.mocked(useSessionHint);

describe('useProfileAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
    });
    // Default mock behavior for useSessionHint
    mockUseSessionHint.mockReturnValue({ status: 'unknown' });
  });

  it('status: loading and hint: unknown → isAuthorized is false, router.push is NOT called', async () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });
    mockUseSessionHint.mockReturnValue({ status: 'unknown' });

    const { result } = await act(async () =>
      renderHook(() => useProfileAuth(PAGE_USER_ID))
    );

    expect(result.current.isAuthorized).toBe(false);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('status: loading and hint: guest (no cookie) → triggers immediate redirect to "/"', async () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });
    mockUseSessionHint.mockReturnValue({ status: 'guest' });

    const { result } = await act(async () =>
      renderHook(() => useProfileAuth(PAGE_USER_ID))
    );

    expect(mockRouter.push).toHaveBeenCalledWith('/');
    expect(result.current.isAuthorized).toBe(false);
  });

  it('status: loading and hint: authenticated with mismatched userId → triggers immediate redirect to "/"', async () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });
    mockUseSessionHint.mockReturnValue({
      status: 'authenticated',
      isMentor: true,
      userId: 'different-user-id',
    });

    const { result } = await act(async () =>
      renderHook(() => useProfileAuth(PAGE_USER_ID))
    );

    expect(mockRouter.push).toHaveBeenCalledWith('/');
    expect(result.current.isAuthorized).toBe(false);
  });

  it('status: loading and hint: authenticated with matching userId → authorizes immediately without redirect', async () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });
    mockUseSessionHint.mockReturnValue({
      status: 'authenticated',
      isMentor: true,
      userId: PAGE_USER_ID,
    });

    const { result } = await act(async () =>
      renderHook(() => useProfileAuth(PAGE_USER_ID))
    );

    expect(result.current.isAuthorized).toBe(true);
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
    mockUseSessionHint.mockReturnValue({
      status: 'authenticated',
      isMentor: true,
      userId: PAGE_USER_ID,
    });

    const { result } = await act(async () =>
      renderHook(() => useProfileAuth(PAGE_USER_ID))
    );

    expect(result.current.isAuthorized).toBe(true);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('lazy-inits isAuthorized to true on the initial render when session already matches pageUserId', () => {
    mockUseSessionHint.mockReturnValue({
      status: 'authenticated',
      isMentor: true,
      userId: PAGE_USER_ID,
    });
    const { result } = renderHook(() => useProfileAuth(PAGE_USER_ID));
    expect(result.current.isAuthorized).toBe(true);
  });

  it('lazy-inits isAuthorized to false when session is still loading on first render and hint is unknown', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });
    mockUseSessionHint.mockReturnValue({ status: 'unknown' });
    const { result } = renderHook(() => useProfileAuth(PAGE_USER_ID));
    expect(result.current.isAuthorized).toBe(false);
  });

  it('lazy-inits isAuthorized to true on first render when loading but hint is matching pageUserId', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });
    mockUseSessionHint.mockReturnValue({
      status: 'authenticated',
      isMentor: true,
      userId: PAGE_USER_ID,
    });
    const { result } = renderHook(() => useProfileAuth(PAGE_USER_ID));
    expect(result.current.isAuthorized).toBe(true);
  });

  it('lazy-inits isAuthorized to false when session is authenticated but does not match pageUserId', () => {
    mockUseSession.mockReturnValue({
      data: {
        ...mockSession,
        user: { ...mockSession.user, id: 'different-user-id' },
      },
      status: 'authenticated',
    });
    const { result } = renderHook(() => useProfileAuth(PAGE_USER_ID));
    expect(result.current.isAuthorized).toBe(false);
  });
});
