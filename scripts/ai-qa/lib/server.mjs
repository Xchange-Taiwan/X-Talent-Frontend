// Boots/tears down a `next dev` instance the QA stage drives with Playwright.
// Separate from scripts/ai-dev/lib/proc.mjs's runProcess() — that one runs a
// command to completion (lint/tsc), this one starts a long-lived server and
// hands back a live handle while it keeps running.
import { createServer } from 'node:net';

import crossSpawn from 'cross-spawn';

import {
  killTree,
  registerChild,
  unregisterChild,
} from '../../ai-dev/lib/proc.mjs';

export class DevServerTimeoutError extends Error {}

/** Asks the OS for an ephemeral free port instead of hardcoding one — avoids
 * clashing with a developer's own `pnpm dev` already running on 3000. */
export function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/**
 * Starts `pnpm dev -p <port>` in `cwd` (the current working tree, or a base-ref
 * worktree) and returns a handle. Inherits the full parent environment
 * (unlike proc.mjs's runProcess, which strips secret-shaped env vars for
 * throwaway lint/tsc children) — the dev server genuinely needs
 * NEXTAUTH_SECRET/NEXT_PUBLIC_API_URL/etc. to serve real pages.
 *
 * `env` overrides (e.g. pointing NEXT_PUBLIC_API_URL at the QA mock server —
 * see mock-api-server.mjs / qa-bridge.mjs) are layered on top of the
 * inherited environment, not used standalone — `next dev` still needs
 * everything else from the real environment to boot.
 */
export function startDevServer({ cwd, port, env = {} }) {
  const child = crossSpawn('pnpm', ['dev', '-p', String(port)], {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  registerChild(child);

  let output = '';
  const capture = (chunk) => {
    output += chunk.toString();
  };
  child.stdout?.on('data', capture);
  child.stderr?.on('data', capture);

  return {
    child,
    port,
    getOutput: () => output,
  };
}

/** Polls the server until it answers at all (any HTTP status, even 404, means
 * it's alive) or `timeoutMs` elapses. A dev-agent syntax error that keeps
 * `next dev` from ever compiling should surface as a timeout here, which the
 * caller treats as `infra-error` — never as a failed QA scenario. */
export async function waitForReady({ port, timeoutMs = 60_000 }) {
  const deadline = Date.now() + timeoutMs;
  const url = `http://localhost:${port}`;
  while (Date.now() < deadline) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(2000) });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new DevServerTimeoutError(
    `Dev server on port ${port} did not respond within ${timeoutMs}ms.`
  );
}

// `next dev` loads native binaries (e.g. `sharp`'s libvips DLL for
// next/image optimization) into its own process memory — on Windows those
// files stay locked until the process has actually exited, not just been
// signaled. killTree()'s SIGTERM is fire-and-forget; a caller that
// immediately tries to delete the cwd afterwards (see worktree.mjs, used
// for the base-ref "before" server) can race a still-shutting-down process
// and hit an EPERM/"directory not empty" file lock (confirmed empirically).
// Waiting for the real 'exit' event, plus a short grace period for Windows
// to finish releasing handles, closes that race.
const EXIT_WAIT_TIMEOUT_MS = 10_000;
const POST_EXIT_GRACE_MS = 500;

function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

export async function stopDevServer(handle) {
  if (!handle) return;
  killTree(handle.child);
  await waitForExit(handle.child, EXIT_WAIT_TIMEOUT_MS);
  await new Promise((resolve) => setTimeout(resolve, POST_EXIT_GRACE_MS));
  unregisterChild(handle.child);
}
