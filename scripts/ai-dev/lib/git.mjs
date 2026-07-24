import { execFileSync } from 'node:child_process';

export class GitError extends Error {}

function run(args, { allowFailure = false } = {}) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024 * 20,
    }).trim();
  } catch (err) {
    if (allowFailure) return null;
    throw new GitError(
      `git ${args.join(' ')} failed: ${err.stderr || err.message}`
    );
  }
}

export function isWorkingTreeClean() {
  return run(['status', '--porcelain']) === '';
}

export function currentBranch() {
  return run(['rev-parse', '--abbrev-ref', 'HEAD']);
}

/**
 * Brings the local `develop` branch up to origin/develop without ever
 * producing a merge commit or silently resolving a conflict — either it
 * fast-forwards cleanly or we stop and tell the user to sort out their
 * local `develop` themselves (Round 8 risk: a divergent local develop
 * must never be auto-merged).
 */
export function updateDevelopFastForward() {
  const fetched = run(['fetch', 'origin', 'develop'], { allowFailure: true });
  if (fetched === null) {
    throw new GitError(
      'Could not fetch origin/develop — check your network connection and remote configuration.'
    );
  }

  const hasLocalDevelop =
    run(['rev-parse', '--verify', 'develop'], { allowFailure: true }) !== null;
  if (!hasLocalDevelop) {
    // Round 3 missing state: no local develop yet — create it tracking origin/develop.
    run(['branch', 'develop', 'origin/develop']);
  }

  run(['checkout', 'develop']);
  const merged = run(['merge', '--ff-only', 'origin/develop'], {
    allowFailure: true,
  });
  if (merged === null) {
    throw new GitError(
      'Local `develop` has diverged from origin/develop and cannot fast-forward. ' +
        'Resolve this manually (e.g. `git reset --hard origin/develop` if you have no local work on develop) and re-run.'
    );
  }
}

export function mergeBase(refA, refB) {
  return run(['merge-base', refA, refB]);
}

export function branchExistsLocally(branch) {
  return (
    run(['rev-parse', '--verify', branch], { allowFailure: true }) !== null
  );
}

export function branchExistsOnRemote(branch) {
  const out = run(['ls-remote', '--heads', 'origin', branch], {
    allowFailure: true,
  });
  return Boolean(out);
}

export function checkoutBranch(branch) {
  run(['checkout', branch]);
}

export function fetchAndCheckoutRemoteBranch(branch) {
  // `fetch origin branch:branch` creates the local ref directly via a
  // refspec, which does NOT set branch.<name>.remote/.merge — the developer
  // taking over afterwards would hit "no upstream branch" on a plain
  // `git push`. Fetching into the remote-tracking ref and letting
  // `checkout` DWIM-create the local branch sets upstream tracking correctly.
  run(['fetch', 'origin', branch]);
  run(['checkout', branch]);
}

export function createBranchFrom(branch, baseRef) {
  run(['checkout', '-b', branch, baseRef]);
}

export function stageAll() {
  run(['add', '-A']);
}

/** Stages exactly the given files — narrower than stageAll()'s `git add -A`, which would
 * sweep in anything else that happened to change in the working tree in the meantime. */
export function stageFiles(files) {
  if (files.length === 0) return;
  run(['add', '--', ...files]);
}

export function hasStagedChanges() {
  return run(['diff', '--cached', '--quiet'], { allowFailure: true }) === null;
}

/** Staged files, excluding deletions (Round 10: a deleted file must not be handed to eslint). */
/** `-z`: git's default core.quotePath=true wraps and C-escapes any filename with
 * non-ASCII characters in the porcelain output (e.g. `"src/檔案.ts"`) — splitting
 * that on '\n' would hand a literal-but-wrong quoted string to callers like
 * stageFiles/eslint, which then fail on "no such file". -z switches to raw,
 * unquoted, NUL-delimited output instead. */
export function stagedFilesExcludingDeleted() {
  const out = run(['diff', '--cached', '--name-only', '--diff-filter=d', '-z']);
  return out ? out.split('\0').filter(Boolean) : [];
}

export function commitWip(message) {
  run(['commit', '-m', message, '--no-verify']);
}

/** Files changed between baseRef and HEAD (committed history only — WIP commits included). */
export function diffNameOnly(baseRef) {
  const out = run(['diff', '--name-only', '-z', `${baseRef}...HEAD`]);
  return out ? out.split('\0').filter(Boolean) : [];
}

export function remoteOriginUrl() {
  return run(['remote', 'get-url', 'origin']);
}

/** Parses `owner/repo` out of an SSH or HTTPS GitHub remote URL. */
export function parseOwnerRepo(remoteUrl) {
  const match = remoteUrl.match(/[:/]([^/:]+)\/([^/]+?)(?:\.git)?$/);
  if (!match)
    throw new GitError(
      `Could not parse owner/repo from remote URL "${remoteUrl}".`
    );
  return { owner: match[1], repo: match[2] };
}
