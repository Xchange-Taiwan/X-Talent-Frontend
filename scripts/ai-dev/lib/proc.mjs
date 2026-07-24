import crossSpawn from 'cross-spawn';

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_OUTPUT_CHARS = 8_000;

// Tracked so a SIGINT handler can kill anything still running instead of
// leaving an orphaned pnpm/tsc/eslint process behind when the user Ctrl+Cs
// mid-check (see orchestrator.mjs's SIGINT handler).
const activeChildren = new Set();

export function killActiveChildren() {
  for (const child of activeChildren) {
    child.kill();
  }
}

// Everything spawned here (eslint, tsc, and anything the agent runs via its
// own runCommand whitelist) is potentially executing code the agent just
// wrote, which a prompt-injected ticket could have steered. Don't hand that
// code a live copy of our own secret.
function buildChildEnv() {
  const env = { ...process.env, CI: 'true' };
  delete env.GEMINI_API_KEY;
  return env;
}

/** Keeps only the last `maxChars` of `buffer + chunk` — errors/summaries from
 * tsc/eslint land at the end of the output, so the tail is what matters. */
function appendTruncated(buffer, chunk, maxChars) {
  const combined = buffer + chunk;
  return combined.length > maxChars
    ? combined.slice(combined.length - maxChars)
    : combined;
}

/**
 * Runs a command via cross-spawn (so `pnpm`/`.cmd` resolves correctly on
 * Windows), enforces a timeout, and streams stdout/stderr into a
 * tail-truncated buffer instead of buffering everything then truncating —
 * avoids ENOBUFS on huge output and unbounded memory growth.
 */
export function runProcess(
  command,
  args = [],
  {
    cwd = process.cwd(),
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxOutputChars = DEFAULT_MAX_OUTPUT_CHARS,
  } = {}
) {
  return new Promise((resolvePromise) => {
    const child = crossSpawn(command, args, {
      cwd,
      env: buildChildEnv(),
    });
    activeChildren.add(child);

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout?.on('data', (chunk) => {
      stdout = appendTruncated(stdout, chunk.toString(), maxOutputChars);
    });
    child.stderr?.on('data', (chunk) => {
      stderr = appendTruncated(stderr, chunk.toString(), maxOutputChars);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      activeChildren.delete(child);
      resolvePromise({ code, stdout, stderr, timedOut });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      activeChildren.delete(child);
      resolvePromise({
        code: -1,
        stdout,
        stderr: `${stderr}\n${err.message}`,
        timedOut,
      });
    });
  });
}
