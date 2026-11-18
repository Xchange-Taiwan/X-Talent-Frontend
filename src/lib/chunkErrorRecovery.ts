export const CHUNK_RELOAD_STORAGE_KEY = 'xtalent_chunk_reload_ts';
export const CHUNK_RELOAD_COOLDOWN_MS = 15_000;

const CHUNK_ERROR_MESSAGE_PATTERNS: ReadonlyArray<RegExp> = [
  /Loading chunk [\w-]+ failed/i,
  /Loading CSS chunk [\w-]+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
];

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof Error && error.name === 'ChunkLoadError') {
    return true;
  }
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  if (!message) return false;
  return CHUNK_ERROR_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

export interface ChunkRecoveryOptions {
  pathname?: string;
  now?: number;
  cooldownMs?: number;
  reload?: () => void;
}

/**
 * Performs at most one automatic page reload per pathname within the cooldown
 * window when a deployment-skew chunk load error occurs. Returns `true` if a
 * reload was triggered, or `false` when not a chunk error or cooldown is active.
 */
export function tryRecoverFromChunkLoadError(
  error: unknown,
  options: ChunkRecoveryOptions = {}
): boolean {
  if (!isChunkLoadError(error)) {
    return false;
  }
  if (typeof window === 'undefined') {
    return false;
  }

  const pathname = options.pathname ?? window.location.pathname;
  const now = options.now ?? Date.now();
  const cooldownMs = options.cooldownMs ?? CHUNK_RELOAD_COOLDOWN_MS;
  const reload = options.reload ?? (() => window.location.reload());

  try {
    const raw = window.sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY);
    if (raw) {
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'pathname' in parsed &&
        'ts' in parsed &&
        (parsed as { pathname: unknown }).pathname === pathname &&
        typeof (parsed as { ts: unknown }).ts === 'number' &&
        now - (parsed as { ts: number }).ts < cooldownMs
      ) {
        return false;
      }
    }
    window.sessionStorage.setItem(
      CHUNK_RELOAD_STORAGE_KEY,
      JSON.stringify({ pathname, ts: now })
    );
  } catch {
    // If sessionStorage access itself throws (e.g. strict privacy mode), avoid blind reload loops.
    return false;
  }

  reload();
  return true;
}
