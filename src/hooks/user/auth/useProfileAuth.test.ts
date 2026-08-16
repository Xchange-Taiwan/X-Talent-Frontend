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

const mockUseSessionHint = vi.fn();
vi.mock('./useSessionHint', () => ({
  useSessionHint: () => mockUseSessionHint(),
}));

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
    mockUseSessionHint.mockReturnValue({ status: 'unknown' });
  });

  it('status: loading and hint: unknown (no cookie) → isAuthorized is false, router.push is NOT called', async () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });
    mockUseSessionHint.mockReturnValue({ status: 'unknown' });

    const { result } = await act(async () =>
      renderHook(() => useProfileAuth(PAGE_USER_ID))
    );

    expect(result.current.isAuthorized).toBe(false);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('status: loading and hint: guest → triggers immediate redirect to "/"', async () => {
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
      userId: 'different-user-id',
      isMentor: false,
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
      userId: PAGE_USER_ID,
      isMentor: false,
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
    const { result } = await act(async () =>
      renderHook(() => useProfileAuth(PAGE_USER_ID))
    );

    expect(result.current.isAuthorized).toBe(true);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('lazy-inits isAuthorized to true on the initial render when session already matches pageUserId', () => {
    const { result } = renderHook(() => useProfileAuth(PAGE_USER_ID));
    expect(result.current.isAuthorized).toBe(true);
  });

  it('lazy-inits isAuthorized to false when session is still loading on first render and hint is unknown', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });
    mockUseSessionHint.mockReturnValue({ status: 'unknown' });
    const { result } = renderHook(() => useProfileAuth(PAGE_USER_ID));
    expect(result.current.isAuthorized).toBe(false);
  });

  it('lazy-inits isAuthorized to false when loading (to avoid hydration mismatch) even if hint matches pageUserId, but resolves to true after hint updates', async () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });
    // First render returns unknown (isAuthorized is false)
    mockUseSessionHint.mockReturnValueOnce({ status: 'unknown' });
    // Second render returns authenticated matching userId
    mockUseSessionHint.mockReturnValue({
      status: 'authenticated',
      userId: PAGE_USER_ID,
      isMentor: false,
    });

    const { result, rerender } = renderHook(() => useProfileAuth(PAGE_USER_ID));
    // Verify it was false on initial render
    expect(result.current.isAuthorized).toBe(false);

    // Re-render to let the hook resolve
    rerender();
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
