import { renderHook } from '@testing-library/react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useProfileLinkClick } from './useProfileLinkClick';

function makeMouseEvent(
  overrides: Partial<{
    button: number;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
  }> = {}
) {
  return {
    button: 0,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: vi.fn(),
    ...overrides,
  } as unknown as ReactMouseEvent;
}

describe('useProfileLinkClick - invalidation conditions', () => {
  it('prevents default and does not call onNavigate when disabled', () => {
    const onNavigate = vi.fn();
    const { result } = renderHook(() =>
      useProfileLinkClick({ disabled: true, onNavigate })
    );

    const event = makeMouseEvent();
    result.current(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('calls onNavigate on a plain left click when not disabled', () => {
    const onNavigate = vi.fn();
    const { result } = renderHook(() =>
      useProfileLinkClick({ disabled: false, onNavigate })
    );

    const event = makeMouseEvent();
    result.current(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['ctrlKey', { ctrlKey: true }],
    ['metaKey', { metaKey: true }],
    ['shiftKey', { shiftKey: true }],
    ['altKey', { altKey: true }],
    ['middle click', { button: 1 }],
  ])(
    'lets the browser handle the native new-tab behavior for %s instead of calling onNavigate',
    (_label, overrides) => {
      const onNavigate = vi.fn();
      const { result } = renderHook(() =>
        useProfileLinkClick({ disabled: false, onNavigate })
      );

      const event = makeMouseEvent(overrides);
      result.current(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(onNavigate).not.toHaveBeenCalled();
    }
  );

  it('does nothing (no throw) when onNavigate is not provided', () => {
    const { result } = renderHook(() => useProfileLinkClick({}));

    expect(() => result.current(makeMouseEvent())).not.toThrow();
  });
});
