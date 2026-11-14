import { render, screen, waitFor } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Toaster } from '@/components/ui/toaster';
import { clearToasts } from '@/components/ui/use-toast';
import type { UserType } from '@/hooks/user/user-data/useUserData';
import * as analyticsModule from '@/lib/analytics';
import {
  getPendingFavoriteMentorId,
  savePendingFavoriteMentor,
} from '@/lib/favorites';
import {
  type FavoriteMentorServiceAdapter,
  favoriteMentorStore,
  resetFavoriteMentorStore,
} from '@/stores/favoriteMentorStore';

import {
  FAVORITE_SELF_BLOCKED_TOAST_MESSAGE,
  useConsumePendingFavorite,
  type UseConsumePendingFavoriteOptions,
} from './useConsumePendingFavorite';
import { FAVORITE_MENTOR_ERROR_TOAST_MESSAGE } from './useFavoriteMentor';

function buildMentorUserData(overrides: Partial<UserType> = {}): UserType {
  return fromPartial<UserType>({
    user_id: 101,
    name: 'Zahra Mirzakhani',
    avatar: '',
    job_title: 'Senior UX Designer',
    company: 'CreativeUX',
    is_mentor: true,
    want_position: [],
    want_skill: [],
    want_topic: [],
    have_skill: [{ subject_group: 'UX', subject: '產品設計' }],
    have_topic: [{ subject_group: 'CAREER', subject: '職涯規劃' }],
    ...overrides,
  });
}

function Harness(props: UseConsumePendingFavoriteOptions) {
  useConsumePendingFavorite(props);
  return <Toaster />;
}

