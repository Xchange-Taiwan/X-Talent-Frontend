import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string | { src: string }; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={typeof src === 'string' ? src : src.src} alt={alt} />
  ),
}));

const mockTrackEvent = vi.fn();
vi.mock('@/lib/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/analytics')>();
  return {
    ...actual,
    trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  };
});

import { ShareProfileDialog } from './ShareProfileDialog';

describe('ShareProfileDialog', () => {
  beforeEach(() => {
    mockTrackEvent.mockClear();
    document.documentElement.style.removeProperty('overflow');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.documentElement.style.removeProperty('overflow');
  });

  it('renders on shared Dialog + DialogContentFrame without mutating document.documentElement.style.overflow', () => {
    document.documentElement.style.overflow = 'clip';
    const onOpenChange = vi.fn();

    const { rerender } = render(
      <ShareProfileDialog
        open
        onOpenChange={onOpenChange}
        name="陳導師"
        subtitle="Staff Engineer at XChange"
        profilePath="/profile/mentor-123"
        personalLinks={[
          { platform: 'linkedin', url: 'https://linkedin.com/in/mentor' },
          { platform: 'website', url: 'javascript:alert(1)' },
        ]}
      />
    );

    const dialog = screen.getByRole('dialog', { name: '分享個人頁面' });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveClass('max-h-[90dvh]', 'overflow-y-auto');
    expect(document.documentElement.style.overflow).toBe('clip');
    expect(mockTrackEvent).toHaveBeenCalledWith({
      name: 'feature_opened',
      feature: 'profile',
      metadata: { dialog: 'share_profile' },
    });

    expect(
      screen.getByRole('link', { name: '前往 LinkedIn 頁面' })
    ).toHaveAttribute('href', 'https://linkedin.com/in/mentor');
    expect(
      screen.queryByRole('link', { name: /Website/i })
    ).not.toBeInTheDocument();

    rerender(
      <ShareProfileDialog
        open={false}
        onOpenChange={onOpenChange}
        name="陳導師"
        profilePath="/profile/mentor-123"
      />
    );
    expect(document.documentElement.style.overflow).toBe('clip');
  });

  it('copies the absolute profile URL and resets the button label after 1500ms', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    render(
      <ShareProfileDialog
        open
        onOpenChange={vi.fn()}
        name="陳導師"
        profilePath="/profile/mentor-123"
      />
    );

    const copyButton = screen.getByRole('button', { name: '複製' });
    await act(async () => {
      fireEvent.click(copyButton);
    });

    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/profile/mentor-123`
    );
    expect(screen.getByRole('button', { name: '已複製' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByRole('button', { name: '複製' })).toBeInTheDocument();
  });
});
