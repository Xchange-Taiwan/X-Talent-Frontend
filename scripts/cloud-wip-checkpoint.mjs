#!/usr/bin/env node
/**
 * Resilience helpers for `cloud-implement.yml`:
 * 1. `verify-phase1`: Allows soft-timed-out or interrupted Phase 1 Gemini runs
 *    to hand off partial workspace edits cleanly to Phase 2 convergence loop
 *    instead of discarding 20+ minutes of work.
 * 2. `save`: Persists unconverged workspace edits onto the ticket's linked
 *    remote branch (`[cloud-wip-checkpoint]`) when no open PR exists yet.
 * 3. `prepare-resume`: Detects a saved `[cloud-wip-checkpoint]` branch on
 *    retry, rebases cleanly onto `origin/develop`, and checks it out so the
 *    next run resumes from existing progress instead of starting from zero.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const WIP_CHECKPOINT_TAG = '[cloud-wip-checkpoint]';

const BOT_GIT_NAME = 'x-talent-cloud-agent[bot]';
const BOT_GIT_EMAIL = 'x-talent-cloud-agent[bot]@users.noreply.github.com';
const VALID_FEATURE_BRANCH_RE =
  /^(?:feat|fix|chore|refactor|test)\/[A-Za-z0-9._/-]+$/;
const SECRET_ENV_RE = /(^|\/)\.env(\..+)?$/;
const SAFE_ENV_TEMPLATE_RE = /\.env\.(example|sample|template)$/;

export function isInternalCloudPath(rawPath = '') {
  const normalized = String(rawPath ?? '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .trim();
  if (!normalized) {
    return true;
  }
  if (
    normalized === '.agents/tmp' ||
    normalized.startsWith('.agents/tmp/') ||
    normalized === '.gitignore' ||
    normalized === '.gemini/settings.json' ||
    normalized === '.gemini/settings.json.tmp'
  ) {
    return true;
  }
  if (
    SECRET_ENV_RE.test(normalized) &&
    !SAFE_ENV_TEMPLATE_RE.test(normalized)
  ) {
    return true;
  }
  return false;
}

export function parsePorcelainZPaths(rawOutput = '') {
  const entries = String(rawOutput ?? '').split('\0');
  const paths = [];
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (!entry || entry.length < 4) {
      continue;
    }
    const statusXY = entry.slice(0, 2);
    const targetPath = entry.slice(3);
    if (!isInternalCloudPath(targetPath)) {
      paths.push(targetPath);
    }
    if (statusXY.includes('R') || statusXY.includes('C')) {
      i += 1;
    }
  }
  return [...new Set(paths)];
}

export function parseNullDelimitedPaths(rawOutput = '') {
  const paths = String(rawOutput ?? '')
    .split('\0')
    .map((item) => item.trim())
    .filter((item) => Boolean(item) && !isInternalCloudPath(item));
  return [...new Set(paths)];
}

function validateTicketNumber(ticketNumber) {
  const clean = String(ticketNumber ?? '')
    .replace(/^#/, '')
    .trim();
  if (!/^\d+$/.test(clean)) {
    throw new Error(`Invalid ticket number: ${ticketNumber}`);
  }
  return clean;
}

function validateRepoSlug(repo) {
  const clean = String(repo ?? '').trim();
  if (
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(clean) ||
    clean.includes('..')
  ) {
    throw new Error(`Invalid repository identifier: ${repo}`);
  }
  return clean;
}

function isSafeFeatureBranch(branchName = '') {
  const clean = String(branchName ?? '').trim();
  return (
    Boolean(clean) &&
    clean !== 'develop' &&
    clean !== 'main' &&
    !clean.includes('..') &&
    !clean.startsWith('-') &&
    VALID_FEATURE_BRANCH_RE.test(clean)
  );
}

export function collectMeaningfulChanges({
  baseRef = 'origin/develop',
  cwd = process.cwd(),
  execGit = execFileSync,
} = {}) {
  let uncommittedPaths = [];
  try {
    const rawStatus = execGit(
      'git',
      ['status', '--porcelain', '-z', '--untracked-files=all'],
      {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    uncommittedPaths = parsePorcelainZPaths(rawStatus);
  } catch {
    uncommittedPaths = [];
  }

  let committedPaths = [];
  try {
    const rawCommitted = execGit(
      'git',
      ['diff', '--name-only', '-z', `${baseRef}...HEAD`],
      {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    committedPaths = parseNullDelimitedPaths(rawCommitted);
  } catch {
    committedPaths = [];
  }

  const allChangedPaths = [
    ...new Set([...committedPaths, ...uncommittedPaths]),
  ];
  return {
    uncommittedPaths,
    committedPaths,
    allChangedPaths,
  };
}

export function verifyPhase1Outcome({
  exitCode = 0,
  baseRef = 'origin/develop',
  cwd = process.cwd(),
  execGit = execFileSync,
} = {}) {
  const numericExit = Number.isFinite(Number(exitCode)) ? Number(exitCode) : 1;
  const { allChangedPaths } = collectMeaningfulChanges({
    baseRef,
    cwd,
    execGit,
  });

  if (numericExit === 0) {
    return {
      proceedToPhase2: true,
      handedOffAfterNonZero: false,
      exitCode: 0,
      changedCount: allChangedPaths.length,
      allChangedPaths,
    };
  }

  if (allChangedPaths.length > 0) {
    return {
      proceedToPhase2: true,
      handedOffAfterNonZero: true,
      exitCode: numericExit,
      changedCount: allChangedPaths.length,
      allChangedPaths,
    };
  }

  return {
    proceedToPhase2: false,
    handedOffAfterNonZero: false,
    exitCode: numericExit,
    changedCount: 0,
    allChangedPaths: [],
  };
}

function checkZeroOpenPrsFailClosed({
  repo,
  branch,
  cwd,
  execGh = execFileSync,
}) {
  try {
    const raw = execGh(
      'gh',
      [
        'pr',
        'list',
        '--repo',
        repo,
        '--head',
        branch,
        '--state',
        'open',
        '--json',
        'number',
      ],
      {
        cwd,
        encoding: 'utf8',
        timeout: 20000,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length === 0;
  } catch {
    return false;
  }
}

export function prepareWipResumeBranch({
  ticketNumber,
  repo = 'Xchange-Taiwan/X-Talent-Frontend',
  baseBranch = 'develop',
  cwd = process.cwd(),
  execGit = execFileSync,
  execGh = execFileSync,
} = {}) {
  const cleanTicket = validateTicketNumber(ticketNumber);
  const cleanRepo = validateRepoSlug(repo);
  const gitOpts = {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  };

  let lsRemoteOut = '';
  try {
    lsRemoteOut = execGit('git', ['ls-remote', '--heads', 'origin'], gitOpts);
  } catch {
    return '';
  }

  const branchPrefixRe = new RegExp(
    '^refs/heads/((?:feat|fix|chore|refactor|test)/' +
      `${cleanTicket}-[A-Za-z0-9._/-]+)$`
  );
  const candidates = lsRemoteOut
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/)[1] || '')
    .map((ref) => {
      const m = ref.match(branchPrefixRe);
      return m ? m[1] : '';
    })
    .filter((branch) => isSafeFeatureBranch(branch));

  if (candidates.length === 0) {
    return '';
  }

  try {
    execGit(
      'git',
      [
        'fetch',
        'origin',
        `+refs/heads/${baseBranch}:refs/remotes/origin/${baseBranch}`,
        '--quiet',
      ],
      gitOpts
    );
  } catch {
    // Proceed with existing origin/develop ref if already fetched
  }

  for (const candidate of candidates) {
    if (
      !checkZeroOpenPrsFailClosed({
        repo: cleanRepo,
        branch: candidate,
        cwd,
        execGh,
      })
    ) {
      continue;
    }

    try {
      execGit(
        'git',
        [
          'fetch',
          'origin',
          `+refs/heads/${candidate}:refs/remotes/origin/${candidate}`,
          '--quiet',
        ],
        gitOpts
      );
      const lastSubject = execGit(
        'git',
        ['log', '-1', '--format=%s', `refs/remotes/origin/${candidate}`],
        gitOpts
      ).trim();
      if (!lastSubject.includes(WIP_CHECKPOINT_TAG)) {
        continue;
      }

      const rangeSpec =
        `refs/remotes/origin/${baseBranch}..` +
        `refs/remotes/origin/${candidate}`;
      const aheadCount = Number(
        execGit('git', ['rev-list', '--count', rangeSpec], gitOpts).trim()
      );
      if (!Number.isFinite(aheadCount) || aheadCount <= 0) {
        continue;
      }

      execGit(
        'git',
        ['checkout', '-B', candidate, `refs/remotes/origin/${candidate}`],
        gitOpts
      );

      try {
        execGit(
          'git',
          [
            '-c',
            `user.name=${BOT_GIT_NAME}`,
            '-c',
            `user.email=${BOT_GIT_EMAIL}`,
            'rebase',
            `refs/remotes/origin/${baseBranch}`,
          ],
          gitOpts
        );
      } catch {
        try {
          execGit('git', ['rebase', '--abort'], gitOpts);
        } catch {
          // Ignore abort errors
        }
        try {
          execGit(
            'git',
            [
              'checkout',
              '-f',
              '-B',
              baseBranch,
              `refs/remotes/origin/${baseBranch}`,
            ],
            gitOpts
          );
        } catch {
          // Ignore fallback checkout errors
        }
        continue;
      }

      try {
        execGit(
          'git',
          ['push', '--force-with-lease', '-u', 'origin', candidate],
          gitOpts
        );
      } catch {
        // Local branch is rebased cleanly and ready for link-ticket-branch
      }

      return candidate;
    } catch {
      continue;
    }
  }

  return '';
}

export function saveWipCheckpoint({
  ticketNumber,
  repo = 'Xchange-Taiwan/X-Talent-Frontend',
  baseRef = 'origin/develop',
  cwd = process.cwd(),
  fsImpl = fs,
  execGit = execFileSync,
  execGh = execFileSync,
  execBash = execFileSync,
} = {}) {
  const cleanTicket = validateTicketNumber(ticketNumber);
  const cleanRepo = validateRepoSlug(repo);
  const gitOpts = {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  };

  let currentBranch = '';
  try {
    currentBranch = execGit(
      'git',
      ['branch', '--show-current'],
      gitOpts
    ).trim();
  } catch {
    return { saved: false, branch: '', reason: 'git-branch-failed' };
  }

  if (!isSafeFeatureBranch(currentBranch)) {
    return {
      saved: false,
      branch: currentBranch,
      reason: 'not-feature-branch',
    };
  }

  if (
    !checkZeroOpenPrsFailClosed({
      repo: cleanRepo,
      branch: currentBranch,
      cwd,
      execGh,
    })
  ) {
    return {
      saved: false,
      branch: currentBranch,
      reason: 'open-pr-exists-or-check-failed',
    };
  }

  for (const relClean of [
    '.env.development.local',
    '.env.e2e.local',
    '.gemini/settings.json.tmp',
    '.agents/tmp',
  ]) {
    try {
      fsImpl.rmSync(path.join(cwd, relClean), { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  const unstageScript = path.join(
    cwd,
    '.agents',
    'scripts',
    'unstage-cloud-locks.sh'
  );
  const runUnstageHelper = () => {
    if (!fsImpl.existsSync(unstageScript)) {
      return;
    }
    try {
      execBash(
        'bash',
        ['.agents/scripts/unstage-cloud-locks.sh', '--restore-worktree'],
        gitOpts
      );
    } catch {
      // Fallback path filtering below still protects staged index
    }
  };

  runUnstageHelper();
  execGit('git', ['add', '-A'], gitOpts);
  runUnstageHelper();

  const rawStagedFirst = execGit(
    'git',
    ['diff', '--cached', '--name-only', '-z'],
    gitOpts
  );
  const forbiddenStaged = String(rawStagedFirst ?? '')
    .split('\0')
    .filter((item) => Boolean(item) && isInternalCloudPath(item));

  for (const badPath of forbiddenStaged) {
    try {
      execGit('git', ['reset', 'HEAD', '--', badPath], gitOpts);
    } catch {
      // Ignore individual reset errors
    }
  }

  const stagedPaths = parseNullDelimitedPaths(
    execGit('git', ['diff', '--cached', '--name-only', '-z'], gitOpts)
  );

  if (stagedPaths.length > 0) {
    const commitMsg =
      `chore(wip): save cloud checkpoint for #${cleanTicket} ` +
      WIP_CHECKPOINT_TAG;
    execGit(
      'git',
      [
        '-c',
        `user.name=${BOT_GIT_NAME}`,
        '-c',
        `user.email=${BOT_GIT_EMAIL}`,
        'commit',
        '-m',
        commitMsg,
      ],
      gitOpts
    );
  } else {
    let headSubject = '';
    let aheadCount = 0;
    try {
      headSubject = execGit(
        'git',
        ['log', '-1', '--format=%s', 'HEAD'],
        gitOpts
      ).trim();
      aheadCount = Number(
        execGit(
          'git',
          ['rev-list', '--count', `${baseRef}..HEAD`],
          gitOpts
        ).trim()
      );
    } catch {
      return { saved: false, branch: currentBranch, reason: 'no-changes' };
    }
    if (aheadCount <= 0 || !headSubject.includes(WIP_CHECKPOINT_TAG)) {
      return { saved: false, branch: currentBranch, reason: 'no-changes' };
    }
  }

  try {
    execGit(
      'git',
      ['push', '--force-with-lease', '-u', 'origin', currentBranch],
      gitOpts
    );
  } catch {
    execGit('git', ['push', '--force', '-u', 'origin', currentBranch], gitOpts);
  }

  return {
    saved: true,
    branch: currentBranch,
    stagedCount: stagedPaths.length,
    reason: 'saved',
  };
}

function parseCliOption(argv, prefix) {
  const found = argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : '';
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const argv = process.argv.slice(2);
  const subcommand = argv.find((arg) => !arg.startsWith('--')) || '';
  const ticketNumber =
    parseCliOption(argv, '--ticket=') || process.env.TICKET_NUMBER || '';
  const repo =
    parseCliOption(argv, '--repo=') ||
    process.env.GITHUB_REPOSITORY ||
    'Xchange-Taiwan/X-Talent-Frontend';

  try {
    if (subcommand === 'verify-phase1') {
      const exitCode = parseCliOption(argv, '--exit-code=') || '0';
      const outcome = verifyPhase1Outcome({ exitCode });
      if (!outcome.proceedToPhase2) {
        console.error(
          `::error::Phase 1 exited with code ${outcome.exitCode} ` +
            'and 0 modified workspace files; aborting before Phase 2.'
        );
        process.exit(1);
      }
      if (outcome.handedOffAfterNonZero) {
        console.warn(
          `::warning::Phase 1 exited with code ${outcome.exitCode} ` +
            `after modifying ${outcome.changedCount} file(s); ` +
            'handing off partial work to Phase 2 convergence loop.'
        );
      }
      process.exit(0);
    } else if (subcommand === 'prepare-resume') {
      const branch = prepareWipResumeBranch({ ticketNumber, repo });
      if (branch) {
        process.stdout.write(`${branch}\n`);
      }
      process.exit(0);
    } else if (subcommand === 'save') {
      const res = saveWipCheckpoint({ ticketNumber, repo });
      if (res.saved) {
        console.log(
          `::notice::Saved WIP checkpoint for #${ticketNumber} ` +
            `onto branch '${res.branch}'.`
        );
        if (process.env.GITHUB_ENV) {
          fs.appendFileSync(
            process.env.GITHUB_ENV,
            `WIP_CHECKPOINT_BRANCH=${res.branch}\n`,
            'utf8'
          );
        }
      } else {
        console.log(
          `[cloud-wip-checkpoint] Skipped saving checkpoint (${res.reason}).`
        );
      }
      process.exit(0);
    } else {
      console.error(`Unknown subcommand: ${subcommand}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`[cloud-wip-checkpoint] Error: ${err.message}`);
    process.exit(1);
  }
}
