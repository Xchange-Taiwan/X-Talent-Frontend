// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  CANONICAL_STATUS_OPTIONS,
  formatPowerShellConfigExports,
  formatShellConfigExports,
  linkTicketBranch,
  loadProjectConfig,
  parseGitHubRepoSlug,
  publishEvidence,
  redactCredentials,
  runTrackerOpsCli,
  verifyAndHealBoardStatus,
  waitPrChecks,
} from '../.agents/scripts/tracker-ops.mjs';

const LF = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const BS = String.fromCharCode(92);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

function createCaptureStdio() {
  const outChunks = [];
  const errChunks = [];
  return {
    stdio: {
      stdout: { write: (chunk) => outChunks.push(String(chunk)) },
      stderr: { write: (chunk) => errChunks.push(String(chunk)) },
    },
    getStdout: () => outChunks.join(''),
    getStderr: () => errChunks.join(''),
  };
}

function buildConfigMarkdown(jsonObj) {
  return [
    '# AI Agent Project Configuration',
    '',
    '```json',
    JSON.stringify(jsonObj, null, 2),
    '```',
  ].join(LF);
}

const VALID_REMOTE_CONFIG = {
  org: 'Xchange-Taiwan',
  repos: {
    tracker: 'X-Talent-Tracker',
    frontend: 'X-Talent-Frontend',
  },
  project: {
    number: 7,
    id: 'PVT_kwDOBFpxMc4BULhh',
  },
  fields: {
    status: {
      id: 'PVTSSF_lADOBFpxMc4BULhhzhBVb_Y',
      options: {
        backlog: '79bd68fc',
        in_progress: '47fc9ee4',
        pr_review: '013ebc9d',
      },
    },
  },
};

describe('tracker-ops: loadProjectConfig & shell exports', () => {
  it('loads remote X-Talent-Tracker config and populates canonical status option defaults', () => {
    const port = {
      git: () => '',
      gh: (args) => {
        expect(args[0]).toBe('api');
        expect(args[1]).toContain(
          'X-Talent-Tracker/contents/docs/agents/project-config.md'
        );
        return buildConfigMarkdown(VALID_REMOTE_CONFIG).replaceAll(
          LF,
          `${CR}${LF}`
        );
      },
    };

    const cfg = loadProjectConfig({
      port,
      localConfigPath: '/nonexistent/project-config.md',
      fs: {
        existsSync: () => false,
        readFileSync: () => {
          throw new Error('should not read local file when remote succeeds');
        },
      },
    });

    expect(cfg.org).toBe('Xchange-Taiwan');
    expect(cfg.repos.tracker).toBe('X-Talent-Tracker');
    expect(cfg.repos.frontend).toBe('X-Talent-Frontend');
    expect(cfg.project.number).toBe(7);
    expect(cfg.fields.status.options).toEqual(CANONICAL_STATUS_OPTIONS);
  });

  it('falls back to local docs/agents/project-config.md when remote gh api fails or returns Not Found', () => {
    const localMarkdown = buildConfigMarkdown({
      ...VALID_REMOTE_CONFIG,
      org: 'Local-Fallback-Org',
    });

    const port = {
      git: () => '',
      gh: () => '{"message":"Not Found"}',
    };

    const cfg = loadProjectConfig({
      port,
      localConfigPath: '/virtual/docs/agents/project-config.md',
      fs: {
        existsSync: (p) => p === '/virtual/docs/agents/project-config.md',
        readFileSync: () => localMarkdown,
      },
    });

    expect(cfg.org).toBe('Local-Fallback-Org');
    expect(cfg.fields.status.options.ready_for_review).toBe('86e0fe35');
    expect(cfg.fields.status.options.qa_review).toBe('8c4c8ea2');
    expect(cfg.fields.status.options.done).toBe('98236657');
  });

  it('throws descriptive error when both remote and local project-config.md are missing or malformed', () => {
    const port = {
      git: () => '',
      gh: () => {
        throw new Error('HTTP 503 Service Unavailable');
      },
    };

    expect(() =>
      loadProjectConfig({
        port,
        localConfigPath: '/virtual/malformed.md',
        fs: {
          existsSync: () => true,
          readFileSync: () => '# No JSON block here',
        },
      })
    ).toThrow(/project-config\.md is malformed or missing JSON block/);
  });

  it('supports env overrides when opted in and formats safe sh / ps1 variable exports', () => {
    const port = {
      git: () => '',
      gh: () => buildConfigMarkdown(VALID_REMOTE_CONFIG),
    };

    const cfg = loadProjectConfig({
      port,
      respectEnvOverrides: true,
      env: {
        ORG: "Custom'Org",
        PROJECT_NUMBER: '42',
        STATUS_PR_REVIEW: 'opt_pr_custom',
      },
    });

    expect(cfg.org).toBe("Custom'Org");
    expect(cfg.project.number).toBe(42);
    expect(cfg.fields.status.options.pr_review).toBe('opt_pr_custom');

    const shOut = formatShellConfigExports(cfg);
    expect(shOut).toContain(`export ORG='Custom'${BS}''Org'`);
    expect(shOut).toContain(`export PR_REVIEW_OPTION_ID='opt_pr_custom'`);
    expect(shOut).toContain(`export STATUS_PR_REVIEW='opt_pr_custom'`);

    const psOut = formatPowerShellConfigExports(cfg);
    expect(psOut).toContain(`$global:ORG = 'Custom''Org'; $ORG = $global:ORG`);
    expect(psOut).toContain(
      '$global:PROJECT_NUMBER = 42; $PROJECT_NUMBER = $global:PROJECT_NUMBER'
    );
  });
});

