import { render } from '@testing-library/react';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useScrollThumb } from './useScrollThumb';

function TestComponent() {
  const [handlers] = useScrollThumb();
  return React.createElement(
    'div',
    { ref: handlers.trackRefCallback },
    React.createElement('div', {
      ref: handlers.scrollRefCallback,
      onMouseEnter: handlers.onMouseEnter,
      onMouseLeave: handlers.onMouseLeave,
    })
  );
}

describe('useScrollThumb', () => {
  let disconnectMock: ReturnType<typeof vi.fn>;
  let observeMock: ReturnType<typeof vi.fn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    disconnectMock = vi.fn();
    observeMock = vi.fn();
    class MockResizeObserver {
      observe = observeMock;
      unobserve = vi.fn();
      disconnect = disconnectMock;
    }
    globalThis.ResizeObserver =
      MockResizeObserver as unknown as typeof ResizeObserver;
    removeEventListenerSpy = vi.spyOn(
      HTMLDivElement.prototype,
      'removeEventListener'
    );
  });

  afterEach(() => {
    removeEventListenerSpy.mockRestore();
  });

  it('disconnects the ResizeObserver and removes the scroll listener on unmount', () => {
    const { unmount } = render(React.createElement(TestComponent));

    expect(observeMock).toHaveBeenCalledTimes(2); // track + scroll elements

    unmount();

    expect(disconnectMock).toHaveBeenCalledTimes(1);
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function)
    );
  });
});
