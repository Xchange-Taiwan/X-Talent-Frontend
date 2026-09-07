import '@testing-library/jest-dom';

// jsdom doesn't implement ResizeObserver, but some Radix UI primitives
// (e.g. Popover.Arrow) depend on it being present at mount time.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom doesn't implement the Pointer Capture APIs, which Radix's own
// components rely on.
if (
  typeof HTMLElement !== 'undefined' &&
  typeof HTMLElement.prototype.setPointerCapture === 'undefined'
) {
  HTMLElement.prototype.setPointerCapture = function () {};
  HTMLElement.prototype.releasePointerCapture = function () {};
  HTMLElement.prototype.hasPointerCapture = function () {
    return false;
  };
}

// jsdom doesn't implement scrollIntoView, but cmdk (Command) calls it when an
// item becomes selected.
if (
  typeof Element !== 'undefined' &&
  typeof Element.prototype.scrollIntoView === 'undefined'
) {
  Element.prototype.scrollIntoView = function () {};
}
