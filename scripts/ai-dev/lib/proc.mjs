import crossSpawn from 'cross-spawn';
import treeKill from 'tree-kill';

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_OUTPUT_CHARS = 8_000;

// Tracked so a SIGINT handler can kill anything still running instead of
// leaving an orphaned pnpm/tsc/eslint process behind when the user Ctrl+Cs
// mid-check (see orchestrator.mjs's SIGINT handler).
const activeChildren = new Set();

// `child.kill()` only signals the top-level process cross-spawn started —
// on Windows that's a `.cmd` wrapper, on POSIX `pnpm` itself may exec a
// further child. Neither reliably propagates to the actual eslint/tsc
// process underneath, leaving it orphaned to keep running (and holding file
// locks) after a timeout or Ctrl+C. tree-kill walks the whole process tree.
function killTree(child) {
  if (child.pid) {
    treeKill(child.pid, 'SIGTERM');
  } else {
    child.kill();
  }
}

export function killActiveChildren() {
  for (const child of activeChildren) {
    killTree(child);
  }
}

// Long-lived children that outlive a single runProcess() call (the QA
// stage's dev servers, MCP-driven browser sessions) register themselves here
// so the same SIGINT handler that cleans up lint/tsc children also sweeps
// them, instead of each caller needing its own tracking set.
export function registerChild(child) {
  activeChildren.add(child);
}

export function unregisterChild(child) {
  activeChildren.delete(child);
}

export { killTree };

// Everything spawned here (eslint, tsc, and anything the agent runs via its
// own runCommand whitelist) is potentially executing code the agent just
// wrote, which a prompt-injected ticket could have steered. Filter by
// name pattern rather than deleting one exact key: (1) that only ever
// protected GEMINI_API_KEY, leaving every other secret in the developer's
// shell (E2E_PASSWORD, any personal GITHUB_TOKEN, etc.) fully exposed; (2)
// on Windows, spreading `process.env` into a plain object loses its
// case-insensitive lookup — the key keeps whatever case it was actually set
// with (e.g. `$env:Gemini_Api_Key` in PowerShell), so an exact-case
// `delete env.GEMINI_API_KEY` can silently miss it.
const SENSITIVE_ENV_NAME_PATTERN =
  /(SECRET|TOKEN|PASSWORD|_KEY$|API_KEY|ACCESS_KEY)/i;

function buildChildEnv() {
  const env = { ...process.env, CI: 'true' };
  for (const key of Object.keys(env)) {
    if (SENSITIVE_ENV_NAME_PATTERN.test(key)) {
      delete env[key];
    }
  }
  return env;
}

/** Keeps only the last `maxChars` of `buffer + chunk` — errors/summaries from
 * tsc/eslint land at the end of the output, so the tail is what matters. */
function appendTruncated(buffer, chunk, maxChars) {
  const combined = buffer + chunk;
  if (combined.length <= maxChars) return combined;
  // V8 can implement String.slice() as a SlicedString that keeps the full
  // parent string alive in memory rather than copying — on a stream that
  // truncates every 'data' event, that chains into holding the entire
  // untruncated output (however large) for the process's whole lifetime.
  // Round-tripping through Buffer forces a real flat copy.
  return Buffer.from(combined.slice(combined.length - maxChars)).toString(
    'utf-8'
  );
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
      killTree(child);
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
