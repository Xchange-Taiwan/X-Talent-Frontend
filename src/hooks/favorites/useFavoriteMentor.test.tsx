import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { trackEvent } from '@/lib/analytics';
import { favoriteMentorsReadModel } from '@/lib/favorites';

import { useFavoriteMentor } from './useFavoriteMentor';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('@/lib/featureFlags', () => ({
  isFavoritesEnabled: () => true,
}));

vi.mock('@/hooks/user/auth/useResolvedIdentity', () => ({
  useResolvedIdentity: () => ({
    state: 'confirmed-guest',
    userId: null,
  }),
}));

describe('useFavoriteMentor guest auth gate analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(favoriteMentorsReadModel, 'toggle').mockResolvedValue({
      status: 'guest_redirect',
      signInUrl: '/auth/signin?callbackUrl=%2Fmentor-pool',
      nextFavorited: false,
    });
  });

  it('tracks auth_gate_triggered with gate_feature="favorites" when a guest clicks bookmark', async () => {
    const { result } = renderHook(() =>
      useFavoriteMentor({ mentorId: 7488864558908473, feature: 'mentor_pool' })
    );

    await act(async () => {
      await result.current.handleToggleFavorite();
    });

    expect(trackEvent).toHaveBeenCalledWith({
      name: 'auth_gate_triggered',
      feature: 'favorites',
      metadata: {
        gate_feature: 'favorites',
        trigger_type: 'click_cta',
        mentor_id: 7488864558908473,
      },
    });
    expect(pushMock).toHaveBeenCalledWith(
      '/auth/signin?callbackUrl=%2Fmentor-pool'
    );
  });
});
