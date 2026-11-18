type Listener = () => void;

const listeners = new Set<Listener>();
let historyPatched = false;
let notifyScheduled = false;

function scheduleNotify(): void {
  if (notifyScheduled) return;
  notifyScheduled = true;
  queueMicrotask(() => {
    notifyScheduled = false;
    for (const listener of listeners) {
      listener();
    }
  });
}

function ensureHistoryObserved(): void {
  if (historyPatched || typeof window === 'undefined') return;
  historyPatched = true;

  const origPushState = window.history.pushState.bind(window.history);
  window.history.pushState = (
    data: unknown,
    unused: string,
    url?: string | URL | null
  ) => {
    origPushState(data, unused, url);
    scheduleNotify();
  };

  const origReplaceState = window.history.replaceState.bind(window.history);
  window.history.replaceState = (
    data: unknown,
    unused: string,
    url?: string | URL | null
  ) => {
    origReplaceState(data, unused, url);
    scheduleNotify();
  };

  window.addEventListener('popstate', scheduleNotify);
}

export function subscribeLocationSearch(listener: Listener): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  ensureHistoryObserved();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLocationSearchSnapshot(): string {
  if (typeof window === 'undefined') return '';
  return window.location.search ?? '';
}

export function getServerLocationSearchSnapshot(): string {
  return '';
}
