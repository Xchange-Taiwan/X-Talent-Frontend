// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

const { execFileSync } = await import('node:child_process');
const { attemptAutoPr } = await import('./orchestrator.mjs');

function failure(message = 'command failed') {
  return Object.assign(new Error(message), { stderr: message });
}

/** Matches on the joined args array, ignoring which binary ('git' or 'gh') was invoked. */
function mockCalls(responses) {
  execFileSync.mockImplementation((_cmd, args) => {
    const key = args.join(' ');
    if (!(key in responses)) {
      throw new Error(`unexpected invocation in test: ${key}`);
    }
    const value = responses[key];
    if (value instanceof Error) throw value;
    return value;
  });
}

const ticket = {
  number: 312,
  title: 'ai:dev: auto create PR',
  branchName: 'feat/312-test-branch',
};
const RESOLVED_BASE_REF = 'abc123';
const PR_CREATE_KEY =
  'pr create --base develop --head feat/312-test-branch --title feat: ai:dev: auto create PR --body Auto-created by `pnpm ai:dev --auto-pr` — the review pipeline judged this change low risk with zero findings.\n\nCloses Xchange-Taiwan/X-Talent-Tracker#312';

beforeEach(() => {
  execFileSync.mockReset();
});

describe('attemptAutoPr', () => {
  it('skips entirely when nothing is staged', async () => {
    mockCalls({ 'diff --cached --quiet': '' }); // hasStagedChanges -> false

    const result = await attemptAutoPr({
      ticket,
      resolvedBaseRef: RESOLVED_BASE_REF,
    });

    expect(result).toEqual({ created: false });
    expect(execFileSync).toHaveBeenCalledTimes(1); // only the staged-changes check
  });

  it('falls back when an open PR already exists for the branch', async () => {
    mockCalls({
      'diff --cached --quiet': failure(), // hasStagedChanges -> true
      'pr list --head feat/312-test-branch --state open --json url':
        '[{"url":"https://github.com/Xchange-Taiwan/X-Talent-Frontend/pull/1"}]',
    });

    const result = await attemptAutoPr({
      ticket,
      resolvedBaseRef: RESOLVED_BASE_REF,
    });

    expect(result).toEqual({ created: false });
  });

  it('falls back without committing when checking for an existing PR fails', async () => {
    mockCalls({
      'diff --cached --quiet': failure(),
      'pr list --head feat/312-test-branch --state open --json url':
        failure('not authenticated'),
    });

    const result = await attemptAutoPr({
      ticket,
      resolvedBaseRef: RESOLVED_BASE_REF,
    });

    expect(result).toEqual({ created: false });
  });

  it('falls back without pushing when the commit itself fails', async () => {
    mockCalls({
      'diff --cached --quiet': failure(),
      'pr list --head feat/312-test-branch --state open --json url': '[]',
      'commit -m feat: ai:dev: auto create PR': failure(
        'pre-commit hook rejected'
      ),
    });

    const result = await attemptAutoPr({
      ticket,
      resolvedBaseRef: RESOLVED_BASE_REF,
    });

    expect(result).toEqual({ created: false });
    const calledArgs = execFileSync.mock.calls.map(([, args]) =>
      args.join(' ')
    );
    expect(calledArgs).not.toContain(expect.stringContaining('push -u origin'));
  });

  it('rolls back the local commit (resetSoft to resolvedBaseRef) when push fails', async () => {
    mockCalls({
      'diff --cached --quiet': failure(),
      'pr list --head feat/312-test-branch --state open --json url': '[]',
      'commit -m feat: ai:dev: auto create PR': '',
      'push -u origin feat/312-test-branch': failure('rejected'),
      [`reset --soft ${RESOLVED_BASE_REF}`]: '',
    });

    const result = await attemptAutoPr({
      ticket,
      resolvedBaseRef: RESOLVED_BASE_REF,
    });

    expect(result).toEqual({ created: false });
    expect(execFileSync).toHaveBeenCalledWith(
      'git',
      ['reset', '--soft', RESOLVED_BASE_REF],
      expect.anything()
    );
  });

  it('does NOT roll back when push succeeds but gh pr create fails, and reports pushed:true', async () => {
    mockCalls({
      'diff --cached --quiet': failure(),
      'pr list --head feat/312-test-branch --state open --json url': '[]',
      'commit -m feat: ai:dev: auto create PR': '',
      'push -u origin feat/312-test-branch': '',
      [PR_CREATE_KEY]: failure('a pull request for this branch already exists'),
    });

    const result = await attemptAutoPr({
      ticket,
      resolvedBaseRef: RESOLVED_BASE_REF,
    });

    expect(result).toEqual({ created: false, pushed: true });
    const calledArgs = execFileSync.mock.calls.map(([, args]) =>
      args.join(' ')
    );
    expect(calledArgs).not.toContain(`reset --soft ${RESOLVED_BASE_REF}`);
  });

  it('returns created:true and pushed:true on full success', async () => {
    mockCalls({
      'diff --cached --quiet': failure(),
      'pr list --head feat/312-test-branch --state open --json url': '[]',
      'commit -m feat: ai:dev: auto create PR': '',
      'push -u origin feat/312-test-branch': '',
      [PR_CREATE_KEY]:
        'https://github.com/Xchange-Taiwan/X-Talent-Frontend/pull/999\n',
    });

    const result = await attemptAutoPr({
      ticket,
      resolvedBaseRef: RESOLVED_BASE_REF,
    });

    expect(result).toEqual({
      created: true,
      pushed: true,
      url: 'https://github.com/Xchange-Taiwan/X-Talent-Frontend/pull/999',
    });
  });
});
