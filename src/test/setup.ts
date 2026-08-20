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

// jsdom doesn't implement scrollIntoView, but cmdk (Command) calls it when an
// item becomes selected. Defined on Element (not HTMLElement) to match the
// DOM spec — and so it doesn't shadow the per-test overrides some suites set
// directly on Element.prototype.scrollIntoView to spy on scroll targets.
if (
  typeof Element !== 'undefined' &&
  typeof Element.prototype.scrollIntoView === 'undefined'
) {
  Element.prototype.scrollIntoView = function () {};
}
