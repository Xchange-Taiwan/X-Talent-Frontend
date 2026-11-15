// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import {
  buildPhase3CommitMessage,
  inferCommitTypeAndScope,
  parseSubmitPrArgs,
  submitCloudPr,
} from './submit-pr.mjs';

const TAB = String.fromCharCode(9);
const LF = String.fromCharCode(10);

describe('scripts/cloud/submit-pr', () => {
  it('parses CLI flags and infers Conventional Commit type and domain scope accurately', () => {
    expect(
      parseSubmitPrArgs(['fix-pr', '--ticket=#737', '--pr=#512'], {
        CLOUD_PR_DRAFT: 'false',
      })
    ).toEqual({
      mode: 'fix-pr',
      ticketNumber: '737',
      prNumber: '512',
      cloudPrDraft: false,
    });

    expect(
      inferCommitTypeAndScope({
        branch: 'fix/710-carousel',
        rawIssueTitle: '[Bug][FE] Carousel jump',
        stagedFiles: ['src/components/mentor-pool/Card.tsx'],
      })
    ).toEqual({ type: 'fix', scope: 'mentor-pool' });

    expect(
      inferCommitTypeAndScope({
        branch: 'refactor/907-cloud-modules',
        rawIssueTitle: '[Refactor][FE/CI] Deepen Cloud AI modules',
        stagedFiles: ['scripts/cloud/submit-pr.mjs', '.github/workflows/a.yml'],
      })
    ).toEqual({ type: 'refactor', scope: 'ci' });

    const commitMsg = buildPhase3CommitMessage({
      ticket: '737',
      branch: 'feat/737-mentor-card-rating',
      rawIssueTitle: '[Feature][FE] Add mentor card average rating',
      stagedFiles: ['src/components/mentor-pool/Information.tsx'],
      evidenceUrls: [
        'https://raw.githubusercontent.com/Xchange-Taiwan/X-Talent-Frontend/sha/0-desktop.png',
      ],
    });
    expect(commitMsg).toContain(
      'feat(mentor-pool): add mentor card average rating (#737)'
    );
    expect(commitMsg).toContain('Published UI evidence:');
  });

  it('commits scoped changes, synthesizes PR body via injected fetch, and creates a draft PR via CommandPort in implement mode', async () => {
    const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'submit-pr-impl-'));
    try {
      fs.mkdirSync(path.join(tmpRepo, '.agents', 'tmp', 'evidence'), {
        recursive: true,
      });
      fs.writeFileSync(path.join(tmpRepo, '.env.development.local'), 'SEC=1');
      fs.writeFileSync(path.join(tmpRepo, '.env.e2e.local'), 'SEC=2');
      fs.writeFileSync(
        path.join(tmpRepo, '.agents', 'tmp', 'evidence', '0-desktop-pool.png'),
        'png'
      );
      fs.writeFileSync(
        path.join(tmpRepo, '.agents', 'tmp', 'cloud-converge-summary.md'),
        '## Cloud Pre-PR AI Review & E2E Convergence Summary',
        'utf8'
      );
      fs.writeFileSync(
        path.join(tmpRepo, '.agents', 'tmp', 'ticket-bundle.json'),
        JSON.stringify({
          ticketNumber: 737,
          issue: { title: '[Feature] Display average rating on mentor cards' },
          cleanSpecMarkdown: `title:${TAB}[Feature] Display average rating on mentor cards`,
        }),
        'utf8'
      );

      const gitCalls = [];
      const ghCalls = [];
      let committedInput = '';
      let createdPrBody = '';

      const port = {
        git: vi.fn((args, opts = {}) => {
          gitCalls.push(args.join(' '));
          if (args[0] === 'branch' && args[1] === '--show-current') {
            return 'feat/737-mentor-card-rating';
          }
          if (args[0] === 'diff' && args[1] === '--cached') {
            return [
              'src/components/mentor-pool/Information.tsx',
              '.env.example',
            ].join(LF);
          }
          if (args[0] === 'commit') {
            committedInput = opts.input || '';
            return '';
          }
          if (args[0] === 'rev-list') {
            return '2';
          }
          if (args[0] === 'log') {
            return 'feat(mentor-pool): display average rating on mentor cards (#737)';
          }
          if (args[0] === 'diff' && args[1] === '--name-only') {
            return 'src/components/mentor-pool/Information.tsx';
          }
          if (args[0] === 'diff') {
            return '+<span>9.5 / 10</span>';
          }
          return '';
        }),
        gh: vi.fn((args, opts = {}) => {
          ghCalls.push(args.join(' '));
          if (args[0] === 'pr' && args[1] === 'list') {
            return '[]';
          }
          if (args[0] === 'pr' && args[1] === 'create') {
            createdPrBody = opts.input || '';
            return 'https://github.com/Xchange-Taiwan/X-Talent-Frontend/pull/999';
          }
          return '';
        }),
      };

      const mockFetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              finishReason: 'STOP',
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      prTitle:
                        'feat(mentor-pool): display average rating on mentor cards',
                      overview: '實作導師卡片平均分數顯示。',
                      moduleHighlights: [
                        {
                          title: '導師卡片評分區塊',
                          files: ['src/components/mentor-pool/Information.tsx'],
                          details: ['0 則評價時隱藏分數區塊。'],
                        },
                      ],
                      demoRoutes: ['/mentor-pool'],
                      screenshotCaptions: ['桌面版導師池列表'],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      }));

      const verifyBoardSpy = vi.fn();
      const linkBranchSpy = vi.fn();
      const publishEvidenceSpy = vi.fn(async () => ({
        urls: [
          'https://raw.githubusercontent.com/Xchange-Taiwan/X-Talent-Frontend/sha1/0-desktop-pool.png',
        ],
      }));

      const res = await submitCloudPr({
        mode: 'implement',
        ticketNumber: '737',
        cwd: tmpRepo,
        env: { GEMINI_API_KEY: 'test-gemini-key' },
        port,
        fetch: mockFetch,
        linkTicketBranchImpl: linkBranchSpy,
        publishEvidenceImpl: publishEvidenceSpy,
        verifyBoardStatusImpl: verifyBoardSpy,
      });

      expect(res.prAction).toBe('created');
      expect(res.prUrl).toBe(
        'https://github.com/Xchange-Taiwan/X-Talent-Frontend/pull/999'
      );
      expect(res.prTitle).toBe(
        'feat(mentor-pool): display average rating on mentor cards (X-Tracker #737)'
      );
      expect(committedInput).toContain(
        'feat(mentor-pool): display average rating on mentor cards (#737)'
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(createdPrBody).toContain('實作導師卡片平均分數顯示。');
      expect(createdPrBody).toContain('0-desktop-pool.png');
      expect(createdPrBody).toContain(
        '## Cloud Pre-PR AI Review & E2E Convergence Summary'
      );
      expect(
        ghCalls.some((c) => c.startsWith('pr create --draft --base develop'))
      ).toBe(true);
      expect(verifyBoardSpy).toHaveBeenCalledTimes(1);
      expect(fs.existsSync(path.join(tmpRepo, '.env.development.local'))).toBe(
        false
      );
      expect(fs.existsSync(path.join(tmpRepo, '.agents', 'tmp'))).toBe(false);
    } finally {
      fs.rmSync(tmpRepo, { recursive: true, force: true });
    }
  });

  it('upserts existing PR body in fix-pr mode, recovers ticket & screenshot URLs from PR metadata, and rebases on push conflict', async () => {
    const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'submit-pr-fix-'));
    try {
      let pushAttempt = 0;
      let editedBody = '';
      const ghCalls = [];
      const gitCalls = [];

      const existingScreenshot =
        'https://raw.githubusercontent.com/Xchange-Taiwan/X-Talent-Frontend/oldsha/0-desktop-mentor-pool.png';

      const port = {
        git: vi.fn((args) => {
          gitCalls.push(args.join(' '));
          if (args[0] === 'branch' && args[1] === '--show-current') {
            return 'feat/737-mentor-card-rating';
          }
          if (args[0] === 'diff' && args[1] === '--cached') {
            return '';
          }
          if (args[0] === 'push') {
            pushAttempt += 1;
            if (pushAttempt === 1) {
              throw new Error('non-fast-forward');
            }
            return '';
          }
          if (args[0] === 'diff' && args[1] === '--name-only') {
            return 'src/components/mentor-pool/Information.tsx';
          }
          return '';
        }),
        gh: vi.fn((args, opts = {}) => {
          ghCalls.push(args.join(' '));
          if (args[0] === 'pr' && args[1] === 'view') {
            return JSON.stringify({
              title: 'feat(mentor-pool): rating (X-Tracker #737)',
              baseRefName: 'develop',
              body: ['## Screenshot', `![shot](${existingScreenshot})`].join(
                LF
              ),
            });
          }
          if (args[0] === 'pr' && args[1] === 'edit') {
            editedBody = opts.input || '';
            return '';
          }
          return '';
        }),
      };

      const res = await submitCloudPr({
        mode: 'fix-pr',
        prNumber: '512',
        cwd: tmpRepo,
        env: {},
        port,
      });

      expect(res.prAction).toBe('updated');
      expect(res.ticketNumber).toBe('737');
      expect(gitCalls).toContain(
        'pull --rebase origin feat/737-mentor-card-rating'
      );
      expect(ghCalls).toContain('pr edit 512 --body-file -');
      expect(editedBody).toContain(existingScreenshot);
      expect(editedBody).toContain(
        'Ref: https://github.com/Xchange-Taiwan/X-Talent-Tracker/issues/737'
      );
    } finally {
      fs.rmSync(tmpRepo, { recursive: true, force: true });
    }
  });

  it('refuses to submit from protected develop/main branches or open an empty 0-commit PR', async () => {
    const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'submit-pr-guard-'));
    try {
      const developPort = {
        git: vi.fn((args) => (args[0] === 'branch' ? 'develop' : '')),
        gh: vi.fn(() => ''),
      };

      await expect(
        submitCloudPr({
          mode: 'implement',
          cwd: tmpRepo,
          env: {},
          port: developPort,
          linkTicketBranchImpl: () => {},
        })
      ).rejects.toThrow(/Refusing to run Phase 3 directly on branch/);

      const emptyAheadPort = {
        git: vi.fn((args) => {
          if (args[0] === 'branch') return 'feat/737-empty';
          if (args[0] === 'rev-list') return '0';
          return '';
        }),
        gh: vi.fn(() => '[]'),
      };

      await expect(
        submitCloudPr({
          mode: 'implement',
          ticketNumber: '737',
          cwd: tmpRepo,
          env: {},
          port: emptyAheadPort,
          linkTicketBranchImpl: () => {},
        })
      ).rejects.toThrow(/0 commits ahead/);
    } finally {
      fs.rmSync(tmpRepo, { recursive: true, force: true });
    }
  });
});
