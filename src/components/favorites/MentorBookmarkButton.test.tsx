import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionContext, type SessionContextValue } from 'next-auth/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Toaster } from '@/components/ui/toaster';
import { clearToasts } from '@/components/ui/use-toast';
import {
  FAVORITE_MENTOR_ERROR_TOAST_MESSAGE,
  useFavoriteMentor,
} from '@/hooks/favorites';
import * as analyticsModule from '@/lib/analytics';
import { getPendingFavoriteMentorId } from '@/lib/favorites';
import {
  type FavoriteMentorServiceAdapter,
  favoriteMentorStore,
  resetFavoriteMentorStore,
} from '@/stores/favoriteMentorStore';

import { MentorBookmarkButton } from './MentorBookmarkButton';

const routerPushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPushMock,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

function renderWithSession(
  ui: ReactNode,
  options: {
    userId?: string | null;
    status?: 'authenticated' | 'unauthenticated' | 'loading';
  } = {}
) {
  const {
    userId = '999',
    status = userId ? 'authenticated' : 'unauthenticated',
  } = options;

  const update = async () => null;
  const contextValue: SessionContextValue =
    status === 'authenticated' && userId
      ? {
          data: {
            user: {
              id: userId,
              email: 'mentee@example.com',
              name: 'Mentee User',
              onBoarding: true,
              isMentor: false,
            },
            accessToken: 'mock-token',
            expires: '2099-01-01T00:00:00.000Z',
          },
          status: 'authenticated',
          update,
        }
      : {
          data: null,
          status: status === 'loading' ? 'loading' : 'unauthenticated',
          update,
        };

  return render(
    <SessionContext.Provider value={contextValue}>
      {ui}
      <Toaster />
    </SessionContext.Provider>
  );
}