describe('tracker-ops: publishEvidence & credential redaction', () => {
  it('builds a fresh tree without git read-tree, uses isolated GIT_INDEX_FILE, retries push with jitter, and strips remote URL credentials', async () => {
    const gitCalls = [];
    const sleepDelays = [];
    const unlinkedPaths = [];
    let pushAttempt = 0;

    const port = {
      gh: () => '',
      git: (args, opts) => {
        gitCalls.push({ args, opts });
        if (args[0] === 'remote' && args[1] === 'get-url') {
          return 'https://x-access-token:ghs_SecretTokenValue123@github.com/Xchange-Taiwan/X-Talent-Frontend.git';
        }
        if (args[0] === 'branch' && args[1] === '--show-current') {
          return 'feat/901-collapse-tracker-ops';
        }
        if (args[0] === 'config') {
          return 'bot';
        }
        if (args[0] === 'fetch') {
          return '';
        }
        if (args[0] === 'rev-parse' && args[1] === 'FETCH_HEAD') {
          return pushAttempt === 0
            ? '1111111111111111111111111111111111111111'
            : '2222222222222222222222222222222222222222';
        }
        if (args[0] === 'hash-object') {
          return args.includes('--stdin') ? 'blob_marker_sha' : 'blob_img_sha';
        }
        if (args[0] === 'update-index') {
          return '';
        }
        if (args[0] === 'write-tree') {
          return '3333333333333333333333333333333333333333';
        }
        if (args[0] === 'commit-tree') {
          return pushAttempt === 0
            ? 'aaaaaaa111111111111111111111111111111111'
            : 'bbbbbbb222222222222222222222222222222222';
        }
        if (args[0] === 'push') {
          pushAttempt++;
          if (pushAttempt < 3) {
            throw new Error(
              'To https://x-access-token:ghs_SecretTokenValue123@github.com/Xchange-Taiwan/X-Talent-Frontend.git ! [rejected] non-fast-forward'
            );
          }
          return '';
        }
        return '';
      },
    };

    const { stdio, getStdout } = createCaptureStdio();
    const fakeFs = {
      existsSync: (p) =>
        p === '/tmp/evidence-a.png' || p === '/tmp/evidence-b.png',
      statSync: () => ({ isFile: () => true }),
      unlinkSync: (p) => unlinkedPaths.push(p),
    };

    const res = await publishEvidence(
      ['/tmp/evidence-a.png', '/tmp/evidence-b.png'],
      {
        port,
        stdio,
        fs: fakeFs,
        env: {},
        now: () => new Date('2026-11-15T08:30:00.000Z'),
        random: () => 0.5,
        sleepAsync: async (ms) => {
          sleepDelays.push(ms);
        },
      }
    );

    expect(pushAttempt).toBe(3);
    expect(sleepDelays).toEqual([4000, 6000]);

    // Never calls `git read-tree` (prevents O(N^2) historical tree accumulation)
    expect(gitCalls.some((c) => c.args[0] === 'read-tree')).toBe(false);

    // Every index-mutating call uses an isolated GIT_INDEX_FILE in os.tmpdir()
    const indexCalls = gitCalls.filter((c) =>
      ['update-index', 'write-tree', 'commit-tree'].includes(c.args[0])
    );
    expect(indexCalls.length).toBeGreaterThan(0);
    const scratchIndexPath = indexCalls[0].opts.env.GIT_INDEX_FILE;
    expect(scratchIndexPath).toContain('tracker-evidence-index-');
    for (const call of indexCalls) {
      expect(call.opts.env.GIT_INDEX_FILE).toBe(scratchIndexPath);
    }
    expect(unlinkedPaths).toContain(scratchIndexPath);

    // Final commit uses updated FETCH_HEAD parent SHA from retry
    const commitCalls = gitCalls.filter((c) => c.args[0] === 'commit-tree');
    const lastCommitCall = commitCalls.at(-1);
    expect(lastCommitCall.args).toEqual([
      'commit-tree',
      '3333333333333333333333333333333333333333',
      '-p',
      '2222222222222222222222222222222222222222',
    ]);

    // Output URLs contain clean repo slug with zero leaked credentials
    expect(res.urls).toEqual([
      'https://raw.githubusercontent.com/Xchange-Taiwan/X-Talent-Frontend/bbbbbbb222222222222222222222222222222222/feat-901-collapse-tracker-ops/20261115T083000Z/0-evidence-a.png',
      'https://raw.githubusercontent.com/Xchange-Taiwan/X-Talent-Frontend/bbbbbbb222222222222222222222222222222222/feat-901-collapse-tracker-ops/20261115T083000Z/1-evidence-b.png',
    ]);
    expect(getStdout()).not.toContain('ghs_SecretTokenValue123');
    expect(getStdout().trim().split(LF)).toEqual(res.urls);
  });

  it('redacts embedded URL credentials, PATs, and Bearer tokens when all 6 push attempts fail', async () => {
    let pushAttempts = 0;
    const port = {
      gh: () => '',
      git: (args) => {
        if (args[0] === 'remote') {
          return 'https://oauth2:ghp_TopSecretToken999@github.com/Xchange-Taiwan/X-Talent-Frontend.git';
        }
        if (args[0] === 'branch') return 'fix/901-redact-test';
        if (args[0] === 'config') return 'bot';
        if (args[0] === 'fetch') {
          throw new Error('fatal: couldn not find remote ref pr-evidence');
        }
        if (args[0] === 'hash-object') return 'blob_sha';
        if (args[0] === 'write-tree') return 'tree_sha';
        if (args[0] === 'commit-tree') return 'commit_sha';
        if (args[0] === 'push') {
          pushAttempts++;
          const err = new Error(
            'fatal: unable to access https://oauth2:ghp_TopSecretToken999@github.com/Xchange-Taiwan/X-Talent-Frontend.git/?access_token=ghu_QueryToken777'
          );
          err.stderr =
            'remote: Authorization: Bearer github_pat_SuperSecretBearer888 denied';
          throw err;
        }
        return '';
      },
    };

    const { stdio, getStderr } = createCaptureStdio();
    const cliRes = await runTrackerOpsCli(
      ['publish-evidence', '/tmp/shot.png'],
      {
        port,
        stdio,
        fs: {
          existsSync: (p) => p === '/tmp/shot.png',
          statSync: () => ({ isFile: () => true }),
          unlinkSync: () => {},
        },
        sleepAsync: async () => {},
      }
    );

    expect(pushAttempts).toBe(6);
    expect(cliRes.exitCode).toBe(1);
    const errOut = getStderr();
    expect(errOut).toContain('failed to push to pr-evidence after 6 attempts');
    expect(errOut).toContain(
      'https://***@github.com/Xchange-Taiwan/X-Talent-Frontend.git'
    );
    expect(errOut).not.toContain('ghp_TopSecretToken999');
    expect(errOut).not.toContain('ghu_QueryToken777');
    expect(errOut).not.toContain('github_pat_SuperSecretBearer888');
  });

  it('redacts credentials when origin remote is not a GitHub URL and supports --dry-run on GITHUB_HEAD_REF', async () => {
    expect(
      redactCredentials(
        'https://ci-bot:mySecretPass@gitlab.internal/team/repo.git token ghp_12345abcde'
      )
    ).toBe('https://***@gitlab.internal/team/repo.git token ***');
    expect(
      parseGitHubRepoSlug('git@github.com:Xchange-Taiwan/X-Talent-Frontend.git')
    ).toBe('Xchange-Taiwan/X-Talent-Frontend');

    const gitCommands = [];
    const port = {
      gh: () => '',
      git: (args) => {
        gitCommands.push(args[0]);
        if (args[0] === 'remote') {
          return 'git@github.com:Xchange-Taiwan/X-Talent-Frontend.git';
        }
        if (args[0] === 'branch') return ''; // Simulates GitHub Actions PR detached HEAD
        if (args[0] === 'config') return '';
        if (args[0] === 'hash-object') return 'dry_blob';
        if (args[0] === 'write-tree') return 'dry_tree';
        if (args[0] === 'commit-tree') return 'dry_commit_123';
        return '';
      },
    };

    const { stdio, getStdout } = createCaptureStdio();
    const res = await publishEvidence(['--dry-run', '/tmp/smoke.png'], {
      port,
      stdio,
      env: { GITHUB_HEAD_REF: 'feat/901-smoke' },
      now: () => new Date('2026-11-15T09:00:00.000Z'),
      fs: {
        existsSync: (p) => p === '/tmp/smoke.png',
        statSync: () => ({ isFile: () => true }),
        unlinkSync: () => {},
      },
    });

    expect(res.dryRun).toBe(true);
    expect(gitCommands).not.toContain('fetch');
    expect(gitCommands).not.toContain('push');
    expect(getStdout().trim()).toBe(
      'https://raw.githubusercontent.com/Xchange-Taiwan/X-Talent-Frontend/dry_commit_123/feat-901-smoke/20261115T090000Z/0-smoke.png'
    );
  });
});

