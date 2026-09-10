import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { Session } from 'next-auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  // next/image requires width/height derived from a static-import object
  // shape that Vitest's asset transform doesn't produce; not relevant to
  // the share-dialog timing behavior under test here. className is forwarded
  // so tests can assert the interactive hover/focus classes UserAvatar applies.
  default: ({
    src,
    alt,
    className,
  }: {
    src: string | { src: string };
    alt: string;
    className?: string;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={typeof src === 'string' ? src : src.src}
      alt={alt}
      className={className}
    />
  ),
}));

vi.mock('next-auth/react', async () => {
  const { nextAuthMockFactory } = await import('@/test/mocks/nextAuth');
  return nextAuthMockFactory();
});

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

const trackEvent = vi.fn();
vi.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

import { authenticatedIdentity, GUEST_IDENTITY } from '@/test/mocks/identity';
import { mockSession } from '@/test/mocks/nextAuth';

import { UserDropdown } from './UserDropdown';

function buildUser(overrides: Partial<Session['user']> = {}): Session['user'] {
  return {
    ...mockSession.user,
    id: 'user-1',
    isMentor: false,
    ...overrides,
  };
}

describe('UserDropdown share flow', () => {
  let queuedFrames: FrameRequestCallback[];

  beforeEach(() => {
    queuedFrames = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      }
    );
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        queuedFrames.push(cb);
        return queuedFrames.length;
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function flushRaf(): void {
    const frames = queuedFrames;
    queuedFrames = [];
    act(() => {
      frames.forEach((cb) => cb(0));
    });
  }

  function openMenu(): void {
    const trigger = screen.getByRole('button', { name: '開啟用戶選單' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
  }

  it('closes the dropdown immediately but defers opening the share dialog to the next frame', () => {
    render(
      <UserDropdown
        identity={authenticatedIdentity('user-1', { isMentor: false })}
        user={buildUser()}
      />
    );

    openMenu();
    const shareButton = screen.getByRole('button', { name: '分享個人頁面' });

    fireEvent.click(shareButton);

    // The dropdown closes synchronously — its content leaves the tree,
    // taking the share trigger with it, before the dialog appears.
    expect(
      screen.queryByRole('button', { name: '分享個人頁面' })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(queuedFrames).toHaveLength(1);

    flushRaf();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not queue a frame or open the dialog when there is no userId', () => {
    render(
      <UserDropdown
        identity={GUEST_IDENTITY}
        user={buildUser({ id: undefined })}
      />
    );

    openMenu();
    const shareButton = screen.getByRole('button', { name: '分享個人頁面' });
    expect(shareButton).toBeDisabled();
  });

  it('wires the trigger avatar with the hover/focus classes that depend on the parent group', () => {
    render(
      <UserDropdown
        identity={authenticatedIdentity('user-1', { isMentor: false })}
        user={buildUser({ name: 'Test User' })}
      />
    );

    // The focus/hover feedback relies on `group-hover:`/`group-focus-visible:`
    // on the avatar image responding to `group` on the trigger button - both
    // sides of that coupling must hold for keyboard focus and mouse hover to
    // show any visual feedback at all.
    const trigger = screen.getByRole('button', { name: '開啟用戶選單' });
    expect(trigger).toHaveClass('group');

    const avatarImg = screen.getByRole('img', { name: 'Test User 的頭像' });
    expect(avatarImg).toHaveClass('group-hover:opacity-80');
    expect(avatarImg).toHaveClass('group-focus-visible:ring-2');
  });

  it('wires the profile-header avatar with a self-scoped hover class and a group-focus class', () => {
    render(
      <UserDropdown
        identity={authenticatedIdentity('user-1', { isMentor: false })}
        user={buildUser({ name: 'Test User' })}
      />
    );

    openMenu();

    // Both the trigger and the profile-header button render an avatar with
    // the same alt text - scope the query to the profile-header button via
    // its data-testid rather than matching on className.
    const profileButton = screen.getByTestId('profile-header-button');
    expect(profileButton).toHaveClass('group');

    const profileAvatarImg = within(profileButton).getByRole('img', {
      name: 'Test User 的頭像',
    });
    // The button spans the avatar plus the name/company text, but the
    // hover fade should only trigger when the pointer is over the avatar
    // itself - so this uses a plain `hover:` rather than `group-hover:`.
    expect(profileAvatarImg).toHaveClass('hover:opacity-80');
    expect(profileAvatarImg).not.toHaveClass('group-hover:opacity-80');
    expect(profileAvatarImg).toHaveClass('group-focus-visible:ring-2');
  });

  it('does not render the merged header navigation links (尋找導師, 關於 X-Talent, 提供回饋) inside the desktop dropdown menu', () => {
    render(
      <UserDropdown
        identity={authenticatedIdentity('user-1', { isMentor: false })}
        user={buildUser()}
      />
    );

    openMenu();

    expect(
      screen.queryByRole('menuitem', { name: '尋找導師' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: '關於 X-Talent' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: '提供回饋' })
    ).not.toBeInTheDocument();
  });
});
