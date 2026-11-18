import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CHUNK_RELOAD_STORAGE_KEY } from '@/lib/chunkErrorRecovery';
import { captureError } from '@/lib/monitoring';

import ErrorBoundary from './ErrorBoundary';

vi.mock('@/lib/monitoring', () => ({
  buildBaseEvent: vi.fn((name: string, error: unknown) => ({
    name,
    timestamp: '2026-11-17T00:00:00.000Z',
    environment: 'test',
    route: '/mentor-pool',
    message: error instanceof Error ? error.message : String(error),
  })),
  captureError: vi.fn(),
}));

function BrokenChild(): React.ReactElement {
  throw new Error('Render crash in child');
}

describe('ErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders children normally when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>healthy-content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('healthy-content')).toBeInTheDocument();
  });

  it('renders Traditional Chinese recovery UI by default instead of a blank screen when fallback is omitted', () => {
    render(
      <ErrorBoundary componentName="RootAppShell">
        <BrokenChild />
      </ErrorBoundary>
    );

    expect(captureError).toHaveBeenCalledTimes(1);
    expect(screen.getByText('畫面載入發生異常')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '重新整理頁面' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回首頁' })).toHaveAttribute(
      'href',
      '/'
    );
  });

  it('respects explicit null fallback for silent widget-level boundaries', () => {
    const { container } = render(
      <ErrorBoundary fallback={null}>
        <BrokenChild />
      </ErrorBoundary>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('auto-reloads once on ChunkLoadError without reporting to Sentry, then falls back to Sentry + UI within cooldown (#952)', () => {
    window.sessionStorage.clear();
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/mentor-pool',
        reload: reloadSpy,
      },
    });

    function ChunkBrokenChild(): React.ReactElement {
      throw new Error('Loading CSS chunk 6066 failed.');
    }

    try {
      const { unmount } = render(
        <ErrorBoundary>
          <ChunkBrokenChild />
        </ErrorBoundary>
      );

      expect(reloadSpy).toHaveBeenCalledTimes(1);
      expect(captureError).not.toHaveBeenCalled();
      expect(window.sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY)).toContain(
        '/mentor-pool'
      );
      unmount();

      render(
        <ErrorBoundary>
          <ChunkBrokenChild />
        </ErrorBoundary>
      );

      expect(reloadSpy).toHaveBeenCalledTimes(1);
      expect(captureError).toHaveBeenCalledTimes(1);
      expect(screen.getByText('畫面載入發生異常')).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
    }
  });
});