describe('tracker-ops: verifyAndHealBoardStatus dialects', () => {
  function makeBoardFailurePort({
    branch = 'feat/901-collapse-scripts',
    openPrs = [{ number: 512, headRefName: 'feat/901-collapse-scripts' }],
    linkedBranches = [
      { id: 'LB_1', ref: { name: 'feat/901-collapse-scripts' } },
    ],
    currentStatusName = 'In progress',
    currentStatusOpt = CANONICAL_STATUS_OPTIONS.in_progress,
    mutationBehavior = 'throw',
  } = {}) {
    return {
      git: (args) => {
        if (args[0] === 'branch' && args[1] === '--show-current') {
          return branch;
        }
        return '';
      },
      gh: (args) => {
        if (
          args[0] === 'api' &&
          String(args[1]).includes('project-config.md')
        ) {
          return buildConfigMarkdown(VALID_REMOTE_CONFIG);
        }
        if (args[0] === 'pr' && args[1] === 'list') {
          return JSON.stringify(openPrs);
        }
        if (args[0] === 'api' && args[1] === 'graphql') {
          const joined = args.join(' ');
          if (joined.includes('updateProjectV2ItemFieldValue')) {
            if (mutationBehavior === 'throw') {
              throw new Error(
                'GraphQL 403 Resource not accessible by integration'
              );
            }
            if (mutationBehavior === 'graphql-error') {
              return JSON.stringify({
                errors: [{ message: 'Insufficient permissions' }],
              });
            }
            return JSON.stringify({
              data: {
                updateProjectV2ItemFieldValue: {
                  projectV2Item: { id: 'PVTI_901' },
                },
              },
            });
          }
          if (joined.includes('createLinkedBranch')) {
            return JSON.stringify({
              data: { createLinkedBranch: { linkedBranch: null } },
            });
          }
          if (
            joined.includes('repository(owner: $login, name: $repo) { id }')
          ) {
            return 'R_frontend_id';
          }
          return JSON.stringify({
            data: {
              repository: {
                issue: {
                  id: 'I_901',
                  number: 901,
                  title: '[Refactor] Collapse scripts',
                  linkedBranches: { nodes: linkedBranches },
                  closedByPullRequestsReferences: { nodes: [] },
                  projectItems: {
                    nodes: [
                      {
                        id: 'PVTI_901',
                        project: { number: 7 },
                        fieldValueByName: {
                          name: currentStatusName,
                          optionId: currentStatusOpt,
                        },
                      },
                    ],
                  },
                },
              },
            },
          });
        }
        return '';
      },
    };
  }

  it('enforces claude {"decision":"block"}, gemini {"decision":"deny"}, and none exitCode=1 when board healing fails', () => {
    const port = makeBoardFailurePort({ mutationBehavior: 'throw' });

    const claudeIo = createCaptureStdio();
    const claudeRes = verifyAndHealBoardStatus({
      port,
      stdio: claudeIo.stdio,
      dialect: 'claude',
      localConfigPath: '/missing/project-config.md',
      fs: { existsSync: () => false, readFileSync: () => '' },
    });
    expect(claudeRes.ok).toBe(false);
    expect(claudeRes.exitCode).toBe(0);
    const claudeJson = JSON.parse(claudeIo.getStdout().trim());
    expect(claudeJson.decision).toBe('block');
    expect(claudeJson.reason).toContain('X-Tracker #901');
    expect(claudeJson.reason).toContain('PR Review');

    const geminiIo = createCaptureStdio();
    const geminiRes = verifyAndHealBoardStatus({
      port: makeBoardFailurePort({ mutationBehavior: 'graphql-error' }),
      stdio: geminiIo.stdio,
      dialect: 'gemini',
      localConfigPath: '/missing/project-config.md',
      fs: { existsSync: () => false, readFileSync: () => '' },
    });
    expect(geminiRes.ok).toBe(false);
    expect(geminiRes.exitCode).toBe(0);
    const geminiJson = JSON.parse(geminiIo.getStdout().trim());
    expect(geminiJson.decision).toBe('deny');
    expect(geminiJson.reason).toContain('updateProjectV2ItemFieldValue');

    const noneIo = createCaptureStdio();
    const noneRes = verifyAndHealBoardStatus({
      port,
      stdio: noneIo.stdio,
      dialect: 'none',
    });
    expect(noneRes.ok).toBe(false);
    expect(noneRes.exitCode).toBe(1);
    expect(noneIo.getStdout()).toContain('X-Tracker #901');
  });

  it('enforces claude block and gemini deny when Development branch-link self-healing fails', () => {
    const unlinkedPort = makeBoardFailurePort({
      openPrs: [],
      linkedBranches: [],
      currentStatusName: 'In progress',
      currentStatusOpt: CANONICAL_STATUS_OPTIONS.in_progress,
    });

    const geminiIo = createCaptureStdio();
    const res = verifyAndHealBoardStatus({
      port: unlinkedPort,
      stdio: geminiIo.stdio,
      dialect: 'gemini',
    });
    expect(res.ok).toBe(false);
    expect(res.exitCode).toBe(0);
    const parsed = JSON.parse(geminiIo.getStdout().trim());
    expect(parsed.decision).toBe('deny');
    expect(parsed.reason).toContain('Development 欄位尚未連結');
    expect(parsed.reason).toContain(
      'node .agents/scripts/link-ticket-branch.mjs'
    );
  });

  it('self-heals drifted board status using remote X-Talent-Tracker config and preserves post-PR statuses', () => {
    const healPort = makeBoardFailurePort({ mutationBehavior: 'succeed' });
    const geminiIo = createCaptureStdio();
    const healed = verifyAndHealBoardStatus({
      port: healPort,
      stdio: geminiIo.stdio,
      dialect: 'gemini',
      localConfigPath: '/missing/project-config.md',
      fs: { existsSync: () => false, readFileSync: () => '' },
    });
    expect(healed.ok).toBe(true);
    expect(healed.healed).toBe(true);
    expect(healed.exitCode).toBe(0);
    expect(geminiIo.getStdout()).toBe(`{}${LF}`);

    const preservedPort = makeBoardFailurePort({
      currentStatusName: 'QA Review',
      currentStatusOpt: CANONICAL_STATUS_OPTIONS.qa_review,
    });
    const claudeIo = createCaptureStdio();
    const preserved = verifyAndHealBoardStatus({
      port: preservedPort,
      stdio: claudeIo.stdio,
      dialect: 'claude',
    });
    expect(preserved.ok).toBe(true);
    expect(claudeIo.getStdout()).toBe('');
  });
});

