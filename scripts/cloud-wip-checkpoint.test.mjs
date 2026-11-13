// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  WIP_CHECKPOINT_TAG,
  isInternalCloudPath,
  parsePorcelainZPaths,
  prepareWipResumeBranch,
  saveWipCheckpoint,
  verifyPhase1Outcome,
} from './cloud-wip-checkpoint.mjs';

describe('cloud-wip-checkpoint', () => {
  it('filters secret env and lock files while keeping templates', () => {
    expect(isInternalCloudPath('.env')).toBe(true);
    expect(isInternalCloudPath('.env.development.local')).toBe(true);
    expect(isInternalCloudPath('.env.e2e.local')).toBe(true);
    expect(isInternalCloudPath('apps/web/.env.local')).toBe(true);
    expect(isInternalCloudPath('.agents/tmp/ticket-spec.md')).toBe(true);
    expect(isInternalCloudPath('.gitignore')).toBe(true);
    expect(isInternalCloudPath('.gemini/settings.json')).toBe(true);
    expect(isInternalCloudPath('.env.example')).toBe(false);
    expect(isInternalCloudPath('src/lib/apiClient.ts')).toBe(false);
  });

  it('parses NUL-delimited porcelain output and renames accurately', () => {
    const raw = [
      ' M src/types/reservationFeedback.ts',
      '?? .env.development.local',
      '?? .agents/tmp/ticket-spec.md',
      'R  src/newName.ts',
      'src/oldName.ts',
      'A  e2e/tests/reservation/reservation-feedback.spec.ts',
      '',
    ].join('\0');

    expect(parsePorcelainZPaths(raw)).toEqual([
      'src/types/reservationFeedback.ts',
      'src/newName.ts',
      'e2e/tests/reservation/reservation-feedback.spec.ts',
    ]);
  });

  it('hands off to Phase 2 when Phase 1 soft-times out with edits', () => {
    const execGit = vi.fn((_bin, args) => {
      if (args[0] === 'status') {
        return ' M src/schemas/meetingFeedbackSchema.ts\0?? .env.e2e.local\0';
      }
      return '';
    });

    const outcome = verifyPhase1Outcome({ exitCode: 124, execGit });
    expect(outcome.proceedToPhase2).toBe(true);
    expect(outcome.handedOffAfterNonZero).toBe(true);
    expect(outcome.changedCount).toBe(1);
    expect(outcome.allChangedPaths).toEqual([
      'src/schemas/meetingFeedbackSchema.ts',
    ]);
  });

  it('aborts before Phase 2 when Phase 1 fails with 0 real changes', () => {
    const execGit = vi.fn((_bin, args) => {
      if (args[0] === 'status') {
        return '?? .env.development.local\0 M .gitignore\0';
      }
      return '';
    });

    const outcome = verifyPhase1Outcome({ exitCode: 124, execGit });
    expect(outcome.proceedToPhase2).toBe(false);
    expect(outcome.handedOffAfterNonZero).toBe(false);
    expect(outcome.changedCount).toBe(0);
  });

  it('prepares valid WIP branch and ignores closed-PR branches', () => {
    const calls = [];
    const execGh = vi.fn(() => '[]');
    const oldRef = 'refs/remotes/origin/feat/874-old-closed-pr';
    const wipRef = 'refs/remotes/origin/feat/874-wip-contract';
    const execGit = vi.fn((_bin, args) => {
      calls.push(args.join(' '));
      if (args[0] === 'ls-remote') {
        return [
          'aaa111\trefs/heads/feat/874-old-closed-pr',
          'bbb222\trefs/heads/feat/874-wip-contract',
        ].join('\n');
      }
      if (args[0] === 'log' && args.includes(oldRef)) {
        return 'feat(reservation): old closed PR commit\n';
      }
      if (args[0] === 'log' && args.includes(wipRef)) {
        return `chore(wip): checkpoint #874 ${WIP_CHECKPOINT_TAG}\n`;
      }
      if (args[0] === 'rev-list') {
        return '1\n';
      }
      return '';
    });

    const resumed = prepareWipResumeBranch({
      ticketNumber: '874',
      execGit,
      execGh,
    });

    expect(resumed).toBe('feat/874-wip-contract');
    expect(
      calls.some((c) => c.includes('checkout -B feat/874-wip-contract'))
    ).toBe(true);
    expect(
      calls.some((c) => c.includes('rebase refs/remotes/origin/develop'))
    ).toBe(true);
  });

  it('aborts rebase and falls back to develop on rebase conflict', () => {
    const calls = [];
    const execGh = vi.fn(() => '[]');
    const execGit = vi.fn((_bin, args) => {
      calls.push(args.join(' '));
      if (args[0] === 'ls-remote') {
        return 'bbb222\trefs/heads/feat/874-wip-conflict\n';
      }
      if (args[0] === 'log') {
        return `chore(wip): checkpoint #874 ${WIP_CHECKPOINT_TAG}\n`;
      }
      if (args[0] === 'rev-list') {
        return '1\n';
      }
      if (args.includes('rebase') && !args.includes('--abort')) {
        throw new Error('CONFLICT (content): Merge conflict');
      }
      return '';
    });

    const resumed = prepareWipResumeBranch({
      ticketNumber: '874',
      execGit,
      execGh,
    });

    expect(resumed).toBe('');
    expect(calls.some((c) => c.includes('rebase --abort'))).toBe(true);
    expect(calls.some((c) => c.includes('checkout -f -B develop'))).toBe(true);
  });

  it('saves WIP checkpoint on 0-PR feature branch and strips locks', () => {
    let stagedQueryCount = 0;
    const gitCalls = [];
    const execGh = vi.fn(() => '[]');
    const execBash = vi.fn(() => '');
    const fsImpl = {
      rmSync: vi.fn(),
      existsSync: vi.fn(() => true),
    };
    const execGit = vi.fn((_bin, args) => {
      gitCalls.push(args);
      if (args[0] === 'branch') {
        return 'feat/875-reservation-history-api\n';
      }
      if (args[0] === 'diff' && args[1] === '--cached') {
        stagedQueryCount += 1;
        if (stagedQueryCount === 1) {
          return (
            '.env.development.local\0' +
            'src/app/reservation/history/page.tsx\0'
          );
        }
        return 'src/app/reservation/history/page.tsx\0';
      }
      return '';
    });

    const res = saveWipCheckpoint({
      ticketNumber: '#875',
      fsImpl,
      execGit,
      execGh,
      execBash,
    });

    expect(res.saved).toBe(true);
    expect(res.branch).toBe('feat/875-reservation-history-api');
    expect(
      gitCalls.some(
        (args) =>
          args[0] === 'reset' && args.includes('.env.development.local')
      )
    ).toBe(true);
    expect(
      gitCalls.some(
        (args) =>
          args.includes('commit') &&
          args.some((item) => item.includes(WIP_CHECKPOINT_TAG))
      )
    ).toBe(true);
  });

  it('refuses fail-closed to overwrite an open PR or develop branch', () => {
    const execGitDev = vi.fn(() => 'develop\n');
    expect(
      saveWipCheckpoint({ ticketNumber: '874', execGit: execGitDev }).saved
    ).toBe(false);

    const execGitFeat = vi.fn(() => 'feat/874-contract\n');
    const execGhOpen = vi.fn(() => '[{"number":1258}]');
    const blocked = saveWipCheckpoint({
      ticketNumber: '874',
      execGit: execGitFeat,
      execGh: execGhOpen,
    });
    expect(blocked.saved).toBe(false);
    expect(blocked.reason).toBe('open-pr-exists-or-check-failed');
  });
});
