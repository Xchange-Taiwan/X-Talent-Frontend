import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { CSSProperties } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    className,
    style,
  }: {
    src: string | { src: string };
    alt: string;
    className?: string;
    style?: CSSProperties;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={typeof src === 'string' ? src : src.src}
      alt={alt}
      className={className}
      style={style}
    />
  ),
}));

vi.mock('next-auth/react', async () => {
  const { nextAuthMockFactory } = await import('@/test/mocks/nextAuth');
  return nextAuthMockFactory();
});

const mockUsePathname = vi.fn<() => string>(() => '/');
vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return {
    ...navigationMockFactory(),
    usePathname: () => mockUsePathname(),
  };
});

const trackEvent = vi.fn();
vi.mock('@/lib/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/analytics')>();
  return {
    ...actual,
    trackEvent: (...args: unknown[]) => trackEvent(...args),
  };
});

const mockUseResolvedIdentity = vi.fn();
vi.mock('@/hooks/user/auth/useResolvedIdentity', () => ({
  useResolvedIdentity: () => mockUseResolvedIdentity(),
}));

import {
  clearSessionHint,
  type ResolvedIdentity,
} from '@/lib/auth/sessionHint';
import { createInMemoryNotificationSource } from '@/services/notifications/notificationSource';
import {
  notificationStoreManager,
  resetNotificationStore,
} from '@/stores/notificationStore';
import {
  authenticatedIdentity,
  buildResolvedIdentity,
  GUEST_IDENTITY,
  UNKNOWN_IDENTITY,
} from '@/test/mocks/identity';
import { mockSession, mockUseSession } from '@/test/mocks/nextAuth';

import { Header } from './Header';
import * as HeaderStories from './Header.stories';

const AUTHENTICATED_MATCHING_IDENTITY = authenticatedIdentity('user-123');

class NoopIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = '';
  readonly thresholds: ReadonlyArray<number> = [];
  disconnect() {}
  observe() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  unobserve() {}
}

