// Checks out a base ref into a throwaway `git worktree` so the QA stage can
// screenshot the pre-ticket state without disturbing the ai:dev run's actual
// working tree.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import crossSpawn from 'cross-spawn';

export class WorktreeError extends Error {}

function git(args, opts = {}) {
  try {
    return execFileSync('git', args, { encoding: 'utf-8', ...opts }).trim();
  } catch (err) {
    throw new WorktreeError(
      `git ${args.join(' ')} failed: ${err.stderr || err.message}`
    );
  }
}

// cross-spawn, not execFileSync('pnpm', ...) — on Windows `pnpm` resolves to
// a .cmd shim, which execFileSync doesn't follow (ENOENT), the same reason
// scripts/ai-dev/lib/proc.mjs already uses cross-spawn for `pnpm` calls.
function pnpmInstall(cwd) {
  const result = crossSpawn.sync(
    'pnpm',
    ['install', '--frozen-lockfile', '--prefer-offline'],
    { cwd, encoding: 'utf-8' }
  );
  if (result.status !== 0) {
    throw new WorktreeError(
      `pnpm install failed in ${cwd}: ${result.stderr || result.error?.message || `exit ${result.status}`}`
    );
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * `git worktree remove --force` observed failing intermittently on Windows
 * with "Directory not empty" even against a plain, non-linked worktree (no
 * junction involved — confirmed by testing after removing the node_modules
 * junction entirely, see withBaseWorktree's docstring). Most likely a
 * transient file-lock/AV-scan race right after `pnpm install` finishes
 * writing thousands of files, not a real content problem. One retry after a
 * short delay clears it in practice; if it still fails, fall back to
 * Node's own `rmSync` (which has its own built-in retry for exactly this
 * class of Windows error) followed by `git worktree prune` to clear git's
 * bookkeeping for the now-manually-deleted directory.
 */
async function removeWorktreeRobustly(mainRoot, worktreeDir) {
  try {
    git(['worktree', 'remove', '--force', worktreeDir], { cwd: mainRoot });
    return;
  } catch {
    await sleep(1000);
  }

  try {
    git(['worktree', 'remove', '--force', worktreeDir], { cwd: mainRoot });
    return;
  } catch (err) {
    console.warn(
      `[ai-qa] git worktree remove failed twice, falling back to manual cleanup: ${err.message}`
    );
  }

  try {
    rmSync(worktreeDir, { recursive: true, force: true });
    git(['worktree', 'prune'], { cwd: mainRoot });
  } catch (err) {
    console.warn(
      `[ai-qa] manual cleanup of scratch worktree ${worktreeDir} also failed: ${err.message}`
    );
  }
}

/**
 * Checks out `baseRef` into a scratch worktree, runs `fn(worktreeDir)`, and
 * always removes the worktree afterwards, even if `fn` throws.
 *
 * Installs a real, fully independent node_modules inside the worktree via
 * `pnpm install` rather than linking to the main repo's — an earlier design
 * symlinked/junctioned the main repo's node_modules directly into the
 * worktree to skip the reinstall, reasoning that ai:dev already forbids the
 * dev agent from touching package.json (see scripts/ai-dev/README.md v1
 * limitations) so base and head always need the same install. That caused
 * real damage during testing: `git worktree remove --force` recursed into
 * the junction on Windows and deleted files out of the *shared* node_modules
 * it pointed at, corrupting the main repo's install (recovered via a clean
 * `pnpm install`, but node_modules being gitignored is the only reason nothing
 * tracked was lost). `--prefer-offline` keeps the extra cost low — the
 * packages are already in pnpm's local content-addressable store from the
 * main install, so this is just relinking, not re-downloading.
 */
export async function withBaseWorktree(baseRef, fn) {
  const mainRoot = git(['rev-parse', '--show-toplevel']);
  const worktreeDir = join(tmpdir(), `ai-qa-base-${randomUUID()}`);

  git(['worktree', 'add', '--detach', worktreeDir, baseRef], { cwd: mainRoot });
  try {
    pnpmInstall(worktreeDir);
    return await fn(worktreeDir);
  } finally {
    await removeWorktreeRobustly(mainRoot, worktreeDir);
  }
}
