// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

const { execFileSync } = await import('node:child_process');
const {
  captureCleanEnv,
  GitError,
  isWorkingTreeClean,
  currentBranch,
  updateDevelopFastForward,
  mergeBase,
  branchExistsLocally,
  branchExistsOnRemote,
  fetchAndCheckoutRemoteBranch,
  createBranchFrom,
  stageAll,
  hasStagedChanges,
  stagedFilesExcludingDeleted,
  diffNameOnly,
  commitWip,
  commit,
  pushBranch,
  remoteOriginUrl,
  parseOwnerRepo,
} = await import('./git.mjs');

function failure(message = 'command failed') {
  return Object.assign(new Error(message), { stderr: message });
}

/** Builds an execFileSync mock implementation from `{ 'arg0 arg1 ...': returnValueOrError }`. Matches on the joined args array, ignoring the leading 'git'. */
function mockGit(responses) {
  execFileSync.mockImplementation((_cmd, args) => {
    const key = args.join(' ');
    if (!(key in responses)) {
      throw new Error(`unexpected git invocation in test: git ${key}`);
    }
    const value = responses[key];
    if (value instanceof Error) throw value;
    return value;
  });
}

beforeEach(() => {
  execFileSync.mockReset();
});

describe('isWorkingTreeClean', () => {
  it('is true when git status --porcelain has no output', () => {
    mockGit({ 'status --porcelain': '' });
    expect(isWorkingTreeClean()).toBe(true);
  });

  it('is false when there is uncommitted output', () => {
    mockGit({ 'status --porcelain': ' M some/file.ts\n' });
    expect(isWorkingTreeClean()).toBe(false);
  });
});

describe('captureCleanEnv', () => {
  it('before capture, git subprocesses inherit live process.env', () => {
    mockGit({ 'rev-parse --abbrev-ref HEAD': 'develop' });
    currentBranch();
    const [, , opts] = execFileSync.mock.calls[0];
    expect(opts.env).toBe(process.env);
  });

  it('after capture, git subprocesses get the pre-capture snapshot, not live process.env — so dev-only vars .env.development.local injects afterwards (NEXT_PUBLIC_API_URL, GEMINI_API_KEY, etc.) never reach a `git push`/`commit` and the .husky hooks they can trigger', () => {
    const before = process.env.NEXT_PUBLIC_API_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
    try {
      captureCleanEnv();
      process.env.NEXT_PUBLIC_API_URL = 'https://leaked.example.com/api';

      mockGit({ 'rev-parse --abbrev-ref HEAD': 'develop' });
      currentBranch();

      const [, , opts] = execFileSync.mock.calls[0];
      expect(opts.env).not.toBe(process.env);
      expect(opts.env.NEXT_PUBLIC_API_URL).toBeUndefined();
    } finally {
      delete process.env.NEXT_PUBLIC_API_URL;
      if (before !== undefined) process.env.NEXT_PUBLIC_API_URL = before;
    }
  });
});

describe('currentBranch', () => {
  it('returns the trimmed branch name', () => {
    mockGit({ 'rev-parse --abbrev-ref HEAD': 'feat/306-ai-dev-automation\n' });
    expect(currentBranch()).toBe('feat/306-ai-dev-automation');
  });
});

