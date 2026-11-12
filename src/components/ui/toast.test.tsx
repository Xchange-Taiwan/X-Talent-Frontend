import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { firePointer } from '@/test/pointerEvents';

import { Toast, ToastProvider, ToastTitle, ToastViewport } from './toast';

describe('Toast', () => {
  it('still dismisses on a left swipe when rendered through the full component', () => {
    const onOpenChange = vi.fn();
    render(
      <ToastProvider>
        <Toast open onOpenChange={onOpenChange} data-testid="toast-root">
          <ToastTitle>Test</ToastTitle>
        </Toast>
        <ToastViewport />
      </ToastProvider>
    );

    const toast = screen.getByTestId('toast-root');
    firePointer(toast, 'pointerdown', { clientX: 200 });
    firePointer(toast, 'pointermove', { clientX: 100 });
    firePointer(toast, 'pointerup', { clientX: 100 });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('still calls a caller-supplied onPointerDownCapture instead of the left-swipe handler silently replacing it', () => {
    const onOpenChange = vi.fn();
    const customPointerDown = vi.fn();
    render(
      <ToastProvider>
        <Toast
          open
          onOpenChange={onOpenChange}
          onPointerDownCapture={customPointerDown}
          data-testid="toast-root"
        >
          <ToastTitle>Test</ToastTitle>
        </Toast>
        <ToastViewport />
      </ToastProvider>
    );

    const toast = screen.getByTestId('toast-root');
    firePointer(toast, 'pointerdown', { clientX: 200 });

    expect(customPointerDown).toHaveBeenCalledTimes(1);

    // The left-swipe gesture must still work alongside the caller's handler.
    firePointer(toast, 'pointermove', { clientX: 100 });
    firePointer(toast, 'pointerup', { clientX: 100 });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('lets a caller opt out of the left-swipe gesture via event.preventDefault()', () => {
    const onOpenChange = vi.fn();
    render(
      <ToastProvider>
        <Toast
          open
          onOpenChange={onOpenChange}
          onPointerDownCapture={(event) => event.preventDefault()}
          data-testid="toast-root"
        >
          <ToastTitle>Test</ToastTitle>
        </Toast>
        <ToastViewport />
      </ToastProvider>
    );

    const toast = screen.getByTestId('toast-root');
    firePointer(toast, 'pointerdown', { clientX: 200 });
    firePointer(toast, 'pointermove', { clientX: 100 });
    firePointer(toast, 'pointerup', { clientX: 100 });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('positions ToastViewport as a fixed floating layer below the top bar instead of bottom-right', () => {
    render(
      <ToastProvider>
        <ToastViewport data-testid="toast-viewport" />
      </ToastProvider>
    );

    const viewport = screen.getByTestId('toast-viewport');
    expect(viewport.className).toContain('fixed');
    expect(viewport.className).toContain(
      'top-[calc(70px_+_var(--banner-height,0px))]'
    );
    expect(viewport.className).not.toContain('sm:bottom-0');
  });
});
