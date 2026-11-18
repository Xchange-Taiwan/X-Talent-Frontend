export const SENTRY_CLIENT_IGNORE_ERRORS: Array<string | RegExp> = [
  /Invalid call to runtime\.sendMessage\(\)/i,
  /Failed to execute 'removeChild' on 'Node'/i,
  /Failed to execute 'insertBefore' on 'Node'/i,
  /ResizeObserver loop (?:limit exceeded|completed with undelivered notifications)/i,
];

export interface LazyReplaySentryAdapter<TIntegration = unknown> {
  lazyLoadIntegration: (
    name: 'replayIntegration'
  ) => Promise<() => TIntegration>;
  addIntegration: (integration: TIntegration) => void;
}

/**
 * Lazily loads Sentry's `replayIntegration` without emitting unhandled promise
 * rejections when adblockers, CSP, or transient network errors block the CDN
 * bundle.
 */
export async function attachLazyReplayIntegration<TIntegration>(
  sentry: LazyReplaySentryAdapter<TIntegration>
): Promise<boolean> {
  try {
    const replayIntegration =
      await sentry.lazyLoadIntegration('replayIntegration');
    sentry.addIntegration(replayIntegration());
    return true;
  } catch {
    return false;
  }
}