describe('updateDevelopFastForward', () => {
  it('fast-forwards cleanly when local develop already exists', () => {
    mockGit({
      'fetch origin develop': '',
      'rev-parse --verify develop': 'abc123',
      'checkout develop': '',
      'merge --ff-only origin/develop': 'Updating abc..def',
    });
    expect(() => updateDevelopFastForward()).not.toThrow();
    const calledArgs = execFileSync.mock.calls.map(([, args]) =>
      args.join(' ')
    );
    expect(calledArgs).not.toContain('branch develop origin/develop');
  });

  it('throws GitError when the initial fetch fails', () => {
    mockGit({ 'fetch origin develop': failure('network unreachable') });
    expect(() => updateDevelopFastForward()).toThrow(GitError);
  });

  it('creates a local develop branch when none exists yet', () => {
    mockGit({
      'fetch origin develop': '',
      'rev-parse --verify develop': failure('unknown revision'),
      'branch develop origin/develop': '',
      'checkout develop': '',
      'merge --ff-only origin/develop': 'Already up to date.',
    });
    expect(() => updateDevelopFastForward()).not.toThrow();
    const calledArgs = execFileSync.mock.calls.map(([, args]) =>
      args.join(' ')
    );
    expect(calledArgs).toContain('branch develop origin/develop');
  });

  it('throws GitError instead of merging when local develop has diverged', () => {
    mockGit({
      'fetch origin develop': '',
      'rev-parse --verify develop': 'abc123',
      'checkout develop': '',
      'merge --ff-only origin/develop': failure('not possible to fast-forward'),
    });
    expect(() => updateDevelopFastForward()).toThrow(/diverged/);
  });
});

describe('mergeBase', () => {
  it('returns the trimmed merge-base commit', () => {
    mockGit({ 'merge-base HEAD develop': 'abcdef1234567890\n' });
    expect(mergeBase('HEAD', 'develop')).toBe('abcdef1234567890');
  });
});

describe('branchExistsLocally / branchExistsOnRemote', () => {
  it('branchExistsLocally is true when rev-parse succeeds', () => {
    mockGit({ 'rev-parse --verify feat/x': 'abc123' });
    expect(branchExistsLocally('feat/x')).toBe(true);
  });

  it('branchExistsLocally is false when rev-parse fails', () => {
    mockGit({ 'rev-parse --verify feat/x': failure('unknown revision') });
    expect(branchExistsLocally('feat/x')).toBe(false);
  });

  it('branchExistsOnRemote is true when ls-remote returns a matching ref', () => {
    mockGit({
      'ls-remote --heads origin feat/x': 'abc123\trefs/heads/feat/x\n',
    });
    expect(branchExistsOnRemote('feat/x')).toBe(true);
  });

  it('branchExistsOnRemote is false when ls-remote returns nothing', () => {
    mockGit({ 'ls-remote --heads origin feat/x': '' });
    expect(branchExistsOnRemote('feat/x')).toBe(false);
  });
});

describe('fetchAndCheckoutRemoteBranch', () => {
  it('fetches the branch (not a refspec) then checks it out, so upstream tracking gets set', () => {
    mockGit({ 'fetch origin feat/x': '', 'checkout feat/x': '' });
    fetchAndCheckoutRemoteBranch('feat/x');
    const calledArgs = execFileSync.mock.calls.map(([, args]) =>
      args.join(' ')
    );
    expect(calledArgs).toEqual(['fetch origin feat/x', 'checkout feat/x']);
  });
});

describe('createBranchFrom', () => {
  it('checks out a new branch from the given base ref', () => {
    mockGit({ 'checkout -b feat/x develop': '' });
    createBranchFrom('feat/x', 'develop');
    expect(execFileSync).toHaveBeenCalledWith(
      'git',
      ['checkout', '-b', 'feat/x', 'develop'],
      expect.anything()
    );
  });
});

describe('stageAll / commitWip', () => {
  it('stageAll runs git add -A', () => {
    mockGit({ 'add -A': '' });
    stageAll();
    expect(execFileSync).toHaveBeenCalledWith(
      'git',
      ['add', '-A'],
      expect.anything()
    );
  });

  it('commitWip commits with --no-verify and the given message', () => {
    mockGit({ 'commit -m wip: iteration 1 --no-verify': '' });
    commitWip('wip: iteration 1');
    expect(execFileSync).toHaveBeenCalledWith(
      'git',
      ['commit', '-m', 'wip: iteration 1', '--no-verify'],
      expect.anything()
    );
  });
});

