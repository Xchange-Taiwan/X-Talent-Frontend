import '@testing-library/jest-dom';

import { createNavigation } from '@storybook/nextjs/navigation.mock';
import { createRouter } from '@storybook/nextjs/router.mock';

createRouter({});
createNavigation({});

// Node >=25/26 defines an experimental global `localStorage` getter that
// returns `undefined` when `--localstorage-file` is omitted, shadowing jsdom's
// Storage implementation. Install a standard in-memory Storage polyfill when
// `localStorage.clear` is unavailable so tests behave identically across Node
// 22, 24, and 26.
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(String(key)) ? (store.get(String(key)) ?? null) : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(String(key));
    },
    setItem(key: string, value: string) {
      store.set(String(key), String(value));
    },
  };
}

if (typeof window !== 'undefined') {
  let hasWorkingLocalStorage = false;
  try {
    hasWorkingLocalStorage =
      Boolean(window.localStorage) &&
      typeof window.localStorage.clear === 'function';
  } catch {
    hasWorkingLocalStorage = false;
  }
  if (!hasWorkingLocalStorage) {
    const memoryStorage = createMemoryStorage();
    Object.defineProperty(window, 'localStorage', {
      value: memoryStorage,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      value: memoryStorage,
      configurable: true,
      writable: true,
    });
  }
}

// jsdom doesn't implement ResizeObserver, but some Radix UI primitives
// (e.g. Popover.Arrow) depend on it being present at mount time.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom doesn't implement matchMedia, which useMediaQuery (and through it
// SearchableSelect's popover-vs-sheet switch) reads at mount. Reports "no
// match" so responsive components render their desktop branch under test;
// suites that need the mobile branch stub window.matchMedia themselves.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'undefined') {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
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
