import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionContext, type SessionContextValue } from 'next-auth/react';
import { Profiler, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Toaster } from '@/components/ui/toaster';
import { clearToasts } from '@/components/ui/use-toast';
import { FAVORITE_MENTOR_ERROR_TOAST_MESSAGE } from '@/hooks/favorites';
import * as analyticsModule from '@/lib/analytics';
import { ApiError } from '@/lib/apiClient';
import {
  favoriteMentorsReadModel,
  type FavoriteMentorsTransport,
  getPendingFavoriteMentorId,
  resetFavoriteMentorsReadModel,
} from '@/lib/favorites';

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
  const fetchMock = vi.fn<FavoriteMentorsTransport['fetchFavoriteMentors']>();
  const addMock = vi.fn<FavoriteMentorsTransport['addFavoriteMentor']>();
  const removeMock = vi.fn<FavoriteMentorsTransport['removeFavoriteMentor']>();

  beforeEach(() => {
    window.localStorage.clear();
    clearToasts();
    resetFavoriteMentorsReadModel();
    vi.clearAllMocks();
    document.cookie = 'session-hint=; path=/; max-age=0';
    fetchMock.mockResolvedValue([]);
    addMock.mockResolvedValue(undefined);
    removeMock.mockResolvedValue(undefined);
    favoriteMentorsReadModel.setTransport({
      fetchFavoriteMentors: fetchMock,
      addFavoriteMentor: addMock,
      removeFavoriteMentor: removeMock,
    });
  });

  it('toggles icon fill/color, updates aria-label & tooltip, stops card propagation, and fires analytics without PII or duplicate declarative attributes', async () => {
    const user = userEvent.setup();
    const onParentCardClick = vi.fn();
    const trackEventSpy = vi.spyOn(analyticsModule, 'trackEvent');
    favoriteMentorsReadModel.seed('999', []);

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
    expect(button).toHaveClass('border-background-border/60');
    expect(button).toHaveClass('bg-background-white/90');
    expect(button).not.toHaveAttribute('data-analytics-event');
    expect(button).not.toHaveAttribute('data-analytics-feature');
    expect(button.textContent).toBe('');

    const svgBefore = button.querySelector('svg');
    expect(svgBefore).not.toHaveClass('fill-current');
    expect(svgBefore).toHaveClass('hover:text-text-primary');

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
    expect(removeMock).toHaveBeenCalledWith(
      '999',
      101,
      expect.any(AbortSignal)
    );
    expect(trackEventSpy).toHaveBeenLastCalledWith({
      name: 'mentor_bookmark_toggle',
      feature: 'mentor_pool',
      metadata: {
        mentor_id: 101,
        action: 'remove',
      },
    });
  });

  it('supports keyboard Tab focus and Enter / Space activation to toggle aria-pressed, aria-label, and mentor_bookmark_toggle without triggering outer container', async () => {
    const user = userEvent.setup();
    const onParentCardClick = vi.fn();
    const onParentCardKeyDown = vi.fn();
    const onParentCardKeyUp = vi.fn();
    const trackEventSpy = vi.spyOn(analyticsModule, 'trackEvent');
    favoriteMentorsReadModel.seed('999', []);

    renderWithSession(
      <div
        role="button"
        tabIndex={0}
        aria-label="導師卡片外層容器"
        onClick={onParentCardClick}
        onKeyDown={onParentCardKeyDown}
        onKeyUp={onParentCardKeyUp}
      >
        <MentorBookmarkButton mentorId={101} mentorName="陳宥廷 Austin" />
      </div>
    );

    const outerContainer = screen.getByRole('button', {
      name: '導師卡片外層容器',
    });
    const button = screen.getByRole('button', { name: '收藏 陳宥廷 Austin' });

    await user.tab();
    expect(outerContainer).toHaveFocus();

    await user.tab();
    expect(button).toHaveFocus();
    expect(screen.getByRole('tooltip')).toHaveTextContent('收藏 陳宥廷 Austin');
    expect(onParentCardClick).not.toHaveBeenCalled();
    onParentCardKeyDown.mockClear();
    onParentCardKeyUp.mockClear();

    await user.keyboard('{Enter}');

    expect(onParentCardClick).not.toHaveBeenCalled();
    expect(onParentCardKeyDown).not.toHaveBeenCalled();
    expect(onParentCardKeyUp).not.toHaveBeenCalled();
    const favoritedButton = screen.getByRole('button', {
      name: '取消收藏 陳宥廷 Austin',
    });
    expect(favoritedButton).toHaveFocus();
    expect(favoritedButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      '取消收藏 陳宥廷 Austin'
    );
    await waitFor(() => {
      expect(favoritedButton).not.toHaveAttribute('aria-busy');
    });
    expect(addMock).toHaveBeenCalledWith('999', 101, expect.any(AbortSignal));
    expect(trackEventSpy).toHaveBeenCalledTimes(1);
    expect(trackEventSpy).toHaveBeenLastCalledWith({
      name: 'mentor_bookmark_toggle',
      feature: 'mentor_pool',
      metadata: {
        mentor_id: 101,
        action: 'add',
      },
    });

    await user.keyboard(' ');

    expect(onParentCardClick).not.toHaveBeenCalled();
    expect(onParentCardKeyDown).not.toHaveBeenCalled();
    expect(onParentCardKeyUp).not.toHaveBeenCalled();
    const unfavoritedButton = screen.getByRole('button', {
      name: '收藏 陳宥廷 Austin',
    });
    expect(unfavoritedButton).toHaveFocus();
    expect(unfavoritedButton).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => {
      expect(unfavoritedButton).not.toHaveAttribute('aria-busy');
    });
    expect(removeMock).toHaveBeenCalledWith(
      '999',
      101,
      expect.any(AbortSignal)
    );
    expect(trackEventSpy).toHaveBeenCalledTimes(2);
    expect(trackEventSpy).toHaveBeenLastCalledWith({
      name: 'mentor_bookmark_toggle',
      feature: 'mentor_pool',
      metadata: {
        mentor_id: 101,
        action: 'remove',
      },
    });
  });

  it('persists pendingFavoriteMentor in localStorage and redirects unauthenticated guest to /auth/signin with encoded profile callbackUrl without firing toggle analytics (#756)', async () => {
    const user = userEvent.setup();
    const trackEventSpy = vi.spyOn(analyticsModule, 'trackEvent');

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
    expect(trackEventSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: 'mentor_bookmark_toggle' })
    );
    expect(trackEventSpy).toHaveBeenCalledWith({
      name: 'auth_gate_triggered',
      feature: 'favorites',
      metadata: {
        gate_feature: 'favorites',
        trigger_type: 'click_cta',
        mentor_id: 101,
      },
    });
  });

  it('forwards actual feature source (profile and favorites) to trackEvent', async () => {
    const user = userEvent.setup();
    const trackEventSpy = vi.spyOn(analyticsModule, 'trackEvent');
    favoriteMentorsReadModel.seed('999', [202]);

    renderWithSession(
      <>
        <MentorBookmarkButton
          mentorId={101}
          mentorName="陳宥廷 Austin"
          feature="profile"
          variant="outline"
        />
        <MentorBookmarkButton
          mentorId={202}
          mentorName="Zahra Mirzakhani"
          feature="favorites"
        />
      </>
    );

    const profileButton = screen.getByRole('button', {
      name: '收藏 陳宥廷 Austin',
    });
    expect(profileButton).toHaveClass('border-background-border');
    expect(profileButton).toHaveClass('bg-background-white');

    await user.click(profileButton);

    expect(
      screen.getByRole('button', { name: '取消收藏 陳宥廷 Austin' })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(trackEventSpy).toHaveBeenCalledWith({
      name: 'mentor_bookmark_toggle',
      feature: 'profile',
      metadata: {
        mentor_id: 101,
        action: 'add',
      },
    });

    await user.click(
      screen.getByRole('button', { name: '取消收藏 Zahra Mirzakhani' })
    );

    expect(trackEventSpy).toHaveBeenLastCalledWith({
      name: 'mentor_bookmark_toggle',
      feature: 'favorites',
      metadata: {
        mentor_id: 202,
        action: 'remove',
      },
    });
  });

  it('does not re-render an unrelated mentor bookmark button when another mentor is toggled', async () => {
    favoriteMentorsReadModel.seed('999', []);
    let renderCount = 0;

    renderWithSession(
      <Profiler
        id="bookmark-101"
        onRender={() => {
          renderCount += 1;
        }}
      >
        <MentorBookmarkButton mentorId={101} mentorName="陳宥廷 Austin" />
      </Profiler>
    );

    expect(
      screen.getByRole('button', { name: '收藏 陳宥廷 Austin' })
    ).toBeInTheDocument();
    const baselineRenders = renderCount;

    await act(async () => {
      await favoriteMentorsReadModel.toggle({
        userId: '999',
        mentorId: 202,
        feature: 'mentor_pool',
      });
    });

    expect(
      favoriteMentorsReadModel.getMentorState('999', 202).isFavorited
    ).toBe(true);
    expect(renderCount).toBe(baselineRenders);
  });

  it('rolls back icon state and shows destructive toast when API mutation fails (including 40300 user_id mismatch and 400/404 code "1" business errors)', async () => {
    const user = userEvent.setup();
    addMock.mockRejectedValueOnce(
      new ApiError(403, 'user_id not match', '40300', null)
    );
    favoriteMentorsReadModel.seed('999', []);

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

    act(() => {
      clearToasts();
    });
    addMock.mockRejectedValueOnce(
      new ApiError(404, 'mentor_not_found', '1', {
        type: 'mentor_not_found',
        message: 'Mentor not found',
      })
    );

    await user.click(
      screen.getByRole('button', { name: '收藏 陳宥廷 Austin' })
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: '收藏 陳宥廷 Austin' })
      ).toHaveAttribute('aria-pressed', 'false');
    });

    expect(
      await screen.findByText(FAVORITE_MENTOR_ERROR_TOAST_MESSAGE)
    ).toBeVisible();
  });

  it('renders nothing when logged-in mentor views their own mentor card/profile', () => {
    favoriteMentorsReadModel.seed('101', []);

    renderWithSession(
      <MentorBookmarkButton mentorId={101} mentorName="陳宥廷 Austin" />,
      { userId: '101', status: 'authenticated' }
    );

    expect(
      screen.queryByRole('button', { name: /收藏/ })
    ).not.toBeInTheDocument();
  });

  it('renders guest-hint-gated button during unknown SSR/loading state (zero guest pop-in) while withholding rendering for member session-hint (#908)', async () => {
    const { unmount } = renderWithSession(
      <MentorBookmarkButton mentorId={101} mentorName="陳宥廷 Austin" />,
      { userId: null, status: 'loading' }
    );

    const guestGatedBtn = screen.getByRole('button', {
      name: '收藏 陳宥廷 Austin',
    });
    expect(guestGatedBtn).toHaveClass(
      'hidden',
      'group-data-[auth-state=guest]/auth-state:inline-flex'
    );
    unmount();

    document.cookie = 'session-hint=1|101';
    renderWithSession(
      <MentorBookmarkButton mentorId={101} mentorName="陳宥廷 Austin" />,
      { userId: null, status: 'loading' }
    );

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /收藏/ })
      ).not.toBeInTheDocument();
    });
  });

  it('ignores duplicate clicks while a favorite mutation is already in flight and emits analytics only after settlement (#908)', async () => {
    const user = userEvent.setup();
    const trackEventSpy = vi.spyOn(analyticsModule, 'trackEvent');
    let resolvePut!: () => void;
    addMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolvePut = resolve;
        })
    );
    favoriteMentorsReadModel.seed('999', []);

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
    expect(trackEventSpy).not.toHaveBeenCalled();

    resolvePut();
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: '取消收藏 陳宥廷 Austin' })
      ).not.toHaveAttribute('aria-busy');
    });
    expect(trackEventSpy).toHaveBeenCalledTimes(1);
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
    favoriteMentorsReadModel.seed('999', []);

    renderWithSession(
      <MentorBookmarkButton mentorId={101} mentorName="陳宥廷 Austin" />
    );

    const button = screen.getByRole('button', { name: '收藏 陳宥廷 Austin' });
    await user.click(button);

    favoriteMentorsReadModel.clear();
    rejectPut(new Error('Aborted on logout'));

    await waitFor(() => {
      expect(
        favoriteMentorsReadModel.getMentorState('999', 101).isPending
      ).toBe(false);
    });

    expect(
      screen.queryByText(FAVORITE_MENTOR_ERROR_TOAST_MESSAGE)
    ).not.toBeInTheDocument();
  });
});
