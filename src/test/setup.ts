import '@testing-library/jest-dom';

import { createNavigation } from '@storybook/nextjs/navigation.mock';
import { createRouter } from '@storybook/nextjs/router.mock';

createRouter({});
createNavigation({});

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
// swipe-to-dismiss (and our custom left-swipe handling) both rely on.
// Guarded on HTMLElement itself first: some suites (e.g. scripts/ai-review's
// .test.mjs files) run this same setup file under the node environment,
// where HTMLElement doesn't exist at all.
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
