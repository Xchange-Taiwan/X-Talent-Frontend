// @vitest-environment node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  applyPhase2HeadlessWorkspaceLocks,
  buildRoundFixPrompt,
  clampMaxRounds,
  createSnapshotRestorer,
  createSnapshotSaver,
  detectChangedE2eSpecs,
  ensurePhase2GeminiToolExclusions,
  evaluateRoundConvergence,
  extractJsonObject,
  formatConvergenceSummaryMarkdown,
  isFrontendApplicableCriterion,
  normalizeErrorSignatures,
  parseConvergeArgs,
  runConvergeLoop,
} from './cloud-converge-loop.mjs';

describe('cloud-converge-loop', () => {
  describe('clampMaxRounds & parseConvergeArgs', () => {
    it('defaults to 20 rounds and clamps values between 1 and 20', () => {
      expect(clampMaxRounds(undefined)).toBe(20);
      expect(clampMaxRounds('0')).toBe(20);
      expect(clampMaxRounds('-5')).toBe(20);
      expect(clampMaxRounds('12')).toBe(12);
      expect(clampMaxRounds('50')).toBe(20);
    });

    it('parses CLI flags and environment variables accurately', () => {
      const parsed = parseConvergeArgs(
        ['--max-rounds=15', '--ticket=#822', '--run-e2e=true'],
        { GEMINI_MODEL: 'gemini-4-carbon' }
      );
      expect(parsed).toEqual({
        maxRounds: 15,
        ticketNumber: '822',
        runE2e: true,
        runAiReview: true,
        requireUiEvidence: false,
        baseRef: 'origin/develop',
        summaryOut: '.agents/tmp/cloud-converge-summary.md',
        geminiModel: 'gemini-4-carbon',
      });
    });

    it('allows disabling E2E via --run-e2e=false', () => {
      const parsed = parseConvergeArgs(['--run-e2e=false'], {});
      expect(parsed.runE2e).toBe(false);
    });
  });

  describe('extractJsonObject', () => {
    it('extracts valid JSON even when preceded by dotenv or CLI log lines', () => {
      const noisyOutput = [
        '[dotenv@17.2.0] injecting env (8) from .env.development.local',
        JSON.stringify({
          mode: 'gemini-local',
          overallRisk: { level: 'low', reason: 'Clean' },
          requirementCoverage: [],
          findings: {},
        }),
      ].join('\n');

      const parsed = extractJsonObject(noisyOutput);
      expect(parsed?.overallRisk?.level).toBe('low');
      expect(parsed?.mode).toBe('gemini-local');
    });
  });

  describe('detectChangedE2eSpecs', () => {
    it('identifies changed E2E spec files and separates mock, readonly, and onboarding specs', () => {
      const files = [
        'src/components/Header.tsx',
        'e2e/tests/reservation/reservation-mentee.spec.ts',
        'e2e/tests/reservation/reservation-create.spec.ts',
        'e2e/tests/onboarding/onboarding.spec.ts',
        'e2e/tests/canary/booking.spec.ts',
      ];
      const result = detectChangedE2eSpecs(files);
      expect(result.allChangedSpecs).toEqual([
        'e2e/tests/reservation/reservation-mentee.spec.ts',
        'e2e/tests/reservation/reservation-create.spec.ts',
        'e2e/tests/onboarding/onboarding.spec.ts',
      ]);
      expect(result.changedMockSpecs).toEqual([
        'e2e/tests/reservation/reservation-mentee.spec.ts',
      ]);
      expect(result.changedReadonlySpecs).toEqual([
        'e2e/tests/reservation/reservation-create.spec.ts',
      ]);
      expect(result.extraNonMockSpecs).toEqual([
        'e2e/tests/onboarding/onboarding.spec.ts',
      ]);
      expect(result.hasAppCodeChanges).toBe(true);
      expect(result.hasSharedE2eChanges).toBe(false);
    });

    it('detects pure E2E diffs without app code changes', () => {
      const files = [
        'e2e/tests/public/signup.spec.ts',
        'e2e/tests/reservation/reservation-create.spec.ts',
      ];
      const result = detectChangedE2eSpecs(files);
      expect(result.hasAppCodeChanges).toBe(false);
      expect(result.changedMockSpecs).toEqual([
        'e2e/tests/public/signup.spec.ts',
      ]);
      expect(result.changedReadonlySpecs).toEqual([
        'e2e/tests/reservation/reservation-create.spec.ts',
      ]);
    });

    it('ignores unit test and Storybook files when checking hasAppCodeChanges', () => {
      const result = detectChangedE2eSpecs([
        'src/components/Header.stories.tsx',
        'src/components/Header.test.tsx',
      ]);
      expect(result.hasAppCodeChanges).toBe(false);
      expect(result.allChangedSpecs).toEqual([]);
    });

    it('treats shared E2E helpers or playwright.config.ts changes as full-suite triggers', () => {
      expect(
        detectChangedE2eSpecs([
          'e2e/helpers/route.ts',
          'e2e/tests/public/signup.spec.ts',
        ]).hasAppCodeChanges
      ).toBe(true);
      expect(
        detectChangedE2eSpecs([
          'playwright.config.ts',
          'e2e/tests/public/signup.spec.ts',
        ]).hasSharedE2eChanges
      ).toBe(true);
    });
  });

  describe('evaluateRoundConvergence', () => {
    it('returns converged=true when deterministic, E2E, and low-risk 0-finding AI review all pass', () => {
      const evalRes = evaluateRoundConvergence({
        deterministicPassed: true,
        e2ePassed: true,
        reviewResult: {
          overallRisk: { level: 'low', reason: 'All clean' },
          requirementCoverage: [{ criterion: 'AC 1', covered: true }],
          findings: {
            security: [],
            correctness: [],
            businessLogic: [],
            performance: [],
            testing: [],
            architecture: [],
          },
        },
      });
      expect(evalRes.converged).toBe(true);
      expect(evalRes.totalFindings).toBe(0);
      expect(evalRes.uncoveredCriteria).toHaveLength(0);
    });

    it('returns converged=false when findings or uncovered criteria exist', () => {
      const evalRes = evaluateRoundConvergence({
        deterministicPassed: true,
        e2ePassed: true,
        reviewResult: {
          overallRisk: { level: 'medium', reason: 'Missing edge case' },
          requirementCoverage: [
            { criterion: 'AC 1', covered: false, note: 'Not handled' },
          ],
          findings: {
            correctness: [
              {
                file: 'src/a.ts',
                line: 10,
                issue: 'Null deref',
                why: 'Crash on empty',
                fix: 'Use optional chaining',
              },
            ],
          },
        },
      });
      expect(evalRes.converged).toBe(false);
      expect(evalRes.totalFindings).toBe(1);
      expect(evalRes.uncoveredCriteria).toHaveLength(1);
    });

    it('exempts out_of_repo / backend acceptance criteria (#733 & #734 email/cron rules) while still enforcing frontend routing criteria', () => {
      expect(
        isFrontendApplicableCriterion({
          criterion: '會談結束後 15 分鐘內，mentee 收到站內通知與 email',
          scope: 'out_of_repo',
          covered: false,
        })
      ).toBe(false);

      // Even if LLM omitted scope, pure backend email/cron/dedup ACs are auto-exempted
      expect(
        isFrontendApplicableCriterion({
          criterion: '會談結束後 15 分鐘內，mentee 收到站內通知與 email',
          covered: false,
        })
      ).toBe(false);
      expect(
        isFrontendApplicableCriterion({
          criterion: 'Mentee 第一次送出回饋後，mentor 立即收到站內通知與 email',
          covered: false,
        })
      ).toBe(false);
      expect(
        isFrontendApplicableCriterion({
          criterion: '同一場只會收到一次；已填寫、已取消的預約不會收到',
          covered: false,
        })
      ).toBe(false);
      expect(
        isFrontendApplicableCriterion({
          criterion: '編輯不會再通知 mentor',
          covered: false,
        })
      ).toBe(false);
      expect(
        isFrontendApplicableCriterion({
          criterion: '通知發送失敗時，回饋仍正常儲存',
          covered: false,
        })
      ).toBe(false);

      // Mixed or frontend ACs touching click/route/page/modal/login redirect MUST remain enforced!
      expect(
        isFrontendApplicableCriterion({
          criterion:
            '點擊通知或 email 連結，會到歷史紀錄頁並自動開啟該場的回饋彈窗／回答入口',
          covered: false,
        })
      ).toBe(true);
      expect(
        isFrontendApplicableCriterion({
          criterion: '未登入時點擊連結，登入後回到該場',
          covered: false,
        })
      ).toBe(true);
      expect(
        isFrontendApplicableCriterion({
          criterion: '點擊通知或 email 連結，會到 mentor 歷史紀錄的該場卡片',
          covered: false,
        })
      ).toBe(true);

      // Convergence passes when all frontend ACs are covered and only backend ACs are uncovered
      const evalMixedCovered = evaluateRoundConvergence({
        deterministicPassed: true,
        e2ePassed: true,
        reviewResult: {
          overallRisk: { level: 'low', reason: 'Frontend slice complete' },
          requirementCoverage: [
            {
              criterion:
                '點擊通知或 email 連結，會到歷史紀錄頁並自動開啟該場的回饋彈窗／回答入口',
              scope: 'frontend',
              covered: true,
            },
            {
              criterion: '會談結束後 15 分鐘內，mentee 收到站內通知與 email',
              scope: 'out_of_repo',
              covered: false,
              note: '屬後端排程寄信範圍',
            },
            {
              criterion:
                'Mentee 第一次送出回饋後，mentor 立即收到站內通知與 email',
              covered: false,
              note: '後端負責寄送通知信',
            },
          ],
          findings: {},
        },
      });
      expect(evalMixedCovered.converged).toBe(true);
      expect(evalMixedCovered.uncoveredCriteria).toHaveLength(0);
      expect(evalMixedCovered.exemptedCriteria).toHaveLength(2);
    });
  });

  describe('runConvergeLoop', () => {
    it('early-exits on Round 2 after Gemini fixes Round 1 findings and E2E passes', async () => {
      let roundCounter = 0;
      const execStep = vi.fn((cmd, args) => {
        if (cmd === 'node' && args[0]?.includes('run-local.mjs')) {
          roundCounter += 1;
          if (roundCounter === 1) {
            return {
              ok: true,
              stdout: JSON.stringify({
                overallRisk: { level: 'medium', reason: '1 finding' },
                requirementCoverage: [],
                findings: {
                  testing: [
                    {
                      file: 'src/foo.ts',
                      line: 5,
                      issue: 'Missing unit test',
                      why: 'Risk area',
                      fix: 'Add foo.test.ts',
                    },
                  ],
                },
              }),
            };
          }
          return {
            ok: true,
            stdout: JSON.stringify({
              overallRisk: { level: 'low', reason: 'Clean' },
              requirementCoverage: [],
              findings: {},
            }),
          };
        }
        return { ok: true, stdout: '', stderr: '' };
      });
      const writeFile = vi.fn();

      const res = await runConvergeLoop(
        { maxRounds: 20, ticketNumber: '822', runE2e: true },
        { execStep, writeFile, log: () => {} }
      );

      expect(res.converged).toBe(true);
      expect(res.roundsRun).toBe(2);
      expect(writeFile).toHaveBeenCalledTimes(1);
      expect(res.summaryMd).toContain('已完全收斂通過 (Converged)');
      expect(res.summaryMd).toContain('2 / 20 輪');
    });

    it('runs targeted changed mock specs even when src/ app code is modified alongside specs', async () => {
      const executedPnpmCalls = [];
      const execStep = vi.fn((cmd, args) => {
        if (cmd === 'git' && args[0] === 'diff') {
          return {
            ok: true,
            stdout:
              'src/components/layout/Header/NotificationBell.tsx\ne2e/tests/notification/notification-center.spec.ts\n',
            stderr: '',
          };
        }
        if (cmd === 'pnpm') {
          executedPnpmCalls.push(args);
        }
        if (cmd === 'node' && args[0]?.includes('run-local.mjs')) {
          return {
            ok: true,
            stdout: JSON.stringify({
              overallRisk: { level: 'low', reason: 'Clean' },
              requirementCoverage: [],
              findings: {},
            }),
          };
        }
        return { ok: true, stdout: '', stderr: '' };
      });

      const res = await runConvergeLoop(
        { maxRounds: 5, ticketNumber: '858', runE2e: true },
        { execStep, writeFile: () => {}, log: () => {} }
      );

      expect(res.converged).toBe(true);
      expect(executedPnpmCalls).toContainEqual([
        'test:e2e:mock',
        '--workers=4',
        '--retries=1',
        'e2e/tests/notification/notification-center.spec.ts',
      ]);
    });

    it('runs only changed mock and readonly specs when diff is a pure E2E ticket', async () => {
      const executedPnpmCalls = [];
      const execStep = vi.fn((cmd, args) => {
        if (cmd === 'git' && args[0] === 'diff') {
          return {
            ok: true,
            stdout:
              'e2e/tests/public/signup.spec.ts\ne2e/tests/reservation/reservation-create.spec.ts\n',
            stderr: '',
          };
        }
        if (cmd === 'pnpm') {
          executedPnpmCalls.push(args);
        }
        if (cmd === 'node' && args[0]?.includes('run-local.mjs')) {
          return {
            ok: true,
            stdout: JSON.stringify({
              overallRisk: { level: 'low', reason: 'Clean' },
              requirementCoverage: [],
              findings: {},
            }),
          };
        }
        return { ok: true, stdout: '', stderr: '' };
      });

      const res = await runConvergeLoop(
        { maxRounds: 5, ticketNumber: '823', runE2e: true },
        { execStep, writeFile: () => {}, log: () => {} }
      );

      expect(res.converged).toBe(true);
      expect(executedPnpmCalls).toContainEqual([
        'test:e2e:mock',
        '--workers=4',
        '--retries=1',
        'e2e/tests/public/signup.spec.ts',
      ]);
      expect(executedPnpmCalls).toContainEqual([
        'playwright',
        'test',
        '--project=chromium-backend-readonly',
        '--retries=1',
        'e2e/tests/reservation/reservation-create.spec.ts',
      ]);
    });

    it('triggers Stall Guard when identical findings repeat across 2 consecutive rounds', async () => {
      const execStep = vi.fn((cmd, args) => {
        if (cmd === 'node' && args[0]?.includes('run-local.mjs')) {
          return {
            ok: true,
            stdout: JSON.stringify({
              overallRisk: { level: 'medium', reason: 'Same issue' },
              requirementCoverage: [],
              findings: {
                architecture: [
                  {
                    file: 'src/bar.ts',
                    line: 12,
                    issue: 'Persistent smell',
                    why: 'Coupling',
                    fix: 'Refactor',
                  },
                ],
              },
            }),
          };
        }
        return { ok: true, stdout: '', stderr: '' };
      });

      const res = await runConvergeLoop(
        { maxRounds: 20, ticketNumber: '822', runE2e: false },
        { execStep, writeFile: () => {}, log: () => {} }
      );

      expect(res.converged).toBe(false);
      expect(res.stalled).toBe(true);
      expect(res.roundsRun).toBe(2);
    });

    it('formats fix prompts and markdown summaries accurately', () => {
      const evalRes = evaluateRoundConvergence({
        deterministicPassed: false,
        e2ePassed: false,
        reviewResult: {
          overallRisk: { level: 'high', reason: 'Security issue' },
          requirementCoverage: [],
          findings: {
            security: [
              {
                file: 'src/sec.ts',
                line: 1,
                issue: 'PII log',
                why: 'Leaks email',
                fix: 'Mask email',
              },
            ],
          },
        },
      });

      const prompt = buildRoundFixPrompt({
        round: 1,
        maxRounds: 20,
        ticketNumber: '822',
        deterministicErrors: ['tsc error'],
        e2eErrors: ['playwright timeout'],
        evaluation: evalRes,
      });

      expect(prompt).toContain('Ticket #822');
      expect(prompt).toContain('tsc error');
      expect(prompt).toContain('playwright timeout');
      expect(prompt).toContain('Mask email');

      const md = formatConvergenceSummaryMarkdown({
        converged: false,
        stalled: true,
        roundsRun: 2,
        maxRounds: 20,
        runE2e: true,
        e2ePassed: false,
        changedSpecs: ['e2e/tests/public/home.spec.ts'],
        evaluation: evalRes,
      });
      expect(md).toContain('Stall Guard');
      expect(md).toContain('src/sec.ts:1');
    });

    it('enforces UI Evidence Gate when requireUiEvidence=true and UI components changed without screenshots', async () => {
      let currentEvidence = [];
      let fixCalled = false;

      const execStep = vi.fn((cmd, args) => {
        if (cmd === 'git' && args[0] === 'diff') {
          return {
            ok: true,
            stdout:
              'src/components/layout/Header/NotificationBell.tsx\ne2e/tests/notification/notification-center.spec.ts\n',
            stderr: '',
          };
        }
        if (cmd === 'npx' && args[0] === 'gemini') {
          fixCalled = true;
          currentEvidence = ['desktop-notification-popover-open.png'];
          return { ok: true, stdout: '', stderr: '' };
        }
        if (cmd === 'node' && args[0]?.includes('run-local.mjs')) {
          return {
            ok: true,
            stdout: JSON.stringify({
              overallRisk: { level: 'low', reason: 'Clean' },
              requirementCoverage: [],
              findings: {},
            }),
          };
        }
        return { ok: true, stdout: '', stderr: '' };
      });

      const res = await runConvergeLoop(
        {
          maxRounds: 5,
          ticketNumber: '858',
          runE2e: true,
          requireUiEvidence: true,
        },
        {
          execStep,
          writeFile: () => {},
          log: () => {},
          clearEvidence: () => {},
          listEvidence: () => currentEvidence,
        }
      );

      expect(fixCalled).toBe(true);
      expect(res.converged).toBe(true);
      expect(res.roundsRun).toBe(2);
    });

    it('converges immediately when overallRisk is low and all tests/E2E/ACs pass even with minor advisory notes', () => {
      const evalRes = evaluateRoundConvergence({
        deterministicPassed: true,
        e2ePassed: true,
        reviewResult: {
          overallRisk: { level: 'low', reason: 'Minor advisory style note' },
          requirementCoverage: [{ criterion: 'AC 1', covered: true }],
          findings: {
            architecture: [
              {
                file: 'src/ui.tsx',
                line: 20,
                issue: 'Optional helper extraction',
                why: 'Readability',
                fix: 'Extract helper if desired',
              },
            ],
          },
        },
      });
      expect(evalRes.converged).toBe(true);
    });

    it('fast-fails static type-check errors without running full unit suite, and restores snapshot on Gemini timeout', async () => {
      let roundNum = 0;
      const restored = [];
      const calls = [];

      const execStep = vi.fn((cmd, args) => {
        calls.push(`${cmd}:${args[0]}`);
        if (cmd === 'git' && args[0] === 'diff') {
          return { ok: true, stdout: 'src/foo.ts\n', stderr: '' };
        }
        if (cmd === 'pnpm' && args[0] === 'type-check') {
          roundNum += 1;
          if (roundNum <= 2) {
            return {
              ok: false,
              stderr: 'TS2322: Type error',
              combined: 'TS2322',
            };
          }
          return { ok: true, stdout: '', stderr: '' };
        }
        if (cmd === 'npx' && args[0] === 'gemini') {
          if (roundNum <= 2) {
            return { ok: false, timedOut: true, stderr: 'Command timed out' };
          }
          return { ok: true, stdout: '', stderr: '' };
        }
        if (cmd === 'node' && args[0]?.includes('run-local.mjs')) {
          return {
            ok: true,
            stdout: JSON.stringify({
              overallRisk: { level: 'low', reason: 'Clean' },
              requirementCoverage: [],
              findings: {},
            }),
          };
        }
        return { ok: true, stdout: '', stderr: '' };
      });

      const res = await runConvergeLoop(
        { maxRounds: 5, ticketNumber: '736', runE2e: false },
        {
          execStep,
          writeFile: () => {},
          log: () => {},
          saveSnapshot: () => 'deadbeef1234',
          restoreSnapshot: (sha) => restored.push(sha),
          fileExists: () => true,
        }
      );

      expect(restored).toEqual(['deadbeef1234']);
      expect(res.converged).toBe(true);
      expect(res.roundsRun).toBe(2);
      // Round 2 used fast `npx:vitest` related check and then ran final `pnpm:test` gate once!
      expect(calls).toContain('npx:vitest');
      expect(calls.filter((c) => c === 'pnpm:test')).toHaveLength(1);
    });

    it('does NOT prematurely trigger Stall Guard on Round 2 when Round 1 fails lint and Round 2 fails vitest', async () => {
      let roundNum = 0;

      const execStep = vi.fn((cmd, args) => {
        if (cmd === 'git' && args[0] === 'diff') {
          return { ok: true, stdout: 'src/lib/analytics.ts\n', stderr: '' };
        }
        if (cmd === 'pnpm' && args[0] === 'lint') {
          roundNum += 1;
          if (roundNum === 1) {
            return {
              ok: false,
              stderr: 'src/lib/analytics.ts:10:5 error Unused var',
              combined: 'src/lib/analytics.ts:10:5 error Unused var',
            };
          }
          return { ok: true, stdout: '', stderr: '' };
        }
        if (cmd === 'npx' && args[0] === 'vitest') {
          if (roundNum === 2) {
            return {
              ok: false,
              stderr:
                'AssertionError: expected 1 to be 2 at src/lib/analytics.test.ts:30:5',
              combined:
                'AssertionError: expected 1 to be 2 at src/lib/analytics.test.ts:30:5',
            };
          }
          return { ok: true, stdout: '', stderr: '' };
        }
        if (cmd === 'node' && args[0]?.includes('run-local.mjs')) {
          return {
            ok: true,
            stdout: JSON.stringify({
              overallRisk: { level: 'low', reason: 'Clean' },
              requirementCoverage: [],
              findings: {},
            }),
          };
        }
        return { ok: true, stdout: '', stderr: '' };
      });

      const res = await runConvergeLoop(
        { maxRounds: 10, ticketNumber: '865', runE2e: false },
        {
          execStep,
          writeFile: () => {},
          log: () => {},
          fileExists: () => true,
        }
      );

      expect(
        normalizeErrorSignatures(['\u001b[31mError in 42ms\u001b[39m'])
      ).toEqual(['Error in <time>']);
      expect(res.stalled).toBe(false);
      expect(res.converged).toBe(true);
      expect(res.roundsRun).toBe(3);
    });
    it('allows 2 fix retries (stallThreshold = 3) before triggering Stall Guard when identical test/E2E errors repeat with varying timestamps', async () => {
      let roundIdx = 0;
      const execStep = vi.fn((cmd, args) => {
        if (cmd === 'git' && args[0] === 'diff') {
          return { ok: true, stdout: 'src/lib/analytics.ts\n', stderr: '' };
        }
        if (cmd === 'npx' && args[0] === 'vitest') {
          roundIdx += 1;
          const ts = `2026-11-12T01:0${roundIdx}:00.123Z`;
          const dur = `${roundIdx * 35}ms`;
          const out = `${ts}\nAssertionError: expected 1 to be 2 at src/lib/analytics.test.ts:30:5\nDuration ${dur}`;
          return { ok: false, stderr: out, combined: out };
        }
        return { ok: true, stdout: '', stderr: '' };
      });

      const res = await runConvergeLoop(
        { maxRounds: 10, ticketNumber: '865', runE2e: false },
        {
          execStep,
          writeFile: () => {},
          log: () => {},
          fileExists: () => true,
        }
      );

      expect(
        normalizeErrorSignatures([
          '2026-11-12T01:01:00.123Z\nPlain custom failure text in 1.5s',
        ])
      ).toEqual(['Plain custom failure text in <time>']);
      expect(res.converged).toBe(false);
      expect(res.stalled).toBe(true);
      expect(res.roundsRun).toBe(3);
    });

    it('excludes run_shell_command in Phase 2 settings and exits cleanly on soft wall-clock budget so Phase 3 can open PR', async () => {
      let savedJson = '';
      const updated = ensurePhase2GeminiToolExclusions(
        '.gemini/settings.json',
        {
          existsSync: () => true,
          readFileSync: () =>
            JSON.stringify({
              model: { name: 'gemini-4-carbon' },
              tools: { exclude: ['web_fetch'] },
            }),
          writeFileSync: (_p, content) => {
            savedJson = content;
          },
        }
      );
      expect(updated).toBe(true);
      expect(JSON.parse(savedJson).tools.exclude).toEqual([
        'web_fetch',
        'run_shell_command',
        'google_web_search',
      ]);

      let clockMs = 1000;
      let geminiInvocations = 0;
      const execStep = vi.fn((cmd, args) => {
        if (cmd === 'git' && args[0] === 'diff') {
          return { ok: true, stdout: 'src/a.ts\n', stderr: '' };
        }
        if (cmd === 'pnpm' && args[0] === 'lint') {
          clockMs += 40 * 60 * 1000;
          return {
            ok: false,
            stderr: `lint error at ${clockMs}`,
            combined: `lint error at ${clockMs}`,
          };
        }
        if (cmd === 'npx' && args[0] === 'gemini') {
          geminiInvocations += 1;
        }
        return { ok: true, stdout: '', stderr: '' };
      });

      const res = await runConvergeLoop(
        {
          maxRounds: 20,
          ticketNumber: '733',
          runE2e: false,
          maxDurationMs: 70 * 60 * 1000,
        },
        {
          execStep,
          writeFile: () => {},
          log: () => {},
          fileExists: () => true,
          now: () => clockMs,
        }
      );

      expect(geminiInvocations).toBe(1);
      expect(res.converged).toBe(false);
      expect(res.stalled).toBe(false);
      expect(res.roundsRun).toBe(2);
    });
    it('defensively handles missing, null, malformed, and tool-less settings.json files and CONVERGE_MAX_DURATION_MS fallbacks', async () => {
      expect(
        ensurePhase2GeminiToolExclusions('missing.json', {
          existsSync: () => false,
        })
      ).toBe(false);
      expect(
        ensurePhase2GeminiToolExclusions('null.json', {
          existsSync: () => true,
          readFileSync: () => 'null',
        })
      ).toBe(false);
      expect(
        ensurePhase2GeminiToolExclusions('bad.json', {
          existsSync: () => true,
          readFileSync: () => '{broken',
        })
      ).toBe(false);

      let written = '';
      expect(
        ensurePhase2GeminiToolExclusions('bare.json', {
          existsSync: () => true,
          readFileSync: () =>
            JSON.stringify({
              model: { name: 'gemini-4-carbon' },
              mcpServers: { genable: {} },
              hooks: { AfterAgent: [] },
            }),
          writeFileSync: (_p, c) => {
            written = c;
          },
        })
      ).toBe(true);
      const parsedBare = JSON.parse(written);
      expect(parsedBare.mcpServers).toBeUndefined();
      expect(parsedBare.hooks).toBeUndefined();
      expect(parsedBare.tools.exclude).toEqual([
        'run_shell_command',
        'web_fetch',
        'google_web_search',
      ]);
      expect(parsedBare.fileFiltering.respectGitIgnore).toBe(true);

      // Verify CONVERGE_MAX_DURATION_MS env parsing & invalid fallback
      const prevEnv = process.env.CONVERGE_MAX_DURATION_MS;
      try {
        process.env.CONVERGE_MAX_DURATION_MS = '120000';
        let clock = 0;
        const resEnv = await runConvergeLoop(
          { maxRounds: 10, ticketNumber: '733', runE2e: false },
          {
            execStep: (cmd, args) => {
              if (cmd === 'git' && args[0] === 'diff') {
                return { ok: true, stdout: 'src/a.ts\n', stderr: '' };
              }
              if (cmd === 'pnpm' && args[0] === 'lint') {
                clock += 130000;
                return {
                  ok: false,
                  stderr: `err ${clock}`,
                  combined: `err ${clock}`,
                };
              }
              return { ok: true, stdout: '', stderr: '' };
            },
            writeFile: () => {},
            log: () => {},
            fileExists: () => true,
            now: () => clock,
          }
        );
        expect(resEnv.roundsRun).toBe(1);

        for (const invalidVal of ['0', '-5', 'invalid']) {
          process.env.CONVERGE_MAX_DURATION_MS = invalidVal;
          let fallbackClock = 0;
          const resFallback = await runConvergeLoop(
            { maxRounds: 10, ticketNumber: '733', runE2e: false },
            {
              execStep: (cmd, args) => {
                if (cmd === 'git' && args[0] === 'diff') {
                  return { ok: true, stdout: 'src/a.ts\n', stderr: '' };
                }
                if (cmd === 'pnpm' && args[0] === 'lint') {
                  fallbackClock += 40 * 60 * 1000;
                  return {
                    ok: false,
                    stderr: `err ${fallbackClock}`,
                    combined: `err ${fallbackClock}`,
                  };
                }
                return { ok: true, stdout: '', stderr: '' };
              },
              writeFile: () => {},
              log: () => {},
              fileExists: () => true,
              now: () => fallbackClock,
            }
          );
          expect(resFallback.roundsRun).toBe(2);
        }
      } finally {
        if (prevEnv === undefined) {
          delete process.env.CONVERGE_MAX_DURATION_MS;
        } else {
          process.env.CONVERGE_MAX_DURATION_MS = prevEnv;
        }
      }
    });

    it('preserves Phase 2 tool exclusions and --skip-worktree across real Git snapshot rollbacks', () => {
      const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'converge-snap-'));
      try {
        try {
          execFileSync('git', ['init'], { cwd: tmpRepo, stdio: 'ignore' });
        } catch {
          // Restricted local Windows sandbox blocks git.exe mkdir; covered by Linux CI & mocked unit test below
          return;
        }
        execFileSync('git', ['config', 'user.email', 'test@example.com'], {
          cwd: tmpRepo,
          stdio: 'ignore',
        });
        execFileSync('git', ['config', 'user.name', 'Test'], {
          cwd: tmpRepo,
          stdio: 'ignore',
        });

        fs.mkdirSync(path.join(tmpRepo, '.gemini'), { recursive: true });
        fs.mkdirSync(path.join(tmpRepo, 'src'), { recursive: true });
        fs.writeFileSync(
          path.join(tmpRepo, '.gitignore'),
          'node_modules/\n/.agents/tmp/\n',
          'utf8'
        );
        fs.writeFileSync(
          path.join(tmpRepo, '.gemini', 'settings.json'),
          JSON.stringify({
            model: { name: 'gemini-4-carbon' },
            mcpServers: { genable: { command: 'npx' } },
          }),
          'utf8'
        );
        fs.writeFileSync(
          path.join(tmpRepo, 'src', 'app.ts'),
          'export const x = 1;\n',
          'utf8'
        );

        execFileSync('git', ['add', '-A'], { cwd: tmpRepo, stdio: 'ignore' });
        execFileSync('git', ['commit', '-m', 'init'], {
          cwd: tmpRepo,
          stdio: 'ignore',
        });

        applyPhase2HeadlessWorkspaceLocks({ cwd: tmpRepo });

        const treeSha = execFileSync('git', ['write-tree'], {
          cwd: tmpRepo,
          encoding: 'utf8',
        }).trim();

        // Simulate broken timed-out edits to tracked HEAD file + untracked file
        fs.writeFileSync(
          path.join(tmpRepo, 'src', 'app.ts'),
          'BROKEN SYNTAX {{{',
          'utf8'
        );
        fs.writeFileSync(
          path.join(tmpRepo, 'src', 'stray.ts'),
          'broken',
          'utf8'
        );

        const restore = createSnapshotRestorer({ cwd: tmpRepo });
        restore(treeSha);

        expect(
          fs.readFileSync(path.join(tmpRepo, 'src', 'app.ts'), 'utf8')
        ).toBe('export const x = 1;\n');
        expect(fs.existsSync(path.join(tmpRepo, 'src', 'stray.ts'))).toBe(
          false
        );

        const restoredSettings = JSON.parse(
          fs.readFileSync(
            path.join(tmpRepo, '.gemini', 'settings.json'),
            'utf8'
          )
        );
        expect(restoredSettings.mcpServers).toBeUndefined();
        expect(restoredSettings.tools.exclude).toEqual([
          'run_shell_command',
          'web_fetch',
          'google_web_search',
        ]);
        expect(
          fs.readFileSync(path.join(tmpRepo, '.gitignore'), 'utf8')
        ).not.toContain('/.agents/tmp/');

        const statusOut = execFileSync('git', ['status', '--porcelain'], {
          cwd: tmpRepo,
          encoding: 'utf8',
        }).trim();
        expect(statusOut).toBe('');
      } finally {
        fs.rmSync(tmpRepo, { recursive: true, force: true });
      }
    });

    it('supports fast 0-AI-Review funnel mode (--run-ai-review=false) converging immediately once lint, tests, and E2E pass', async () => {
      const parsedFast = parseConvergeArgs(
        ['--max-rounds=3', '--ticket=740', '--run-e2e=true', '--run-ai-review=false'],
        {}
      );
      expect(parsedFast.runAiReview).toBe(false);
      expect(parsedFast.maxRounds).toBe(3);

      const calls = [];
      const execStep = vi.fn((cmd, args) => {
        calls.push(`${cmd} ${args.join(' ')}`);
        if (cmd === 'git' && args[0] === 'diff') {
          return { ok: true, stdout: 'src/components/Foo.tsx\ne2e/tests/public/foo.spec.ts\n', stderr: '' };
        }
        return { ok: true, stdout: '', stderr: '' };
      });

      const res = await runConvergeLoop(
        {
          maxRounds: 3,
          ticketNumber: '740',
          runE2e: true,
          runAiReview: false,
          requireUiEvidence: true,
        },
        {
          execStep,
          writeFile: () => {},
          log: () => {},
          fileExists: () => true,
          clearEvidence: () => {},
          listEvidence: () => ['0-desktop-foo.png'],
        }
      );

      expect(res.converged).toBe(true);
      expect(res.roundsRun).toBe(1);
      expect(calls.some((c) => c.includes('run-local.mjs'))).toBe(false);
      expect(calls.some((c) => c.includes('pnpm test'))).toBe(true);
    });

    it('fails closed when run-local.mjs crashes or returns fallback-ci, and restores best passing snapshot if a later round regresses', async () => {
      let roundNum = 0;
      const restoredShas = [];
      const execStep = vi.fn((cmd, args) => {
        if (cmd === 'git' && args[0] === 'diff') {
          roundNum += 1;
          return { ok: true, stdout: 'src/a.ts\n', stderr: '' };
        }
        if (cmd === 'pnpm' && args[0] === 'type-check') {
          // Round 1 compiles cleanly; Round 2 breaks compilation!
          return roundNum === 1
            ? { ok: true, stdout: '', stderr: '' }
            : { ok: false, stderr: 'TS2322 broken in round 2', combined: 'TS2322 broken in round 2' };
        }
        if (cmd === 'node' && String(args[0]).includes('run-local.mjs')) {
          // Simulate silent API failure returning fallback-ci (must NOT falsely converge!)
          return {
            ok: true,
            stdout: JSON.stringify({
              mode: 'fallback-ci',
              overallRisk: { level: 'low', reason: 'Deferred' },
              requirementCoverage: [],
              findings: {},
            }),
            stderr: '',
          };
        }
        return { ok: true, stdout: '', stderr: '' };
      });

      const res = await runConvergeLoop(
        { maxRounds: 2, ticketNumber: '740', runE2e: false, runAiReview: true },
        {
          execStep,
          writeFile: () => {},
          log: () => {},
          fileExists: () => true,
          saveSnapshot: () => `tree-round-${roundNum}`,
          restoreSnapshot: (sha) => restoredShas.push(sha),
        }
      );

      expect(res.converged).toBe(false);
      expect(res.roundsRun).toBe(2);
      expect(restoredShas).toContain('tree-round-1');
    });

    it('preserves Phase 2 working-tree locks (.gitignore and .gemini/settings.json) when createSnapshotSaver runs', () => {
      const tmpRepo = fs.mkdtempSync(
        path.join(os.tmpdir(), 'converge-real-snap-')
      );
      try {
        fs.mkdirSync(path.join(tmpRepo, '.gemini'), { recursive: true });
        fs.writeFileSync(
          path.join(tmpRepo, '.gitignore'),
          'node_modules/\n/.agents/tmp/\n',
          'utf8'
        );
        fs.writeFileSync(
          path.join(tmpRepo, '.gemini', 'settings.json'),
          JSON.stringify({ model: { name: 'gemini-4-carbon' } }),
          'utf8'
        );

        const gitCmds = [];
        const mockExecGit = vi.fn((_bin, args) => {
          gitCmds.push(args.join(' '));
          if (args[0] === 'reset' && args[2] === '.env*') {
            throw new Error('pathspec .env* did not match any files');
          }
          if (args[0] === 'write-tree') return 'deadbeef1234\n';
          return '';
        });

        applyPhase2HeadlessWorkspaceLocks({
          cwd: tmpRepo,
          execGit: mockExecGit,
        });
        const save = createSnapshotSaver({
          cwd: tmpRepo,
          execGit: mockExecGit,
        });
        const sha = save();

        expect(sha).toBe('deadbeef1234');
        expect(gitCmds.some((c) => c.startsWith('checkout '))).toBe(false);
        expect(gitCmds).toContain('reset -- .gitignore');
        expect(gitCmds).toContain('reset -- .gemini/settings.json');

        const gitignoreAfter = fs.readFileSync(
          path.join(tmpRepo, '.gitignore'),
          'utf8'
        );
        const settingsAfter = JSON.parse(
          fs.readFileSync(
            path.join(tmpRepo, '.gemini', 'settings.json'),
            'utf8'
          )
        );
        expect(gitignoreAfter).not.toContain('/.agents/tmp/');
        expect(settingsAfter.context.fileFiltering.respectGitIgnore).toBe(true);
        expect(settingsAfter.tools.exclude).toContain('run_shell_command');
      } finally {
        fs.rmSync(tmpRepo, { recursive: true, force: true });
      }
    });
  });
});
