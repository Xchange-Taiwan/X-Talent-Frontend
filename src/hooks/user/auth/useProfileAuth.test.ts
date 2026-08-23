import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

const mockUseResolvedIdentity = vi.fn();
vi.mock('./useResolvedIdentity', () => ({
  useResolvedIdentity: () => mockUseResolvedIdentity(),
}));

import {
  authenticatedIdentity,
  buildResolvedIdentity,
  GUEST_IDENTITY as GUEST,
  UNKNOWN_IDENTITY as UNKNOWN,
} from '@/test/mocks/identity';
import { mockRouter } from '@/test/mocks/navigation';

import { useProfileAuth } from './useProfileAuth';

const PAGE_USER_ID = 'test-user-id';

// Every case below is a `ResolvedIdentity` - the single object `useResolvedIdentity`
// (mocked here) hands to `useIdentity`, which `useProfileAuth` reads unchanged.
const AUTHENTICATED_MATCHING = authenticatedIdentity(PAGE_USER_ID);

describe('useProfileAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseResolvedIdentity.mockReturnValue(AUTHENTICATED_MATCHING);
  });

  it('status: loading and hint: unknown (no cookie) → isAuthorized is false, router.push is NOT called', async () => {
    mockUseResolvedIdentity.mockReturnValue(UNKNOWN);

    const { result } = await act(async () =>
      renderHook(() => useProfileAuth(PAGE_USER_ID))
    );

    expect(result.current.isAuthorized).toBe(false);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('status: loading and hint: guest → triggers immediate redirect to "/"', async () => {
    mockUseResolvedIdentity.mockReturnValue(GUEST);

    const { result } = await act(async () =>
      renderHook(() => useProfileAuth(PAGE_USER_ID))
    );

    expect(mockRouter.push).toHaveBeenCalledWith('/');
    expect(result.current.isAuthorized).toBe(false);
  });

  it('status: loading and hint: authenticated with mismatched userId → triggers immediate redirect to "/"', async () => {
    mockUseResolvedIdentity.mockReturnValue(
      buildResolvedIdentity({
        isLoggedIn: true,
        userId: 'different-user-id',
      })
    );

    const { result } = await act(async () =>
      renderHook(() => useProfileAuth(PAGE_USER_ID))
    );

    expect(mockRouter.push).toHaveBeenCalledWith('/');
    expect(result.current.isAuthorized).toBe(false);
  });

  it('status: loading and hint: authenticated with matching userId → authorizes immediately without redirect', async () => {
    mockUseResolvedIdentity.mockReturnValue(
      buildResolvedIdentity({
        isLoggedIn: true,
        userId: PAGE_USER_ID,
      })
    );

    const { result } = await act(async () =>
      renderHook(() => useProfileAuth(PAGE_USER_ID))
    );

    expect(result.current.isAuthorized).toBe(true);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('session has no user id → router.push("/") is called, isAuthorized is false', async () => {
    mockUseResolvedIdentity.mockReturnValue(GUEST);

    const { result } = await act(async () =>
      renderHook(() => useProfileAuth(PAGE_USER_ID))
    );

    expect(mockRouter.push).toHaveBeenCalledWith('/');
    expect(result.current.isAuthorized).toBe(false);
  });

  it('loginUserId !== pageUserId → router.push("/") is called, isAuthorized is false', async () => {
    mockUseResolvedIdentity.mockReturnValue({
      ...AUTHENTICATED_MATCHING,
      userId: 'different-user-id',
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
    mockUseResolvedIdentity.mockReturnValue(UNKNOWN);
    const { result } = renderHook(() => useProfileAuth(PAGE_USER_ID));
    expect(result.current.isAuthorized).toBe(false);
  });

  it('lazy-inits isAuthorized to false when loading (to avoid hydration mismatch) even if hint matches pageUserId, but resolves to true after hint updates', async () => {
    // First render returns unknown (isAuthorized is false)
    mockUseResolvedIdentity.mockReturnValueOnce(UNKNOWN);
    // Second render returns authenticated matching userId
    mockUseResolvedIdentity.mockReturnValue(
      buildResolvedIdentity({
        isLoggedIn: true,
        userId: PAGE_USER_ID,
      })
    );

    const { result, rerender } = renderHook(() => useProfileAuth(PAGE_USER_ID));
    // Verify it was false on initial render
    expect(result.current.isAuthorized).toBe(false);

    // Re-render to let the hook resolve
    rerender();
    expect(result.current.isAuthorized).toBe(true);
  });

  it('lazy-inits isAuthorized to false when session is authenticated but does not match pageUserId', () => {
    mockUseResolvedIdentity.mockReturnValue({
      ...AUTHENTICATED_MATCHING,
      userId: 'different-user-id',
    });
    const { result } = renderHook(() => useProfileAuth(PAGE_USER_ID));
    expect(result.current.isAuthorized).toBe(false);
  });

  it('does not trigger redirect in useProfileAuth during loading when isResolvingUser is true', async () => {
    mockUseResolvedIdentity.mockReturnValue(
      buildResolvedIdentity({
        isLoggedIn: true,
        isResolvingUser: true,
      })
    );

    const { result } = await act(async () =>
      renderHook(() => useProfileAuth(PAGE_USER_ID))
    );

    expect(result.current.isAuthorized).toBe(false);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
