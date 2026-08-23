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

import { buildResolvedIdentity } from '@/test/mocks/identity';
import { mockRouter } from '@/test/mocks/navigation';

import { useProfileAuth } from './useProfileAuth';

const PAGE_USER_ID = 'test-user-id';

describe('useProfileAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('explicit state-machine testing', () => {
    it('state: "unknown" → isAuthorized is false, isResolving is true, router.push is NOT called', async () => {
      mockUseResolvedIdentity.mockReturnValue(
        buildResolvedIdentity({ state: 'unknown' })
      );

      const { result } = await act(async () =>
        renderHook(() => useProfileAuth(PAGE_USER_ID))
      );

      expect(result.current.isAuthorized).toBe(false);
      expect(result.current.isResolving).toBe(true);
      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it('state: "hint-only" → isAuthorized is false, isResolving is true, router.push is NOT called', async () => {
      mockUseResolvedIdentity.mockReturnValue(
        buildResolvedIdentity({ state: 'hint-only' })
      );

      const { result } = await act(async () =>
        renderHook(() => useProfileAuth(PAGE_USER_ID))
      );

      expect(result.current.isAuthorized).toBe(false);
      expect(result.current.isResolving).toBe(true);
      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it('state: "confirmed-guest" → isAuthorized is false, isResolving is false, triggers immediate redirect to "/"', async () => {
      mockUseResolvedIdentity.mockReturnValue(
        buildResolvedIdentity({ state: 'confirmed-guest' })
      );

      const { result } = await act(async () =>
        renderHook(() => useProfileAuth(PAGE_USER_ID))
      );

      expect(result.current.isAuthorized).toBe(false);
      expect(result.current.isResolving).toBe(false);
      expect(mockRouter.push).toHaveBeenCalledWith('/');
    });

    it('state: "confirmed-member" with mismatched userId → isAuthorized is false, isResolving is false, triggers immediate redirect to "/"', async () => {
      mockUseResolvedIdentity.mockReturnValue(
        buildResolvedIdentity({
          state: 'confirmed-member',
          userId: 'different-user-id',
        })
      );

      const { result } = await act(async () =>
        renderHook(() => useProfileAuth(PAGE_USER_ID))
      );

      expect(result.current.isAuthorized).toBe(false);
      expect(result.current.isResolving).toBe(false);
      expect(mockRouter.push).toHaveBeenCalledWith('/');
    });

    it('state: "confirmed-member" with matching userId → isAuthorized is true, isResolving is false, authorizes immediately without redirect', async () => {
      mockUseResolvedIdentity.mockReturnValue(
        buildResolvedIdentity({
          state: 'confirmed-member',
          userId: PAGE_USER_ID,
        })
      );

      const { result } = await act(async () =>
        renderHook(() => useProfileAuth(PAGE_USER_ID))
      );

      expect(result.current.isAuthorized).toBe(true);
      expect(result.current.isResolving).toBe(false);
      expect(mockRouter.push).not.toHaveBeenCalled();
    });
  });

  describe('legacy support and hydration/rendering details', () => {
    it('lazy-inits isAuthorized to true on the initial render when session already matches pageUserId', () => {
      mockUseResolvedIdentity.mockReturnValue(
        buildResolvedIdentity({
          state: 'confirmed-member',
          userId: PAGE_USER_ID,
        })
      );
      const { result } = renderHook(() => useProfileAuth(PAGE_USER_ID));
      expect(result.current.isAuthorized).toBe(true);
      expect(result.current.isResolving).toBe(false);
    });

    it('lazy-inits isAuthorized to false and isResolving to true when session is still loading on first render and hint is unknown', () => {
      mockUseResolvedIdentity.mockReturnValue(
        buildResolvedIdentity({ state: 'unknown' })
      );
      const { result } = renderHook(() => useProfileAuth(PAGE_USER_ID));
      expect(result.current.isAuthorized).toBe(false);
      expect(result.current.isResolving).toBe(true);
    });

    it('lazy-inits isAuthorized to false when loading (to avoid hydration mismatch) even if hint matches pageUserId, but resolves to true after hint updates', async () => {
      // First render returns unknown
      mockUseResolvedIdentity.mockReturnValueOnce(
        buildResolvedIdentity({ state: 'unknown' })
      );
      // Second render returns authenticated matching userId
      mockUseResolvedIdentity.mockReturnValue(
        buildResolvedIdentity({
          state: 'confirmed-member',
          userId: PAGE_USER_ID,
        })
      );

      const { result, rerender } = renderHook(() =>
        useProfileAuth(PAGE_USER_ID)
      );
      // Verify it was false on initial render
      expect(result.current.isAuthorized).toBe(false);
      expect(result.current.isResolving).toBe(true);

      // Re-render to let the hook resolve
      rerender();
      expect(result.current.isAuthorized).toBe(true);
      expect(result.current.isResolving).toBe(false);
    });
  });
});
