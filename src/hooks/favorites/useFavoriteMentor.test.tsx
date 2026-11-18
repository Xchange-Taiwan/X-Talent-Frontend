import { act, renderHook } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { trackEvent } from '@/lib/analytics';
import type { ResolvedIdentity } from '@/lib/auth/sessionHint';
import {
  favoriteMentorsReadModel,
  getPendingFavoriteMentorId,
  resetFavoriteMentorsReadModel,
} from '@/lib/favorites';
import type { MentorType } from '@/types/mentor';

import { useFavoriteMentor } from './useFavoriteMentor';

const pushMock = vi.fn();
let currentIdentity: ResolvedIdentity = fromPartial<ResolvedIdentity>({
  state: 'confirmed-guest',
});

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
  useResolvedIdentity: () => currentIdentity,
}));

describe('useFavoriteMentor (#941)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetFavoriteMentorsReadModel();
    vi.clearAllMocks();
    currentIdentity = fromPartial<ResolvedIdentity>({
      state: 'confirmed-guest',
    });
  });

  it('delegates guest bookmark click to store (saving pending ID + emitting auth_gate_triggered once) and navigates to signInUrl', async () => {
    const { result } = renderHook(() =>
      useFavoriteMentor({ mentorId: 7488864558908473, feature: 'mentor_pool' })
    );

    await act(async () => {
      await result.current.handleToggleFavorite();
    });

    expect(getPendingFavoriteMentorId()).toBe(7488864558908473);
    expect(trackEvent).toHaveBeenCalledTimes(1);
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
      '/auth/signin?callbackUrl=%2Fprofile%2F7488864558908473'
    );
  });

  it('subscribes directly to singleton MentorBookmarkState for authenticated members, blocks self & hint-only toggles, and updates optimistically', async () => {
    let resolveAdd!: () => void;
    const addFavoriteMentor = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveAdd = resolve;
        })
    );
    favoriteMentorsReadModel.setTransport({
      fetchFavoriteMentors: vi.fn().mockResolvedValue([]),
      addFavoriteMentor,
      removeFavoriteMentor: vi.fn().mockResolvedValue(undefined),
    });

    // hint-only identity suppresses premature guest redirect or mutation
    currentIdentity = fromPartial<ResolvedIdentity>({ state: 'hint-only' });
    const { result: hintRes } = renderHook(() =>
      useFavoriteMentor({ mentorId: 101, feature: 'profile' })
    );
    expect(hintRes.current.isIdentityUnresolved).toBe(true);
    await act(async () => {
      await hintRes.current.handleToggleFavorite();
    });
    expect(addFavoriteMentor).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();

    // self-profile reports isSelf: true and no-ops toggle
    currentIdentity = fromPartial<ResolvedIdentity>({
      state: 'confirmed-member',
      userId: '101',
    });
    const { result: selfRes } = renderHook(() =>
      useFavoriteMentor({ mentorId: 101, feature: 'profile' })
    );
    expect(selfRes.current.isSelf).toBe(true);
    expect(selfRes.current.isFavorited).toBe(false);
    await act(async () => {
      await selfRes.current.handleToggleFavorite();
    });
    expect(addFavoriteMentor).not.toHaveBeenCalled();

    // confirmed-member transitions idle -> pending+favorited -> settled favorited
    currentIdentity = fromPartial<ResolvedIdentity>({
      state: 'confirmed-member',
      userId: '999',
    });
    favoriteMentorsReadModel.seed('999', []);
    const snapshot = fromPartial<MentorType>({
      user_id: 101,
      name: 'Mentor 101',
    });
    const { result: memberRes } = renderHook(() =>
      useFavoriteMentor({
        mentorId: 101,
        mentorSnapshot: snapshot,
        feature: 'profile',
      })
    );

    expect(memberRes.current.isFavorited).toBe(false);
    expect(memberRes.current.isPending).toBe(false);

    let toggleDone!: Promise<void>;
    act(() => {
      toggleDone = memberRes.current.handleToggleFavorite();
    });

    expect(memberRes.current.isFavorited).toBe(true);
    expect(memberRes.current.isPending).toBe(true);

    await act(async () => {
      resolveAdd();
      await toggleDone;
    });

    expect(memberRes.current.isFavorited).toBe(true);
    expect(memberRes.current.isPending).toBe(false);
    expect(trackEvent).toHaveBeenCalledWith({
      name: 'mentor_bookmark_toggle',
      feature: 'profile',
      metadata: {
        mentor_id: 101,
        action: 'add',
      },
    });
  });
});