describe('tracker-ops: linkTicketBranch, waitPrChecks & wrappers', () => {
  it('preserves CLI flags (-NoCheckout / --no-checkout / -NoBoardUpdate) in linkTicketBranch via CommandPort', () => {
    const gitHistory = [];
    const port = {
      git: (args) => {
        gitHistory.push(args);
        if (args[0] === 'branch' && args[1] === '--show-current') {
          return 'develop';
        }
        if (args[0] === 'rev-parse') {
          return 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
        }
        return '';
      },
      gh: (args) => {
        if (
          args[0] === 'api' &&
          String(args[1]).includes('project-config.md')
        ) {
          return buildConfigMarkdown(VALID_REMOTE_CONFIG);
        }
        const joined = args.join(' ');
        if (joined.includes('repository(owner: $login, name: $repo) { id }')) {
          return 'R_frontend_1';
        }
        if (joined.includes('createLinkedBranch')) {
          return JSON.stringify({
            data: {
              createLinkedBranch: {
                linkedBranch: {
                  id: 'LB_901',
                  ref: { name: 'feat/901-tracker-ops' },
                },
              },
            },
          });
        }
        const fetchedTarget = gitHistory.some(
          (a) => a[0] === 'fetch' && a[2] === 'feat/901-tracker-ops'
        );
        return JSON.stringify({
          data: {
            repository: {
              issue: {
                id: 'I_901',
                number: 901,
                title: 'Tracker ops',
                linkedBranches: {
                  nodes: fetchedTarget
                    ? [{ id: 'LB_901', ref: { name: 'feat/901-tracker-ops' } }]
                    : [],
                },
                closedByPullRequestsReferences: { nodes: [] },
                projectItems: { nodes: [] },
              },
            },
          },
        });
      },
    };

    const { stdio, getStdout } = createCaptureStdio();
    const res = linkTicketBranch(
      ['901', 'feat/901-tracker-ops', '-NoCheckout', '-NoBoardUpdate'],
      { port, stdio }
    );

    expect(res.issueNumber).toBe(901);
    expect(res.targetBranch).toBe('feat/901-tracker-ops');
    expect(gitHistory.some((a) => a[0] === 'checkout')).toBe(false);
    expect(getStdout()).toContain('Linked branch');
    expect(getStdout()).toContain('Verified Development link on #901');
  });

  it('runs waitPrChecks with loadProjectConfig + env overrides and prints CONVERGED=true', async () => {
    const ghCalls = [];
    const port = {
      git: () => '',
      gh: (args) => {
        ghCalls.push(args);
        if (
          args[0] === 'api' &&
          String(args[1]).includes('project-config.md')
        ) {
          return buildConfigMarkdown(VALID_REMOTE_CONFIG);
        }
        if (args.includes('number')) {
          return JSON.stringify({ number: 902 });
        }
        if (args.includes('comments')) {
          return JSON.stringify({
            comments: [
              {
                author: { login: 'github-actions[bot]' },
                body: `<!-- ai-review-pipeline -->${LF}<!-- ai-review-sha:abcdef1234567 -->${LF}### ⚠️ Overall Risk${LF}**low** — Clean`,
              },
            ],
          });
        }
        return JSON.stringify({
          headRefName: 'feat/901-tracker-ops',
          headRefOid: 'abcdef1234567890',
          state: 'OPEN',
          mergeable: 'MERGEABLE',
          statusCheckRollup: [
            {
              __typename: 'CheckRun',
              name: 'Unit & Integration Tests',
              status: 'COMPLETED',
              conclusion: 'SUCCESS',
            },
            {
              __typename: 'CheckRun',
              name: 'AI Review: Final Summary',
              status: 'COMPLETED',
              conclusion: 'SUCCESS',
            },
          ],
        });
      },
    };

    const { stdio, getStdout } = createCaptureStdio();
    const res = await waitPrChecks(['902'], {
      port,
      stdio,
      env: { ORG: 'Override-Org', FRONTEND_REPO: 'Override-Repo' },
      maxPolls: 2,
      pollIntervalMs: 0,
    });

    expect(res.converged).toBe(true);
    expect(ghCalls.some((a) => a.includes('Override-Org/Override-Repo'))).toBe(
      true
    );
    expect(getStdout()).toContain('=== PR #902 CI & AI REVIEW SUMMARY ===');
    expect(getStdout()).toContain('CONVERGED=true');
  });

  it('keeps all .agents/scripts/*.{sh,ps1} wrappers as concise delegators into tracker-ops.mjs', () => {
    const wrapperRelPaths = [
      '.agents/scripts/link-ticket-branch.sh',
      '.agents/scripts/link-ticket-branch.ps1',
      '.agents/scripts/wait-pr-checks.sh',
      '.agents/scripts/wait-pr-checks.ps1',
      '.agents/scripts/publish-evidence.sh',
      '.agents/scripts/publish-evidence.ps1',
      '.agents/scripts/load-config.sh',
      '.agents/scripts/load-config.ps1',
      '.agents/scripts/check-board-status.sh',
      '.agents/scripts/hooks/claude-verify-board-status.sh',
      '.agents/scripts/hooks/gemini-verify-board-status.sh',
    ];

    for (const rel of wrapperRelPaths) {
      const content = fs
        .readFileSync(path.join(REPO_ROOT, rel), 'utf8')
        .replaceAll(CR, '')
        .trim();
      const nonShebangLines = content
        .split(LF)
        .filter((line) => line.trim() && !line.startsWith('#!'));
      expect(nonShebangLines.length).toBeLessThanOrEqual(2);
      expect(content).toContain('tracker-ops.mjs');
    }
  });
});
