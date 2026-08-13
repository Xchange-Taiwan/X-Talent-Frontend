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