describe('MentorBookmarkButton', () => {
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
    document.cookie = 'session-hint=; path=/; max-age=0';
    fetchMock.mockResolvedValue([]);
    addMock.mockResolvedValue(undefined);
    removeMock.mockResolvedValue(undefined);
    favoriteMentorStore.setAdapter({
      fetchFavoriteMentors: fetchMock,
      addFavoriteMentor: addMock,
      removeFavoriteMentor: removeMock,
    });
  });

  it('toggles icon fill/color, updates aria-label & tooltip, stops card propagation, and fires analytics without duplicate declarative attributes', async () => {
    const user = userEvent.setup();
    const onParentCardClick = vi.fn();
    const trackEventSpy = vi.spyOn(analyticsModule, 'trackEvent');
    favoriteMentorStore.seedFavorites('999', []);

    renderWithSession(
      <div
        role="button"
        tabIndex={0}
        aria-label="導師卡片外層容器"
        onClick={onParentCardClick}
        onKeyDown={onParentCardClick}
      >
        <MentorBookmarkButton mentorId={101} mentorName="陳宥廷 Austin" />
      </div>
    );

    const button = screen.getByRole('button', { name: '收藏 陳宥廷 Austin' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveClass('group');
    expect(button).toHaveClass('border-background-border/60');
    expect(button).toHaveClass('bg-background-white/90');
    expect(button).not.toHaveAttribute('data-analytics-event');
    expect(button).not.toHaveAttribute('data-analytics-feature');
    expect(button.textContent).toBe('');

    const svgBefore = button.querySelector('svg');
    expect(svgBefore).not.toHaveClass('fill-current');
    expect(svgBefore).toHaveClass('group-hover:text-text-primary');

    // Hover reveals accessible tooltip
    await user.hover(button);
    expect(screen.getByRole('tooltip')).toHaveTextContent('收藏 陳宥廷 Austin');

    // Click toggles immediately without triggering parent card click or success toast
    await user.click(button);

    expect(onParentCardClick).not.toHaveBeenCalled();
    const activeButton = screen.getByRole('button', {
      name: '取消收藏 陳宥廷 Austin',
    });
    expect(activeButton).toHaveAttribute('aria-pressed', 'true');
    expect(activeButton).toHaveClass('border-brand-500/30');
    expect(activeButton).toHaveClass('bg-brand-50/95');

    const svgAfter = activeButton.querySelector('svg');
    expect(svgAfter).toHaveClass('fill-current');
    expect(svgAfter).toHaveClass('text-brand-500');
    expect(
      screen.queryByText(FAVORITE_MENTOR_ERROR_TOAST_MESSAGE)
    ).not.toBeInTheDocument();

    expect(trackEventSpy).toHaveBeenCalledTimes(1);
    expect(trackEventSpy).toHaveBeenCalledWith({
      name: 'mentor_bookmark_toggle',
      feature: 'mentor_pool',
      metadata: {
        mentor_id: 101,
        action: 'add',
      },
    });

    // Clicking again removes bookmark and emits remove action
    await user.click(activeButton);
    expect(
      screen.getByRole('button', { name: '收藏 陳宥廷 Austin' })
    ).toHaveAttribute('aria-pressed', 'false');
    expect(removeMock).toHaveBeenCalledWith(101);
    expect(trackEventSpy).toHaveBeenLastCalledWith({
      name: 'mentor_bookmark_toggle',
      feature: 'mentor_pool',
      metadata: {
        mentor_id: 101,
        action: 'remove',
      },
    });
  });

  it('tracks mentor_bookmark_toggle with feature "profile" when rendered on profile page', async () => {
    const user = userEvent.setup();
    const trackEventSpy = vi.spyOn(analyticsModule, 'trackEvent');
    favoriteMentorStore.seedFavorites('999', []);

    renderWithSession(
      <MentorBookmarkButton
        mentorId={101}
        mentorName="陳宥廷 Austin"
        analyticsFeature="profile"
        variant="outline"
      />
    );

    const button = screen.getByRole('button', { name: '收藏 陳宥廷 Austin' });
    expect(button).toHaveClass('border-background-border');
    expect(button).toHaveClass('bg-background-white');

    await user.click(button);

    const activeButton = screen.getByRole('button', {
      name: '取消收藏 陳宥廷 Austin',
    });
    expect(activeButton).toHaveClass('border-brand-100');
    expect(activeButton).toHaveClass('bg-brand-50');

    expect(trackEventSpy).toHaveBeenCalledWith({
      name: 'mentor_bookmark_toggle',
      feature: 'profile',
      metadata: {
        mentor_id: 101,
        action: 'add',
      },
    });
  });

  it('uses per-mentorId primitive snapshot selector so toggling one mentor does not re-render other mentor bookmark hooks', async () => {
    const user = userEvent.setup();
    favoriteMentorStore.seedFavorites('999', []);

    let mentor202RenderCount = 0;
    function UnrelatedMentorProbe() {
      mentor202RenderCount += 1;
      const { isFavorited } = useFavoriteMentor({ mentorId: 202 });
      return <span data-testid="probe-202">{String(isFavorited)}</span>;
    }

    renderWithSession(
      <>
        <MentorBookmarkButton mentorId={101} mentorName="陳宥廷 Austin" />
        <UnrelatedMentorProbe />
      </>
    );

    const baselineRenders = mentor202RenderCount;
    await user.click(
      screen.getByRole('button', { name: '收藏 陳宥廷 Austin' })
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: '取消收藏 陳宥廷 Austin' })
      ).not.toHaveAttribute('aria-busy');
    });

    expect(mentor202RenderCount).toBe(baselineRenders);
  });

  it('rolls back icon state and shows destructive toast when API mutation fails', async () => {
    const user = userEvent.setup();
    addMock.mockRejectedValueOnce(new Error('500 Internal Error'));
    favoriteMentorStore.seedFavorites('999', []);

    renderWithSession(
      <MentorBookmarkButton mentorId={101} mentorName="陳宥廷 Austin" />
    );

    const button = screen.getByRole('button', { name: '收藏 陳宥廷 Austin' });
    await user.click(button);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: '收藏 陳宥廷 Austin' })
      ).toHaveAttribute('aria-pressed', 'false');
    });

    expect(
      await screen.findByText(FAVORITE_MENTOR_ERROR_TOAST_MESSAGE)
    ).toBeVisible();
  });

  it('persists pendingFavoriteMentor in localStorage and redirects unauthenticated guest to /auth/signin with encoded profile callbackUrl (#756)', async () => {
    const user = userEvent.setup();

    renderWithSession(
      <MentorBookmarkButton mentorId={101} mentorName="陳宥廷 Austin" />,
      { userId: null, status: 'unauthenticated' }
    );

    const button = screen.getByRole('button', { name: '收藏 陳宥廷 Austin' });
    await user.click(button);

    expect(getPendingFavoriteMentorId()).toBe(101);
    expect(routerPushMock).toHaveBeenCalledWith(
      '/auth/signin?callbackUrl=%2Fprofile%2F101'
    );
    expect(addMock).not.toHaveBeenCalled();
  });

  it('renders nothing when logged-in mentor views their own mentor card/profile', () => {
    favoriteMentorStore.seedFavorites('101', []);

    renderWithSession(
      <MentorBookmarkButton mentorId={101} mentorName="陳宥廷 Austin" />,
      { userId: '101', status: 'authenticated' }
    );

    expect(
      screen.queryByRole('button', { name: /收藏/ })
    ).not.toBeInTheDocument();
  });

  it('withholds rendering while session status is still loading', () => {
    renderWithSession(
      <MentorBookmarkButton mentorId={101} mentorName="陳宥廷 Austin" />,
      { userId: null, status: 'loading' }
    );

    expect(
      screen.queryByRole('button', { name: /收藏/ })
    ).not.toBeInTheDocument();
  });

  it('ignores duplicate clicks while a favorite mutation is already in flight', async () => {
    const user = userEvent.setup();
    const trackEventSpy = vi.spyOn(analyticsModule, 'trackEvent');
    let resolvePut!: () => void;
    addMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolvePut = resolve;
        })
    );
    favoriteMentorStore.seedFavorites('999', []);

    renderWithSession(
      <MentorBookmarkButton mentorId={101} mentorName="陳宥廷 Austin" />
    );

    const button = screen.getByRole('button', { name: '收藏 陳宥廷 Austin' });
    await user.click(button);

    const busyButton = screen.getByRole('button', {
      name: '取消收藏 陳宥廷 Austin',
    });
    expect(busyButton).toHaveAttribute('aria-busy', 'true');

    await user.click(busyButton);
    expect(addMock).toHaveBeenCalledTimes(1);
    expect(removeMock).not.toHaveBeenCalled();
    expect(trackEventSpy).toHaveBeenCalledTimes(1);

    resolvePut();
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: '取消收藏 陳宥廷 Austin' })
      ).not.toHaveAttribute('aria-busy');
    });
  });

  it('suppresses failure toast when an in-flight favorite mutation rejects after logout', async () => {
    const user = userEvent.setup();
    let rejectPut!: (reason?: unknown) => void;
    addMock.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectPut = reject;
        })
    );
    favoriteMentorStore.seedFavorites('999', []);

    renderWithSession(
      <MentorBookmarkButton mentorId={101} mentorName="陳宥廷 Austin" />
    );

    const button = screen.getByRole('button', { name: '收藏 陳宥廷 Austin' });
    await user.click(button);

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
