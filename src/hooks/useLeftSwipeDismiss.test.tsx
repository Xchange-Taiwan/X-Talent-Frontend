import { fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useLeftSwipeDismiss } from './useLeftSwipeDismiss';

function Harness({ onDismiss }: { onDismiss: () => void }) {
  const handlers = useLeftSwipeDismiss({ onDismiss });
  return (
    <div data-testid="target" {...handlers}>
      <button data-testid="action" onClick={() => {}}>
        action
      </button>
    </div>
  );
}

function firePointer(
  el: Element,
  type: string,
  { pointerId = 1, clientX = 0, clientY = 0 } = {}
) {
  fireEvent(
    el,
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId,
      clientX,
      clientY,
    })
  );
}

describe('useLeftSwipeDismiss', () => {
  let onDismiss: () => void;

  beforeEach(() => {
    onDismiss = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dismisses once a left swipe crosses the threshold', () => {
    render(<Harness onDismiss={onDismiss} />);
    const target = screen.getByTestId('target');

    firePointer(target, 'pointerdown', { clientX: 200 });
    firePointer(target, 'pointermove', { clientX: 150 });
    firePointer(target, 'pointermove', { clientX: 110 });
    firePointer(target, 'pointerup', { clientX: 110 });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(target.getAttribute('data-swipe')).toBe('end');
    expect(target.style.getPropertyValue('--radix-toast-swipe-end-x')).toBe(
      '-90px'
    );
  });

  it('cancels and stays open when the left swipe does not cross the threshold', () => {
    render(<Harness onDismiss={onDismiss} />);
    const target = screen.getByTestId('target');

    firePointer(target, 'pointerdown', { clientX: 200 });
    firePointer(target, 'pointermove', { clientX: 190 });
    firePointer(target, 'pointerup', { clientX: 190 });

    expect(onDismiss).not.toHaveBeenCalled();
    expect(target.getAttribute('data-swipe')).toBe('cancel');
    expect(target.style.getPropertyValue('--radix-toast-swipe-move-x')).toBe(
      ''
    );
  });

  it('ignores rightward drags entirely, leaving them to the native swipe handling', () => {
    render(<Harness onDismiss={onDismiss} />);
    const target = screen.getByTestId('target');

    firePointer(target, 'pointerdown', { clientX: 100 });
    firePointer(target, 'pointermove', { clientX: 200 });
    firePointer(target, 'pointerup', { clientX: 200 });

    expect(onDismiss).not.toHaveBeenCalled();
    expect(target.getAttribute('data-swipe')).toBeNull();
  });

  it('captures the pointer once a left drag is confirmed, and releases it on pointerup', () => {
    const setPointerCapture = vi.spyOn(
      HTMLElement.prototype,
      'setPointerCapture'
    );
    const hasPointerCapture = vi
      .spyOn(HTMLElement.prototype, 'hasPointerCapture')
      .mockReturnValue(true);
    const releasePointerCapture = vi.spyOn(
      HTMLElement.prototype,
      'releasePointerCapture'
    );

    render(<Harness onDismiss={onDismiss} />);
    const target = screen.getByTestId('target');

    firePointer(target, 'pointerdown', { clientX: 200 });
    expect(setPointerCapture).not.toHaveBeenCalled();

    firePointer(target, 'pointermove', { clientX: 150 });
    expect(setPointerCapture).toHaveBeenCalledWith(1);

    firePointer(target, 'pointerup', { clientX: 100 });
    expect(hasPointerCapture).toHaveBeenCalledWith(1);
    expect(releasePointerCapture).toHaveBeenCalledWith(1);
  });

  it('recovers cleanly from a pointercancel mid-drag instead of getting stuck', () => {
    render(<Harness onDismiss={onDismiss} />);
    const target = screen.getByTestId('target');

    firePointer(target, 'pointerdown', { clientX: 200 });
    firePointer(target, 'pointermove', { clientX: 150 });
    expect(target.getAttribute('data-swipe')).toBe('move');

    firePointer(target, 'pointercancel', { clientX: 150 });

    expect(target.getAttribute('data-swipe')).toBe('cancel');
    expect(target.style.getPropertyValue('--radix-toast-swipe-move-x')).toBe(
      ''
    );

    // A fresh gesture afterwards must behave normally, proving state wasn't
    // left stuck by the interrupted one.
    firePointer(target, 'pointerdown', { clientX: 200 });
    firePointer(target, 'pointermove', { clientX: 150 });
    firePointer(target, 'pointermove', { clientX: 110 });
    firePointer(target, 'pointerup', { clientX: 110 });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('abandons the gesture for good once it first resolves as vertical, instead of re-evaluating later leftward drift', () => {
    render(<Harness onDismiss={onDismiss} />);
    const target = screen.getByTestId('target');

    firePointer(target, 'pointerdown', { clientX: 200, clientY: 200 });
    // First move past the buffer is vertical-dominant (dx: -10, dy: +60) —
    // this should commit to "not a left swipe" and stop tracking entirely.
    firePointer(target, 'pointermove', { clientX: 190, clientY: 260 });
    expect(target.getAttribute('data-swipe')).toBeNull();

    // A later sample in the same gesture is strongly leftward; a naive
    // per-event re-check would wrongly hijack the scroll at this point.
    firePointer(target, 'pointermove', { clientX: 100, clientY: 260 });
    expect(target.getAttribute('data-swipe')).toBeNull();

    firePointer(target, 'pointerup', { clientX: 100, clientY: 260 });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('does not dismiss when the drag is pulled back past the start point to the right', () => {
    render(<Harness onDismiss={onDismiss} />);
    const target = screen.getByTestId('target');

    firePointer(target, 'pointerdown', { clientX: 200 });
    firePointer(target, 'pointermove', { clientX: 100 }); // confirms left swipe
    expect(target.getAttribute('data-swipe')).toBe('move');

    // Reverses past the original start point, ending up well to the right.
    firePointer(target, 'pointermove', { clientX: 300 });
    firePointer(target, 'pointerup', { clientX: 300 });

    expect(onDismiss).not.toHaveBeenCalled();
    expect(target.getAttribute('data-swipe')).toBe('cancel');
  });

  it('does not block a plain tap on an inner action button', () => {
    render(<Harness onDismiss={onDismiss} />);
    const button = screen.getByTestId('action');
    const onClick = vi.fn();
    button.addEventListener('click', onClick);

    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
