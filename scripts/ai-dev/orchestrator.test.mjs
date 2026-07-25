// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

const { execFileSync } = await import('node:child_process');
const { attemptAutoPr, buildRetryTask, isQaBlocking } =
  await import('./orchestrator.mjs');

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

  it('posts the QA report as a PR comment after a full success when qa.reportMarkdown is present', async () => {
    mockCalls({
      'diff --cached --quiet': failure(),
      'pr list --head feat/312-test-branch --state open --json url': '[]',
      'commit -m feat: ai:dev: auto create PR': '',
      'push -u origin feat/312-test-branch': '',
      [PR_CREATE_KEY]:
        'https://github.com/Xchange-Taiwan/X-Talent-Frontend/pull/999\n',
      'pr comment feat/312-test-branch --body ## QA report': '',
    });

    const result = await attemptAutoPr({
      ticket,
      resolvedBaseRef: RESOLVED_BASE_REF,
      qa: { reportMarkdown: '## QA report' },
    });

    expect(result.created).toBe(true);
    const calledArgs = execFileSync.mock.calls.map(([, args]) =>
      args.join(' ')
    );
    expect(calledArgs).toContain(
      'pr comment feat/312-test-branch --body ## QA report'
    );
  });

  it('still reports created:true even when posting the QA comment fails', async () => {
    mockCalls({
      'diff --cached --quiet': failure(),
      'pr list --head feat/312-test-branch --state open --json url': '[]',
      'commit -m feat: ai:dev: auto create PR': '',
      'push -u origin feat/312-test-branch': '',
      [PR_CREATE_KEY]:
        'https://github.com/Xchange-Taiwan/X-Talent-Frontend/pull/999\n',
      'pr comment feat/312-test-branch --body ## QA report':
        failure('comment failed'),
    });

    const result = await attemptAutoPr({
      ticket,
      resolvedBaseRef: RESOLVED_BASE_REF,
      qa: { reportMarkdown: '## QA report' },
    });

    expect(result).toEqual({
      created: true,
      pushed: true,
      url: 'https://github.com/Xchange-Taiwan/X-Talent-Frontend/pull/999',
    });
  });

  it('never attempts to comment when qa is absent', async () => {
    mockCalls({
      'diff --cached --quiet': failure(),
      'pr list --head feat/312-test-branch --state open --json url': '[]',
      'commit -m feat: ai:dev: auto create PR': '',
      'push -u origin feat/312-test-branch': '',
      [PR_CREATE_KEY]:
        'https://github.com/Xchange-Taiwan/X-Talent-Frontend/pull/999\n',
    });

    // mockCalls throws on any unregistered invocation — a stray `pr comment`
    // call here would fail the test even without an explicit assertion.
    const result = await attemptAutoPr({
      ticket,
      resolvedBaseRef: RESOLVED_BASE_REF,
    });

    expect(result.created).toBe(true);
  });
});

describe('buildRetryTask', () => {
  const DIFF_KEY = `diff ${RESOLVED_BASE_REF}...HEAD -- . :(exclude)pnpm-lock.yaml :(exclude)package-lock.json :(exclude)yarn.lock :(exclude)*.snap :(exclude)public/**`;

  it('includes a QA findings section when qaFindings is provided', () => {
    mockCalls({ [DIFF_KEY]: 'diff --git a/x b/x' });

    const task = buildRetryTask({
      baseRef: RESOLVED_BASE_REF,
      failureText: null,
      reviewFindings: null,
      qaFindings: [{ file: '/jobs/1', issue: '沒有出現成功訊息' }],
    });

    expect(task).toContain('## QA Agent 執行失敗的情境（需要修正）');
    expect(task).toContain('沒有出現成功訊息');
  });

  it('omits the QA findings section when qaFindings is not provided', () => {
    mockCalls({ [DIFF_KEY]: 'diff --git a/x b/x' });

    const task = buildRetryTask({
      baseRef: RESOLVED_BASE_REF,
      failureText: null,
      reviewFindings: null,
      qaFindings: null,
    });

    expect(task).not.toContain('QA Agent 執行失敗的情境');
  });
});

describe('isQaBlocking', () => {
  const originalFlag = process.env.AI_QA_BLOCKING;

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.AI_QA_BLOCKING;
    else process.env.AI_QA_BLOCKING = originalFlag;
  });

  it('blocks on a failed QA result when AI_QA_BLOCKING is unset (default)', () => {
    delete process.env.AI_QA_BLOCKING;
    expect(isQaBlocking({ status: 'failed' })).toBe(true);
  });

  it('blocks on a failed QA result when AI_QA_BLOCKING is any value other than "false"', () => {
    process.env.AI_QA_BLOCKING = 'true';
    expect(isQaBlocking({ status: 'failed' })).toBe(true);
  });

  it('does not block on a failed QA result when explicitly opted out via AI_QA_BLOCKING=false', () => {
    process.env.AI_QA_BLOCKING = 'false';
    expect(isQaBlocking({ status: 'failed' })).toBe(false);
  });

  it('never blocks on infra-error, even by default', () => {
    delete process.env.AI_QA_BLOCKING;
    expect(isQaBlocking({ status: 'infra-error' })).toBe(false);
  });

  it('never blocks on not-applicable, even by default', () => {
    delete process.env.AI_QA_BLOCKING;
    expect(isQaBlocking({ status: 'not-applicable' })).toBe(false);
  });

  it('never blocks on skipped, even by default', () => {
    delete process.env.AI_QA_BLOCKING;
    expect(isQaBlocking({ status: 'skipped' })).toBe(false);
  });

  it('never blocks on passed', () => {
    delete process.env.AI_QA_BLOCKING;
    expect(isQaBlocking({ status: 'passed' })).toBe(false);
  });
});
