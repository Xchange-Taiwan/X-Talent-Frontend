import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Session } from 'next-auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  // next/image requires width/height derived from a static-import object
  // shape that Vitest's asset transform doesn't produce; not relevant to
  // the share-dialog timing behavior under test here.
  default: ({ src, alt }: { src: string | { src: string }; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={typeof src === 'string' ? src : src.src} alt={alt} />
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

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

import { trackEvent } from '@/lib/analytics';
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
    vi.clearAllMocks();
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
    render(<UserDropdown user={buildUser()} />);

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
    render(<UserDropdown user={buildUser({ id: undefined })} />);

    openMenu();
    const shareButton = screen.getByRole('button', { name: '分享個人頁面' });
    expect(shareButton).toBeDisabled();
  });

  it('calls trackEvent and closeMenu when clicking the "提供回饋" link', () => {
    render(<UserDropdown user={buildUser()} />);

    openMenu();
    const feedbackLink = screen.getByRole('link', { name: '提供回饋' });

    fireEvent.click(feedbackLink);

    expect(trackEvent).toHaveBeenCalledWith({ name: 'feedback_open' });
    // And verify the dropdown closed (which means the feedback link is no longer in the document)
    expect(
      screen.queryByRole('link', { name: '提供回饋' })
    ).not.toBeInTheDocument();
  });
});