describe('Header', () => {
  const originalDeleteEnv = process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetNotificationStore();
    mockUsePathname.mockReturnValue('/');
    const headerNotificationSource = createInMemoryNotificationSource([
      {
        id: 'header-notif-1',
        type: 'reservation_requested',
        menteeName: '小明',
        createdAt: new Date().toISOString(),
        unread: true,
      },
    ]);
    notificationStoreManager.setSource('user-123', headerNotificationSource);
    notificationStoreManager.setSource('mentor-999', headerNotificationSource);
    mockUseResolvedIdentity.mockReturnValue(UNKNOWN_IDENTITY);
    global.IntersectionObserver = NoopIntersectionObserver;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      }
    );
  });

  afterEach(() => {
    clearSessionHint();
    process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT = originalDeleteEnv;
    vi.unstubAllGlobals();
  });

  it('disables userId-dependent links across desktop nav, UserDropdown, and MobileUserMenu during hint-only', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });
    mockUseResolvedIdentity.mockReturnValue(
      buildResolvedIdentity({
        state: 'hint-only',
      })
    );

    render(<Header />);

    const desktopBecomeMentor = screen.getByRole('link', { name: '成為導師' });
    expect(desktopBecomeMentor).toHaveAttribute('href', '#');
    expect(desktopBecomeMentor).toHaveAttribute('aria-disabled', 'true');
    expect(fireEvent.click(desktopBecomeMentor)).toBe(false);

    // Desktop UserDropdown profile header + share button + role item disabled
    const desktopRight = screen.getByTestId('desktop-header-right');
    fireEvent.keyDown(
      within(desktopRight).getByRole('button', { name: '開啟用戶選單' }),
      { key: 'Enter' }
    );

    const desktopProfileHeader = screen.getByTestId('profile-header-button');
    expect(desktopProfileHeader).toHaveAttribute('href', '#');
    expect(desktopProfileHeader).toHaveAttribute('aria-disabled', 'true');
    expect(fireEvent.click(desktopProfileHeader)).toBe(false);

    const desktopShareItem = screen.getByRole('menuitem', {
      name: '分享個人頁面',
    });
    expect(desktopShareItem).toBeDisabled();
    fireEvent.keyDown(desktopProfileHeader, { key: 'Escape' });

    // Mobile MobileUserMenu profile header + share button disabled
    const mobileRight = screen.getByTestId('mobile-header-right');
    fireEvent.click(
      within(mobileRight).getByRole('button', { name: '開啟用戶選單' })
    );
    const mobileSheet = screen.getByRole('dialog', { name: '用戶選單' });
    const mobileProfileHeader = within(mobileSheet).getByTestId(
      'profile-header-button'
    );
    expect(mobileProfileHeader).toHaveAttribute('href', '#');
    expect(mobileProfileHeader).toHaveAttribute('aria-disabled', 'true');
    expect(
      within(mobileSheet).getByRole('button', { name: '分享個人頁面' })
    ).toBeDisabled();
  });

  it('links straight to the profile edit page once userId has landed and marks aria-current on active routes', () => {
    mockUsePathname.mockReturnValue('/about');
    mockUseSession.mockReturnValue({
      data: { ...mockSession, user: { ...mockSession.user, id: 'user-123' } },
      status: 'authenticated',
    });
    mockUseResolvedIdentity.mockReturnValue(AUTHENTICATED_MATCHING_IDENTITY);

    render(<Header />);

    const becomeMentor = screen.getByRole('link', { name: '成為導師' });
    expect(becomeMentor).toHaveAttribute(
      'href',
      '/profile/user-123/edit?mentor-onboarding=true'
    );
    expect(becomeMentor).toHaveAttribute('aria-disabled', 'false');

    const aboutLink = screen.getByRole('link', { name: '關於 X-Talent' });
    expect(aboutLink).toHaveAttribute('aria-current', 'page');
    expect(aboutLink.className).toContain('aria-[current=page]:text-brand-700');
    expect(aboutLink.className).toContain(
      'aria-[current=page]:after:scale-x-100'
    );
    expect(screen.getByRole('link', { name: '尋找導師' })).not.toHaveAttribute(
      'aria-current'
    );
  });

  it('shows guest sign-in/sign-up actions once auth is known and the user is not logged in', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    mockUseResolvedIdentity.mockReturnValue(GUEST_IDENTITY);

    render(<Header />);

    expect(screen.getByRole('link', { name: '註冊' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '登入' })).toBeInTheDocument();
  });

  it('pre-renders guest sign-in/sign-up actions with AuthHintGate CSS visibility toggles before auth is known', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });

    render(<Header />);

    const signupLink = screen.getByRole('link', { name: '註冊' });
    const signinLink = screen.getByRole('link', { name: '登入' });
    expect(signupLink.parentElement).toHaveClass(
      'hidden',
      'group-data-[auth-state=guest]/auth-state:flex'
    );
    expect(signinLink.parentElement).toHaveClass(
      'hidden',
      'group-data-[auth-state=guest]/auth-state:flex'
    );
  });

  it('renders split mentor, mentee, and guest role links with AuthHintGate toggles before auth is known, disabling mentor/mentee while keeping guest fast-path enabled', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });

    render(<Header />);

    const mentorLink = screen.getByRole('link', { name: '我的導師頁面' });
    expect(mentorLink).toHaveClass(
      'hidden',
      'group-data-[auth-state=mentor]/auth-state:block',
      'pointer-events-none',
      'opacity-50'
    );
    expect(mentorLink).toHaveAttribute('aria-disabled', 'true');
    expect(mentorLink).toHaveAttribute('href', '#');
    expect(mentorLink).not.toHaveClass('after:bg-brand-500');
    expect(mentorLink).not.toHaveClass('hover:after:scale-x-100');

    const becomeMentorLinks = screen.getAllByRole('link', { name: '成為導師' });
    expect(becomeMentorLinks).toHaveLength(2);

    const menteeLink = becomeMentorLinks.find((el) =>
      el.classList.contains('group-data-[auth-state=mentee]/auth-state:block')
    );
    const guestLink = becomeMentorLinks.find((el) =>
      el.classList.contains('group-data-[auth-state=guest]/auth-state:block')
    );

    expect(menteeLink).toBeDefined();
    expect(menteeLink).toHaveClass(
      'hidden',
      'group-data-[auth-state=mentee]/auth-state:block',
      'pointer-events-none',
      'opacity-50'
    );
    expect(menteeLink).toHaveAttribute('aria-disabled', 'true');
    expect(menteeLink).toHaveAttribute('href', '#');
    expect(menteeLink).not.toHaveClass('after:bg-brand-500');
    expect(menteeLink).not.toHaveClass('hover:after:scale-x-100');

    expect(guestLink).toBeDefined();
    expect(guestLink).toHaveClass(
      'hidden',
      'group-data-[auth-state=guest]/auth-state:block',
      'after:bg-brand-500',
      'hover:after:scale-x-100'
    );
    expect(guestLink).toHaveAttribute('aria-disabled', 'false');
    expect(guestLink).toHaveAttribute('href', '/auth/signup');
  });

  it('renders UserDropdown and MobileUserMenu with hint avatar when logged in per hint before session resolves', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'loading',
    });
    mockUseResolvedIdentity.mockReturnValue(
      buildResolvedIdentity({
        state: 'hint-only',
        isMentor: true,
        avatar: 'hint-avatar.png',
      })
    );

    render(<Header />);

    const avatarImgs = screen.getAllByAltText('我的頭像');
    expect(avatarImgs).toHaveLength(2);
    expect(avatarImgs[0]).toHaveAttribute('src', 'hint-avatar.png');
    expect(avatarImgs[1]).toHaveAttribute('src', 'hint-avatar.png');
  });

  it('mounts ShareProfileDialog and DeleteAccountDialog once at the Header level and defers opening by a frame', () => {
    process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT = 'true';
    const queuedFrames: FrameRequestCallback[] = [];
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        queuedFrames.push(cb);
        return queuedFrames.length;
      }
    );

    mockUseSession.mockReturnValue({
      data: null,
      status: 'loading',
    });
    mockUseResolvedIdentity.mockReturnValue(
      buildResolvedIdentity({
        state: 'hint-only',
        isMentor: false,
      })
    );

    const { rerender } = render(<Header />);

    mockUseSession.mockReturnValue({
      data: {
        ...mockSession,
        user: {
          ...mockSession.user,
          id: 'user-123',
          email: 'xiaoming@xchange.tw',
        },
      },
      status: 'authenticated',
    });
    mockUseResolvedIdentity.mockReturnValue(
      authenticatedIdentity('user-123', {
        name: '王小明',
        isMentor: false,
      })
    );
    rerender(<Header />);

    const desktopRight = screen.getByTestId('desktop-header-right');
    fireEvent.keyDown(
      within(desktopRight).getByRole('button', { name: '開啟用戶選單' }),
      { key: 'Enter' }
    );

    fireEvent.click(screen.getByRole('menuitem', { name: '分享個人頁面' }));

    // Dropdown closes synchronously before RAF opens the single dialog
    expect(
      screen.queryByRole('menuitem', { name: '分享個人頁面' })
    ).not.toBeInTheDocument();
    expect(screen.queryAllByRole('dialog')).toHaveLength(0);
    expect(queuedFrames).toHaveLength(1);

    act(() => {
      queuedFrames.splice(0).forEach((cb) => cb(0));
    });

    const openDialogs = screen.getAllByRole('dialog');
    expect(openDialogs).toHaveLength(1);
    expect(openDialogs[0]).toHaveAccessibleName('分享個人頁面');

    // Close ShareProfileDialog and open DeleteAccountDialog from mobile menu
    fireEvent.click(
      screen.getByRole('button', { name: 'Close share profile dialog' })
    );
    expect(screen.queryAllByRole('dialog')).toHaveLength(0);

    const mobileRight = screen.getByTestId('mobile-header-right');
    fireEvent.click(
      within(mobileRight).getByRole('button', { name: '開啟用戶選單' })
    );
    fireEvent.click(screen.getByRole('button', { name: '刪除帳號' }));

    act(() => {
      queuedFrames.splice(0).forEach((cb) => cb(0));
    });

    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByLabelText('電子郵件')).toHaveValue(
      'xiaoming@xchange.tw'
    );
  });

  it('gives the logo and every top-level nav link a visible keyboard focus ring and tracks feedback_open', () => {
    trackEvent.mockClear();
    mockUseSession.mockReturnValue({
      data: { ...mockSession, user: { ...mockSession.user, id: 'user-123' } },
      status: 'authenticated',
    });
    mockUseResolvedIdentity.mockReturnValue(AUTHENTICATED_MATCHING_IDENTITY);
    render(<Header />);

    const logoImg = screen.getByAltText('X-Talent Logo');
    expect(logoImg).toHaveClass('w-auto');
    expect(logoImg).not.toHaveAttribute('style');

    const logoLink = screen.getByRole('link', { name: 'Go to homepage' });
    const findMentorLink = screen.getByRole('link', { name: '尋找導師' });
    const aboutLink = screen.getByRole('link', { name: '關於 X-Talent' });
    const feedbackLink = screen.getByRole('link', {
      name: '提供回饋（另開新分頁）',
    });

    for (const link of [logoLink, findMentorLink, aboutLink, feedbackLink]) {
      expect(link).toHaveClass('focus-visible:ring-2');
      expect(link).toHaveClass('focus-visible:ring-ring');
      expect(link).toHaveClass('focus-visible:outline-none');
    }

    fireEvent.click(feedbackLink);
    expect(trackEvent).toHaveBeenCalledWith({ name: 'feedback_open' });
  });

  it('gates mobile and desktop pre-hydration Skeleton on unhinted and --auth-avatar on mentee/mentor so placeholders never render side-by-side', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });

    const { rerender } = render(<Header />);

    const desktopContainer = screen.getByTestId('desktop-header-right');
    const mobileContainer = screen.getByTestId('mobile-header-right');

    for (const container of [desktopContainer, mobileContainer]) {
      const avatarPlaceholder = container.querySelector(
        '.size-8.rounded-full[class~="bg-[image:var(--auth-avatar)]"]'
      );
      expect(avatarPlaceholder).toBeInTheDocument();
      expect(avatarPlaceholder).toHaveClass(
        'hidden',
        'group-data-[auth-state=mentee]/auth-state:block',
        'group-data-[auth-state=mentor]/auth-state:block'
      );
    }

    const desktopSkeletonWrapper = desktopContainer
      .querySelector('.size-9.rounded-full')
      ?.closest('[class*="group-data-[auth-state="]');
    expect(desktopSkeletonWrapper).toHaveClass(
      'group-data-[auth-state=guest]/auth-state:hidden',
      'group-data-[auth-state=mentee]/auth-state:hidden',
      'group-data-[auth-state=mentor]/auth-state:hidden'
    );

    const mobileSkeleton = mobileContainer.querySelector(
      '.size-9.rounded-full'
    );
    expect(mobileSkeleton).toBeInTheDocument();
    const mobileSkeletonGate = mobileSkeleton?.closest(
      '[class*="group-data-[auth-state="]'
    );
    expect(mobileSkeletonGate).toHaveClass(
      'group-data-[auth-state=guest]/auth-state:hidden',
      'group-data-[auth-state=mentee]/auth-state:hidden',
      'group-data-[auth-state=mentor]/auth-state:hidden'
    );
    expect(mobileSkeleton).not.toHaveClass(
      'group-data-[auth-state=mentee]/auth-state:block'
    );
    expect(mobileSkeleton).not.toHaveClass(
      'group-data-[auth-state=mentor]/auth-state:block'
    );

    // Once identity leaves 'unknown', both pre-hydration placeholders unmount
    mockUseResolvedIdentity.mockReturnValue(
      buildResolvedIdentity({ state: 'hint-only', isMentor: false })
    );
    rerender(<Header />);
    expect(
      mobileContainer.querySelector('.size-9.rounded-full')
    ).not.toBeInTheDocument();
    expect(
      mobileContainer.querySelector(
        '.size-8.rounded-full[class~="bg-[image:var(--auth-avatar)]"]'
      )
    ).not.toBeInTheDocument();
  });

  it('keeps identity.state === "unknown" in MobilePreHydrationHintState story and displays --auth-avatar without showing the mobile Skeleton alongside it', async () => {
    const actualIdentityModule = await vi.importActual<
      typeof import('@/hooks/user/auth/useResolvedIdentity')
    >('@/hooks/user/auth/useResolvedIdentity');

    const story = HeaderStories.MobilePreHydrationHintState;
    expect(story.parameters?.viewport).toEqual({ defaultViewport: 'mobile1' });
    expect(story.parameters?.auth).toEqual({
      status: 'loading',
      session: null,
      sessionHint: undefined,
    });

    // Simulate withAppContext cookie & session sync when story.parameters.auth.sessionHint is undefined
    document.cookie = 'session-hint=1|stale-mentor; path=/; max-age=3600';
    const authParams = story.parameters?.auth;
    if (authParams?.sessionHint !== undefined) {
      document.cookie = `session-hint=${authParams.sessionHint}; path=/; max-age=3600`;
    } else {
      document.cookie = 'session-hint=; path=/; max-age=0';
    }
    mockUseSession.mockReturnValue({
      data: authParams?.session ?? null,
      status: authParams?.status ?? 'unauthenticated',
    });

    let latestIdentity: ResolvedIdentity | undefined;
    mockUseResolvedIdentity.mockImplementation(() => {
      latestIdentity = actualIdentityModule.useResolvedIdentity();
      return latestIdentity;
    });

    const decorators = Array.isArray(story.decorators)
      ? story.decorators
      : story.decorators
        ? [story.decorators]
        : [];
    const storyDecorator = decorators[0];
    expect(storyDecorator).toBeDefined();

    const { container } = render(
      storyDecorator!(() => <Header />, {} as never)
    );

    expect(latestIdentity?.state).toBe('unknown');

    const storyFrame = container.querySelector('.group\\/auth-state');
    expect(storyFrame).toBeInTheDocument();
    expect(storyFrame).toHaveAttribute('data-auth-state', 'mentee');
    expect(storyFrame).toHaveClass(
      'min-h-[70px]',
      'max-w-[390px]',
      '[transform:translateZ(0)]'
    );
    expect(
      (storyFrame as HTMLElement).style.getPropertyValue('--auth-avatar')
    ).toContain('url("https://');

    const mobileContainer = screen.getByTestId('mobile-header-right');
    const avatarPlaceholder = mobileContainer.querySelector(
      '.size-8.rounded-full[class~="bg-[image:var(--auth-avatar)]"]'
    );
    expect(avatarPlaceholder).toBeInTheDocument();
    expect(avatarPlaceholder).toHaveClass(
      'hidden',
      'group-data-[auth-state=mentee]/auth-state:block'
    );

    // Inject minimal Tailwind group-data CSS rules into jsdom to verify real computed visibility:
    // under data-auth-state="mentee", --auth-avatar displays (block) while Skeleton's gate is hidden (none)
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .hidden { display: none; }
      .group\\/auth-state[data-auth-state="mentee"] .group-data-\\[auth-state\\=mentee\\]\\/auth-state\\:block { display: block; }
      .group\\/auth-state[data-auth-state="mentee"] .group-data-\\[auth-state\\=mentee\\]\\/auth-state\\:hidden { display: none; }
    `;
    document.head.appendChild(styleEl);

    try {
      expect(window.getComputedStyle(avatarPlaceholder!).display).toBe('block');

      const mobileSkeleton = mobileContainer.querySelector(
        '.size-9.rounded-full'
      );
      const mobileSkeletonGate = mobileSkeleton?.parentElement;
      expect(mobileSkeletonGate).toHaveClass(
        'group-data-[auth-state=mentee]/auth-state:hidden'
      );
      expect(window.getComputedStyle(mobileSkeletonGate!).display).toBe('none');

      expect(
        within(mobileContainer).queryByRole('button', { name: '開啟通知選單' })
      ).not.toBeInTheDocument();
      expect(
        within(mobileContainer).queryByRole('button', { name: '開啟用戶選單' })
      ).not.toBeInTheDocument();
    } finally {
      styleEl.remove();
    }
  });

  it('renders NotificationBell on both desktop and mobile when logged in, bootstraps once, and closes on user menu click', async () => {
    const sharedSource = notificationStoreManager.getSource('user-123')!;
    const countSpy = vi.spyOn(sharedSource, 'getUnreadCount');

    mockUseSession.mockReturnValue({
      data: {
        ...mockSession,
        user: { ...mockSession.user, id: 'user-123', image: 'avatar.png' },
      },
      status: 'authenticated',
    });
    mockUseResolvedIdentity.mockReturnValue(AUTHENTICATED_MATCHING_IDENTITY);
    render(<Header />);

    const desktopContainer = screen.getByTestId('desktop-header-right');
    const mobileContainer = screen.getByTestId('mobile-header-right');

    const desktopBell = within(desktopContainer).getByRole('button', {
      name: '開啟通知選單',
    });
    const mobileBell = within(mobileContainer).getByRole('button', {
      name: '開啟通知選單',
    });

    await waitFor(() => {
      expect(within(desktopBell).getByText('1')).toBeInTheDocument();
      expect(within(mobileBell).getByText('1')).toBeInTheDocument();
    });
    expect(countSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(desktopBell);
    expect((await screen.findAllByText('您有新的預約'))[0]).toBeInTheDocument();

    const desktopAvatar = within(desktopContainer).getByRole('button', {
      name: '開啟用戶選單',
    });
    fireEvent.pointerDown(desktopAvatar, { bubbles: true });
    fireEvent.mouseDown(desktopAvatar, { bubbles: true });
    fireEvent.click(desktopAvatar);

    await waitFor(() => {
      expect(screen.queryAllByText('您有新的預約')).toHaveLength(0);
    });
  });

  describe('navigation links hover style & GA4 attributes', () => {
    it('applies HOVER_NAV_UNDERLINE_CLASSES, typography tokens, and full-width row layout when enabled and excludes hover underline when disabled (hint-only)', () => {
      mockUseSession.mockReturnValue({ data: null, status: 'loading' });
      mockUseResolvedIdentity.mockReturnValue(
        buildResolvedIdentity({ state: 'hint-only' })
      );

      const { container, unmount } = render(<Header />);
      const headerRow = container.querySelector('header > div');
      expect(headerRow).toHaveClass(
        'flex',
        'h-[70px]',
        'items-center',
        'justify-between'
      );
      expect(headerRow).not.toHaveClass('mx-auto');
      expect(headerRow).not.toHaveClass('max-w-7xl');

      const disabledLink = screen.getByRole('link', { name: '成為導師' });
      expect(disabledLink).toHaveClass('text-text-primary', 'font-open-sans');
      expect(disabledLink).not.toHaveClass('after:bg-brand-500');
      expect(disabledLink).not.toHaveClass('hover:after:scale-x-100');

      unmount();
      mockUseSession.mockReturnValue({
        data: {
          ...mockSession,
          user: { ...mockSession.user, id: 'mentor-999' },
        },
        status: 'authenticated',
      });
      mockUseResolvedIdentity.mockReturnValue(
        authenticatedIdentity('mentor-999', { isMentor: true })
      );
      render(<Header />);

      const myMentorPageLink = screen.getByRole('link', {
        name: '我的導師頁面',
      });
      expect(myMentorPageLink).toHaveClass(
        'text-text-primary',
        'font-open-sans',
        'after:-bottom-1',
        'after:origin-left',
        'after:bg-brand-500',
        'hover:after:scale-x-100'
      );
      expect(myMentorPageLink).toHaveAttribute(
        'data-analytics-click',
        'header_nav_my_mentor_page'
      );
      expect(myMentorPageLink).toHaveAttribute(
        'data-analytics-location',
        'header'
      );
      expect(myMentorPageLink).toHaveAttribute(
        'data-analytics-feature',
        'navigation'
      );
    });
  });
});
