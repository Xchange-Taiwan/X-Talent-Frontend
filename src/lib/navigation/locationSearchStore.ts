type Listener = () => void;

const listeners = new Set<Listener>();
let teardownHistory: (() => void) | null = null;
let notifyScheduled = false;

function scheduleNotify(): void {
  if (notifyScheduled) return;
  notifyScheduled = true;
  queueMicrotask(() => {
    notifyScheduled = false;
    listeners.forEach((listener) => {
      listener();
    });
  });
}

function attachHistoryObserver(): void {
  if (teardownHistory || typeof window === 'undefined') return;

  const origPushState = window.history.pushState;
  const origReplaceState = window.history.replaceState;

  window.history.pushState = (
    data: unknown,
    unused: string,
    url?: string | URL | null
  ) => {
    origPushState.call(window.history, data, unused, url);
    scheduleNotify();
  };

  window.history.replaceState = (
    data: unknown,
    unused: string,
    url?: string | URL | null
  ) => {
    origReplaceState.call(window.history, data, unused, url);
    scheduleNotify();
  };

  window.addEventListener('popstate', scheduleNotify);

  teardownHistory = () => {
    window.history.pushState = origPushState;
    window.history.replaceState = origReplaceState;
    window.removeEventListener('popstate', scheduleNotify);
    teardownHistory = null;
  };
}

export function subscribeLocationSearch(listener: Listener): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  attachHistoryObserver();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && teardownHistory) {
      teardownHistory();
    }
  };
}

export function getLocationSearchSnapshot(): string {
  if (typeof window === 'undefined') return '';
  return window.location.search ?? '';
}

export function getServerLocationSearchSnapshot(): string {
  return '';
}