describe('commit / pushBranch', () => {
  it('commit runs without --no-verify so hooks run normally', () => {
    mockGit({ 'commit -m feat: do the thing': '' });
    commit('feat: do the thing');
    expect(execFileSync).toHaveBeenCalledWith(
      'git',
      ['commit', '-m', 'feat: do the thing'],
      expect.anything()
    );
  });

  it('pushBranch pushes with -u to set upstream tracking', () => {
    mockGit({ 'push -u origin feat/x': '' });
    pushBranch('feat/x');
    expect(execFileSync).toHaveBeenCalledWith(
      'git',
      ['push', '-u', 'origin', 'feat/x'],
      expect.anything()
    );
  });

  it('pushBranch throws GitError on failure', () => {
    mockGit({ 'push -u origin feat/x': failure('rejected') });
    expect(() => pushBranch('feat/x')).toThrow(GitError);
  });
});

describe('hasStagedChanges', () => {
  it('is true when diff --cached --quiet exits non-zero (differences exist)', () => {
    mockGit({ 'diff --cached --quiet': failure('exit 1') });
    expect(hasStagedChanges()).toBe(true);
  });

  it('is false when diff --cached --quiet exits zero (no differences)', () => {
    mockGit({ 'diff --cached --quiet': '' });
    expect(hasStagedChanges()).toBe(false);
  });
});

describe('stagedFilesExcludingDeleted', () => {
  it('splits NUL-delimited output into a file list', () => {
    mockGit({
      'diff --cached --name-only --diff-filter=d -z': 'src/a.ts\0src/b.ts\0',
    });
    expect(stagedFilesExcludingDeleted()).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('returns an empty array when there is no output', () => {
    mockGit({ 'diff --cached --name-only --diff-filter=d -z': '' });
    expect(stagedFilesExcludingDeleted()).toEqual([]);
  });

  it('uses -z so a non-ASCII filename comes back raw instead of quoted/escaped', () => {
    mockGit({
      'diff --cached --name-only --diff-filter=d -z': 'src/檔案.ts\0',
    });
    expect(stagedFilesExcludingDeleted()).toEqual(['src/檔案.ts']);
  });
});

describe('diffNameOnly', () => {
  it('splits NUL-delimited output into a file list', () => {
    mockGit({
      'diff --name-only -z abc123...HEAD': 'src/a.ts\0src/b.ts\0',
    });
    expect(diffNameOnly('abc123')).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('uses -z so a non-ASCII filename comes back raw instead of quoted/escaped', () => {
    mockGit({ 'diff --name-only -z abc123...HEAD': 'src/檔案.ts\0' });
    expect(diffNameOnly('abc123')).toEqual(['src/檔案.ts']);
  });
});

describe('remoteOriginUrl / parseOwnerRepo', () => {
  it('remoteOriginUrl returns the trimmed remote URL', () => {
    mockGit({
      'remote get-url origin':
        'https://github.com/Xchange-Taiwan/X-Talent-Frontend.git\n',
    });
    expect(remoteOriginUrl()).toBe(
      'https://github.com/Xchange-Taiwan/X-Talent-Frontend.git'
    );
  });

  it('parseOwnerRepo parses an HTTPS remote URL', () => {
    expect(
      parseOwnerRepo('https://github.com/Xchange-Taiwan/X-Talent-Frontend.git')
    ).toEqual({
      owner: 'Xchange-Taiwan',
      repo: 'X-Talent-Frontend',
    });
  });

  it('parseOwnerRepo parses an SSH remote URL', () => {
    expect(
      parseOwnerRepo('git@github.com:Xchange-Taiwan/X-Talent-Frontend.git')
    ).toEqual({
      owner: 'Xchange-Taiwan',
      repo: 'X-Talent-Frontend',
    });
  });

  it('parseOwnerRepo works without a trailing .git', () => {
    expect(
      parseOwnerRepo('https://github.com/Xchange-Taiwan/X-Talent-Frontend')
    ).toEqual({
      owner: 'Xchange-Taiwan',
      repo: 'X-Talent-Frontend',
    });
  });

  it('parseOwnerRepo throws GitError for an unparseable URL', () => {
    expect(() => parseOwnerRepo('not-a-url')).toThrow(GitError);
  });
});