describe('useConsumePendingFavorite', () => {
  const fetchMock =
    vi.fn<FavoriteMentorServiceAdapter['fetchFavoriteMentors']>();
  const addMock = vi.fn<FavoriteMentorServiceAdapter['addFavoriteMentor']>();
  const removeMock =
    vi.fn<FavoriteMentorServiceAdapter['removeFavoriteMentor']>();

  beforeEach(() => {
    window.localStorage.clear();
    clearToasts();
    resetFavoriteMentorStore();
    vi.clearAllMocks();
    fetchMock.mockResolvedValue([]);
    addMock.mockResolvedValue(undefined);
    removeMock.mockResolvedValue(undefined);
    favoriteMentorStore.setAdapter({
      fetchFavoriteMentors: fetchMock,
      addFavoriteMentor: addMock,
      removeFavoriteMentor: removeMock,
    });
  });

  it('waits until loginUserId is confirmed and userLoading is false before consuming pending favorite', async () => {
    const trackEventSpy = vi.spyOn(analyticsModule, 'trackEvent');
    savePendingFavoriteMentor(101);
    const mentorData = buildMentorUserData({ user_id: 101 });

    const { rerender } = render(
      <Harness
        pageUserId="101"
        loginUserId=""
        userData={mentorData}
        userLoading={false}
      />
    );

    expect(getPendingFavoriteMentorId()).toBe(101);
    expect(addMock).not.toHaveBeenCalled();

    rerender(
      <Harness
        pageUserId="101"
        loginUserId="999"
        userData={null}
        userLoading={true}
      />
    );

    expect(getPendingFavoriteMentorId()).toBe(101);
    expect(addMock).not.toHaveBeenCalled();

    rerender(
      <Harness
        pageUserId="101"
        loginUserId="999"
        userData={mentorData}
        userLoading={false}
      />
    );

    await waitFor(() => {
      expect(addMock).toHaveBeenCalledTimes(1);
    });
    expect(addMock).toHaveBeenCalledWith(101);
    expect(favoriteMentorStore.isFavorited(101)).toBe(true);
    expect(getPendingFavoriteMentorId()).toBeNull();
    await waitFor(() => {
      expect(trackEventSpy).toHaveBeenCalledWith({
        name: 'mentor_bookmark_toggle',
        feature: 'profile',
        metadata: {
          mentor_id: 101,
          action: 'add',
          button_location: 'profile_header',
        },
      });
    });
  });

  it('blocks self-favorite without calling API and displays destructive toast "無法收藏自己"', async () => {
    savePendingFavoriteMentor(101);
    const mentorData = buildMentorUserData({ user_id: 101 });

    render(
      <Harness
        pageUserId="101"
        loginUserId="101"
        userData={mentorData}
        userLoading={false}
      />
    );

    expect(
      await screen.findByText(FAVORITE_SELF_BLOCKED_TOAST_MESSAGE)
    ).toBeVisible();
    expect(addMock).not.toHaveBeenCalled();
    expect(favoriteMentorStore.isFavorited(101)).toBe(false);
    expect(getPendingFavoriteMentorId()).toBeNull();
  });

  it('rolls back favorite state and shows destructive error toast when auto-favorite API fails', async () => {
    savePendingFavoriteMentor(101);
    addMock.mockRejectedValueOnce(new Error('500 Server Error'));
    const mentorData = buildMentorUserData({ user_id: 101 });

    render(
      <Harness
        pageUserId="101"
        loginUserId="999"
        userData={mentorData}
        userLoading={false}
      />
    );

    expect(
      await screen.findByText(FAVORITE_MENTOR_ERROR_TOAST_MESSAGE)
    ).toBeVisible();
    expect(favoriteMentorStore.isFavorited(101)).toBe(false);
    expect(getPendingFavoriteMentorId()).toBeNull();
  });

  it('preserves pending favorite when userData is null or belongs to another user_id until matching mentor data arrives', async () => {
    savePendingFavoriteMentor(101);
    const staleMentorData = buildMentorUserData({ user_id: 202 });
    const targetMentorData = buildMentorUserData({ user_id: 101 });

    const { rerender } = render(
      <Harness
        pageUserId="101"
        loginUserId="999"
        userData={staleMentorData}
        userLoading={false}
      />
    );

    expect(getPendingFavoriteMentorId()).toBe(101);
    expect(addMock).not.toHaveBeenCalled();

    rerender(
      <Harness
        pageUserId="101"
        loginUserId="999"
        userData={null}
        userLoading={false}
      />
    );

    expect(getPendingFavoriteMentorId()).toBe(101);
    expect(addMock).not.toHaveBeenCalled();

    rerender(
      <Harness
        pageUserId="101"
        loginUserId="999"
        userData={targetMentorData}
        userLoading={false}
      />
    );

    await waitFor(() => {
      expect(addMock).toHaveBeenCalledTimes(1);
    });
    expect(addMock).toHaveBeenCalledWith(101);
    expect(getPendingFavoriteMentorId()).toBeNull();
  });

  it('does not call addFavoriteMentor again when mentor is already favorited on the server', async () => {
    savePendingFavoriteMentor(101);
    const mentorData = buildMentorUserData({ user_id: 101 });
    fetchMock.mockResolvedValueOnce([
      {
        user_id: 101,
        name: 'Zahra Mirzakhani',
        avatar: '',
        job_title: 'Senior UX Designer',
        company: 'CreativeUX',
        years_of_experience: '',
        location: '',
        personal_statement: '',
        about: '',
        seniority_level: '',
        industry: null,
        want_position: [],
        want_skill: [],
        want_topic: [],
        have_skill: [],
        have_topic: [],
        updated_at: null,
        stats: null,
      },
    ]);

    render(
      <Harness
        pageUserId="101"
        loginUserId="999"
        userData={mentorData}
        userLoading={false}
      />
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(addMock).not.toHaveBeenCalled();
    expect(favoriteMentorStore.isFavorited(101)).toBe(true);
    expect(getPendingFavoriteMentorId()).toBeNull();
  });

  it('suppresses failure toast when auto-favorite API rejects after logout or account switch', async () => {
    savePendingFavoriteMentor(101);
    let rejectPut!: (reason?: unknown) => void;
    addMock.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectPut = reject;
        })
    );
    const mentorData = buildMentorUserData({ user_id: 101 });

    render(
      <Harness
        pageUserId="101"
        loginUserId="999"
        userData={mentorData}
        userLoading={false}
      />
    );

    await waitFor(() => {
      expect(addMock).toHaveBeenCalledTimes(1);
    });

    await favoriteMentorStore.syncUser(null);
    rejectPut(new Error('Aborted on logout'));

    await waitFor(() => {
      expect(favoriteMentorStore.getState().pendingMentorIds.size).toBe(0);
    });

    expect(
      screen.queryByText(FAVORITE_MENTOR_ERROR_TOAST_MESSAGE)
    ).not.toBeInTheDocument();
  });
});
