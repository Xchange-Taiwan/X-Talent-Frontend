#!/usr/bin/env node
/**
 * Unified cross-platform tracker, board-status, PR check convergence, and
 * pr-evidence operations behind an injectable `CommandPort` (`{ git, gh }`)
 * and `stdio` (`{ stdout, stderr }`) test seam.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(__dirname, '../..');

const LF = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const BS = String.fromCharCode(92);

export const CANONICAL_STATUS_OPTIONS = Object.freeze({
  backlog: '79bd68fc',
  ready_for_review: '86e0fe35',
  todo: 'f75ad846',
  in_progress: '47fc9ee4',
  pr_review: '013ebc9d',
  qa_review: '8c4c8ea2',
  done: '98236657',
});

const REMOTE_PROJECT_CONFIG_ENDPOINT =
  '/repos/Xchange-Taiwan/X-Talent-Tracker/contents/docs/agents/project-config.md?ref=main';

/**
 * Scrubs embedded URL credentials (`https://user:token@host`), GitHub PAT /
 * App / OAuth tokens, and Authorization header values from diagnostic strings.
 */
export function redactCredentials(value = '') {
  return String(value ?? '')
    .replace(/((?:https?|ssh|git):\/\/)([^/\s@]+@)/gi, '$1***@')
    .replace(
      /(?<![A-Za-z0-9_])(gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)(?![A-Za-z0-9_])/g,
      '***'
    )
    .replace(
      /(Authorization:\s*(?:Bearer|token|Basic)\s+)[^\s"']+/gi,
      '$1***'
    )
    .replace(/([?&](?:access_token|token)=)[^&\s"']+/gi, '$1***');
}

function extractErrorDetail(err) {
  if (!err) return '';
  const parts = [];
  if (typeof err.stderr === 'string' && err.stderr.trim()) {
    parts.push(err.stderr.trim());
  } else if (Buffer.isBuffer(err.stderr) && err.stderr.length > 0) {
    parts.push(err.stderr.toString('utf8').trim());
  }
  if (typeof err.message === 'string' && err.message.trim()) {
    const msg = err.message.trim();
    if (!parts.some((p) => p.includes(msg))) {
      parts.push(msg);
    }
  }
  return redactCredentials(parts.join(' | '));
}

function createCliError(message, exitCode = 1) {
  const err = new Error(redactCredentials(message));
  err.exitCode = exitCode;
  return err;
}

function defaultSleepSync(ms) {
  if (ms > 0) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  }
}

function defaultSleepAsync(ms) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createDefaultCommandPort({
  repoRoot = DEFAULT_REPO_ROOT,
  env = process.env,
} = {}) {
  const runBinary = (bin, args, callOpts = {}) => {
    try {
      const mergedEnv = callOpts.env ? { ...env, ...callOpts.env } : env;
      const out = execFileSync(bin, args, {
        cwd: callOpts.cwd || repoRoot,
        env: mergedEnv,
        input: callOpts.input,
        encoding: 'utf8',
        stdio: [
          callOpts.input !== undefined ? 'pipe' : 'ignore',
          'pipe',
          'pipe',
        ],
      });
      return String(out ?? '').trim();
    } catch (err) {
      const detail = extractErrorDetail(err) || `${bin} failed`;
      const wrapped = createCliError(detail, err?.status || 1);
      throw wrapped;
    }
  };

  return {
    git: (args, opts) => runBinary('git', args, opts),
    gh: (args, opts) => runBinary('gh', args, opts),
  };
}

function resolveRuntime(options = {}) {
  const hasCustomPort = Boolean(options.port);
  const repoRoot =
    options.repoRoot || options.port?.repoRoot || DEFAULT_REPO_ROOT;
  const env = options.env || options.port?.env || process.env;
  const fsImpl = options.fs || options.port?.fs || fs;
  const port = options.port || createDefaultCommandPort({ repoRoot, env });
  const rawStdio = options.stdio || options.port?.stdio || null;
  const stdout = rawStdio?.stdout || process.stdout;
  const stderr = rawStdio?.stderr || process.stderr;
  const sleepSync =
    options.sleepSync ||
    options.port?.sleepSync ||
    (hasCustomPort ? () => {} : defaultSleepSync);
  const sleepAsync =
    options.sleepAsync ||
    options.port?.sleepAsync ||
    (hasCustomPort ? () => Promise.resolve() : defaultSleepAsync);
  const random = options.random || options.port?.random || Math.random;
  const now = options.now || options.port?.now || (() => new Date());

  return {
    port,
    repoRoot,
    env,
    fsImpl,
    stdout,
    stderr,
    writeOut: (line = '') => stdout.write(`${line}${LF}`),
    writeErr: (line = '') => stderr.write(`${line}${LF}`),
    sleepSync,
    sleepAsync,
    random,
    now,
  };
}

function execGit(rt, args, { allowFail = false, env, input, cwd } = {}) {
  try {
    const out = rt.port.git(args, { allowFail, env, input, cwd });
    return String(out ?? '').trim();
  } catch (err) {
    if (allowFail) return '';
    throw createCliError(
      extractErrorDetail(err) || `git ${args[0] || ''} failed`,
      err?.exitCode || 1
    );
  }
}

function execGh(
  rt,
  args,
  { allowFail = false, retries = 3, env, input, cwd } = {}
) {
  let lastErr;
  const maxAttempts = Math.max(1, Number(retries) || 1);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const out = rt.port.gh(args, {
        allowFail: false,
        retries: maxAttempts,
        attempt,
        env,
        input,
        cwd,
      });
      return String(out ?? '').trim();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        rt.sleepSync(1000 * attempt);
      }
    }
  }
  if (allowFail) return '';
  throw createCliError(
    extractErrorDetail(lastErr) || `gh ${args[0] || ''} failed`,
    lastErr?.exitCode || 1
  );
}

export function parseProjectConfigMarkdown(markdown = '') {
  const normalized = String(markdown ?? '').replaceAll(CR, '');
  if (!normalized.trim() || /"message"\s*:\s*"Not Found"/i.test(normalized)) {
    return null;
  }
  const match = normalized.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match || !match[1] || match[1].trim() === 'null') {
    return null;
  }
  try {
    const parsed = JSON.parse(match[1]);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !parsed.org ||
      !parsed.repos?.tracker ||
      !parsed.repos?.frontend ||
      parsed.project?.number === undefined ||
      !parsed.project?.id ||
      !parsed.fields?.status?.id
    ) {
      return null;
    }
    const rawOptions = parsed.fields.status.options || {};
    return {
      org: String(parsed.org),
      repos: {
        tracker: String(parsed.repos.tracker),
        frontend: String(parsed.repos.frontend),
      },
      project: {
        number: Number(parsed.project.number),
        id: String(parsed.project.id),
      },
      fields: {
        status: {
          id: String(parsed.fields.status.id),
          options: {
            backlog: String(
              rawOptions.backlog || CANONICAL_STATUS_OPTIONS.backlog
            ),
            ready_for_review: String(
              rawOptions.ready_for_review ||
                CANONICAL_STATUS_OPTIONS.ready_for_review
            ),
            todo: String(rawOptions.todo || CANONICAL_STATUS_OPTIONS.todo),
            in_progress: String(
              rawOptions.in_progress || CANONICAL_STATUS_OPTIONS.in_progress
            ),
            pr_review: String(
              rawOptions.pr_review || CANONICAL_STATUS_OPTIONS.pr_review
            ),
            qa_review: String(
              rawOptions.qa_review || CANONICAL_STATUS_OPTIONS.qa_review
            ),
            done: String(rawOptions.done || CANONICAL_STATUS_OPTIONS.done),
          },
        },
      },
    };
  } catch {
    return null;
  }
}

function applyConfigEnvOverrides(config, env = {}) {
  const opts = config.fields.status.options;
  return {
    org: String(env.ORG || config.org),
    repos: {
      tracker: String(env.TRACKER_REPO || config.repos.tracker),
      frontend: String(env.FRONTEND_REPO || config.repos.frontend),
    },
    project: {
      number:
        env.PROJECT_NUMBER !== undefined && env.PROJECT_NUMBER !== ''
          ? Number(env.PROJECT_NUMBER)
          : config.project.number,
      id: String(env.PROJECT_ID || config.project.id),
    },
    fields: {
      status: {
        id: String(
          env.FIELD_ID || env.STATUS_FIELD_ID || config.fields.status.id
        ),
        options: {
          backlog: String(
            env.BACKLOG_OPTION_ID || env.STATUS_BACKLOG || opts.backlog
          ),
          ready_for_review: String(
            env.READY_FOR_REVIEW_OPTION_ID ||
              env.STATUS_READY_FOR_REVIEW ||
              opts.ready_for_review
          ),
          todo: String(env.TODO_OPTION_ID || env.STATUS_TODO || opts.todo),
          in_progress: String(
            env.IN_PROGRESS_OPTION_ID ||
              env.STATUS_IN_PROGRESS ||
              opts.in_progress
          ),
          pr_review: String(
            env.PR_REVIEW_OPTION_ID || env.STATUS_PR_REVIEW || opts.pr_review
          ),
          qa_review: String(
            env.QA_REVIEW_OPTION_ID || env.STATUS_QA_REVIEW || opts.qa_review
          ),
          done: String(env.DONE_OPTION_ID || env.STATUS_DONE || opts.done),
        },
      },
    },
  };
}

/**
 * Loads Project V2 & repository configuration from `X-Talent-Tracker` (`main`)
 * with automatic fallback to local `docs/agents/project-config.md`.
 */
export function loadProjectConfig(options = {}) {
  const rt = resolveRuntime(options);
  const remoteMd = execGh(
    rt,
    [
      'api',
      REMOTE_PROJECT_CONFIG_ENDPOINT,
      '-H',
      'Accept: application/vnd.github.raw',
    ],
    { allowFail: true, retries: 1 }
  );

  let config = parseProjectConfigMarkdown(remoteMd);
  if (!config) {
    const localPath =
      options.localConfigPath ||
      path.join(rt.repoRoot, 'docs/agents/project-config.md');
    if (rt.fsImpl.existsSync(localPath)) {
      const localMd = rt.fsImpl.readFileSync(localPath, 'utf8');
      config = parseProjectConfigMarkdown(localMd);
    }
  }

  if (!config) {
    throw createCliError(
      'ERROR: project-config.md is malformed or missing JSON block — aborting',
      1
    );
  }

  if (options.respectEnvOverrides) {
    return applyConfigEnvOverrides(config, rt.env);
  }
  return config;
}

export function formatShellConfigExports(config) {
  const esc = (s) => `'${String(s).replaceAll("'", `'${BS}''`)}'`;
  const opts = config.fields.status.options;
  const entries = [
    ['ORG', config.org],
    ['GITHUB_ORG', config.org],
    ['TRACKER_ORG', config.org],
    ['TRACKER_REPO', config.repos.tracker],
    ['FRONTEND_REPO', config.repos.frontend],
    ['PROJECT_NUMBER', config.project.number],
    ['PROJECT_ID', config.project.id],
    ['FIELD_ID', config.fields.status.id],
    ['STATUS_FIELD_ID', config.fields.status.id],
    ['BACKLOG_OPTION_ID', opts.backlog],
    ['STATUS_BACKLOG', opts.backlog],
    ['READY_FOR_REVIEW_OPTION_ID', opts.ready_for_review],
    ['STATUS_READY_FOR_REVIEW', opts.ready_for_review],
    ['TODO_OPTION_ID', opts.todo],
    ['STATUS_TODO', opts.todo],
    ['IN_PROGRESS_OPTION_ID', opts.in_progress],
    ['STATUS_IN_PROGRESS', opts.in_progress],
    ['PR_REVIEW_OPTION_ID', opts.pr_review],
    ['STATUS_PR_REVIEW', opts.pr_review],
    ['QA_REVIEW_OPTION_ID', opts.qa_review],
    ['STATUS_QA_REVIEW', opts.qa_review],
    ['DONE_OPTION_ID', opts.done],
    ['STATUS_DONE', opts.done],
  ];
  return entries.map(([k, v]) => `export ${k}=${esc(v)}`).join(LF);
}

export function formatPowerShellConfigExports(config) {
  const esc = (s) => `'${String(s).replaceAll("'", "''")}'`;
  const opts = config.fields.status.options;
  const entries = [
    ['ORG', esc(config.org)],
    ['GITHUB_ORG', esc(config.org)],
    ['TRACKER_ORG', esc(config.org)],
    ['TRACKER_REPO', esc(config.repos.tracker)],
    ['FRONTEND_REPO', esc(config.repos.frontend)],
    ['PROJECT_NUMBER', String(Number(config.project.number))],
    ['PROJECT_ID', esc(config.project.id)],
    ['FIELD_ID', esc(config.fields.status.id)],
    ['STATUS_FIELD_ID', esc(config.fields.status.id)],
    ['BACKLOG_OPTION_ID', esc(opts.backlog)],
    ['STATUS_BACKLOG', esc(opts.backlog)],
    ['READY_FOR_REVIEW_OPTION_ID', esc(opts.ready_for_review)],
    ['STATUS_READY_FOR_REVIEW', esc(opts.ready_for_review)],
    ['TODO_OPTION_ID', esc(opts.todo)],
    ['STATUS_TODO', esc(opts.todo)],
    ['IN_PROGRESS_OPTION_ID', esc(opts.in_progress)],
    ['STATUS_IN_PROGRESS', esc(opts.in_progress)],
    ['PR_REVIEW_OPTION_ID', esc(opts.pr_review)],
    ['STATUS_PR_REVIEW', esc(opts.pr_review)],
    ['QA_REVIEW_OPTION_ID', esc(opts.qa_review)],
    ['STATUS_QA_REVIEW', esc(opts.qa_review)],
    ['DONE_OPTION_ID', esc(opts.done)],
    ['STATUS_DONE', esc(opts.done)],
  ];
  return entries
    .map(([k, expr]) => `$global:${k} = ${expr}; $${k} = $global:${k}`)
    .join(LF);
}

export function shouldPreserveBoardStatus(statusLabel = '') {
  const clean = String(statusLabel ?? '').trim();
  return ['QA Review', 'Done', 'Blocked', 'Cancel'].includes(clean);
}

export function deriveBranchNameFromIssue(issueNumber, rawTitle = '') {
  const title = String(rawTitle ?? '');
  const prefix = /\[bug\]|修復|異常|破版/i.test(title) ? 'fix' : 'feat';
  const withoutTags = title.replace(/^(\[[^\]]+\]\s*)+/, '');
  const asciiWords = withoutTags
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.slice(0, 5)
    ?.join('-');
  const slug = asciiWords || 'impl';
  return `${prefix}/${issueNumber}-${slug}`;
}

export function queryBranchOpenPrState({
  org,
  frontendRepo,
  targetBranch,
  port,
  execGh: customExecGh,
}) {
  const cleanBranch = String(targetBranch || '').trim();
  if (!cleanBranch || cleanBranch === 'develop' || cleanBranch === 'main') {
    return { ok: false, hasOpenPr: false, openPrCount: null, headRefName: '' };
  }
  const ghArgs = [
    'pr',
    'list',
    '--repo',
    `${org}/${frontendRepo}`,
    '--head',
    cleanBranch,
    '--state',
    'open',
    '--json',
    'number,headRefName',
  ];

  let raw = '';
  if (typeof customExecGh === 'function') {
    raw = customExecGh(ghArgs, { allowFail: true, retries: 2 });
  } else {
    const rt = resolveRuntime({ port });
    raw = execGh(rt, ghArgs, { allowFail: true, retries: 2 });
  }

  if (!raw || !String(raw).trim()) {
    return { ok: false, hasOpenPr: false, openPrCount: null, headRefName: '' };
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return {
        ok: false,
        hasOpenPr: false,
        openPrCount: null,
        headRefName: '',
      };
    }
    return {
      ok: true,
      hasOpenPr: parsed.length > 0,
      openPrCount: parsed.length,
      headRefName: parsed[0]?.headRefName || cleanBranch,
    };
  } catch {
    return { ok: false, hasOpenPr: false, openPrCount: null, headRefName: '' };
  }
}

export function resolveTicketBranchPlan({
  issueNumber,
  issueObj,
  requestedBranch = '',
  openPrsByTicket = [],
  remoteBranchExists = false,
  directBranchOpenPrCheck = null,
}) {
  const cleanRequested =
    requestedBranch &&
    requestedBranch !== 'develop' &&
    requestedBranch !== 'main'
      ? String(requestedBranch).trim()
      : '';

  const openLinkedPrs = (
    issueObj?.closedByPullRequestsReferences?.nodes || []
  ).filter((n) => n?.state === 'OPEN' && n?.headRefName);

  const directOpenBranch =
    directBranchOpenPrCheck?.ok && directBranchOpenPrCheck?.hasOpenPr
      ? directBranchOpenPrCheck.headRefName
      : '';

  const activeOpenPrBranch =
    openLinkedPrs[0]?.headRefName ||
    openPrsByTicket[0]?.headRefName ||
    directOpenBranch ||
    '';

  const hasOpenPr = Boolean(activeOpenPrBranch);

  if (cleanRequested) {
    return {
      targetBranch: cleanRequested,
      hasOpenPr,
      resetToOriginDevelop: false,
    };
  }

  if (activeOpenPrBranch) {
    return {
      targetBranch: activeOpenPrBranch,
      hasOpenPr: true,
      resetToOriginDevelop: false,
    };
  }

  const preLinked = (issueObj?.linkedBranches?.nodes || [])
    .map((n) => n?.ref?.name)
    .find((b) => b && b !== 'develop' && b !== 'main');

  const targetBranch =
    preLinked || deriveBranchNameFromIssue(issueNumber, issueObj?.title);

  const canSafelyResetRemote =
    Boolean(remoteBranchExists) &&
    (directBranchOpenPrCheck === null ||
      (directBranchOpenPrCheck.ok === true &&
        directBranchOpenPrCheck.openPrCount === 0));

  return {
    targetBranch,
    hasOpenPr: false,
    resetToOriginDevelop: canSafelyResetRemote,
  };
}

function queryIssueState(rt, org, repoName, issueNumber) {
  const query = `
    query($login: String!, $repo: String!, $issue_number: Int!) {
      repository(owner: $login, name: $repo) {
        issue(number: $issue_number) {
          id
          number
          title
          linkedBranches(first: 10) {
            nodes {
              id
              ref { name }
            }
          }
          closedByPullRequestsReferences(first: 10) {
            nodes {
              number
              state
              headRefName
              url
            }
          }
          projectItems(first: 10) {
            nodes {
              id
              project { number }
              fieldValueByName(name: "Status") {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  optionId
                }
              }
            }
          }
        }
      }
    }
  `;
  const out = execGh(
    rt,
    [
      'api',
      'graphql',
      '-f',
      `login=${org}`,
      '-f',
      `repo=${repoName}`,
      '-F',
      `issue_number=${issueNumber}`,
      '-f',
      `query=${query}`,
    ],
    { allowFail: true }
  );
  if (!out) return null;
  try {
    return JSON.parse(out)?.data?.repository?.issue ?? null;
  } catch {
    return null;
  }
}

function createLinkedBranchWithRetry(
  rt,
  { issueId, repositoryId, oid, branchName, maxAttempts = 4 }
) {
  const createMut = `
    mutation($issueId: ID!, $repositoryId: ID!, $oid: GitObjectID!, $name: String!) {
      createLinkedBranch(input: {issueId: $issueId, repositoryId: $repositoryId, oid: $oid, name: $name}) {
        linkedBranch { id ref { name } }
      }
    }
  `;
  let linkedId = '';
  for (let mutAttempt = 1; mutAttempt <= maxAttempts; mutAttempt++) {
    const mutOut = execGh(
      rt,
      [
        'api',
        'graphql',
        '-f',
        `query=${createMut}`,
        '-f',
        `issueId=${issueId}`,
        '-f',
        `repositoryId=${repositoryId}`,
        '-f',
        `oid=${oid}`,
        '-f',
        `name=${branchName}`,
      ],
      { allowFail: true, retries: 1 }
    );
    try {
      linkedId =
        JSON.parse(mutOut)?.data?.createLinkedBranch?.linkedBranch?.id || '';
    } catch {}
    if (linkedId) break;
    if (mutAttempt < maxAttempts) rt.sleepSync(1500 * mutAttempt);
  }
  return linkedId;
}

/**
 * Links a Git branch in `$FRONTEND_REPO` to an issue in `$TRACKER_REPO` (or
 * `$FRONTEND_REPO` fallback) via GraphQL `createLinkedBranch`, verifies
 * `Development` links, and moves Project V2 status to `In progress`.
 */
export function linkTicketBranch(argv = process.argv.slice(2), options = {}) {
  const rt = resolveRuntime(options);
  const cfg = loadProjectConfig({
    ...options,
    port: rt.port,
    repoRoot: rt.repoRoot,
    env: rt.env,
    fs: rt.fsImpl,
  });

  const org = cfg.org;
  const trackerRepo = cfg.repos.tracker;
  const frontendRepo = cfg.repos.frontend;
  const projectNumber = Number(cfg.project.number);
  const projectId = cfg.project.id;
  const fieldId = cfg.fields.status.id;
  const inProgressOptionId = cfg.fields.status.options.in_progress;

  let noCheckout = false;
  let noBoardUpdate = false;
  let flagTicket = '';
  let flagBranch = '';
  const positional = [];

  for (const arg of argv) {
    if (arg === '--no-checkout' || arg === '-NoCheckout') {
      noCheckout = true;
    } else if (arg === '--no-board-update' || arg === '-NoBoardUpdate') {
      noBoardUpdate = true;
    } else if (arg.startsWith('--ticket=')) {
      flagTicket = arg.slice('--ticket='.length).trim();
    } else if (arg.startsWith('--branch=')) {
      flagBranch = arg.slice('--branch='.length).trim();
    } else {
      positional.push(arg);
    }
  }

  const rawIssue = flagTicket || positional[0] || '';
  const explicitArgBranch = flagBranch || positional[1] || '';
  const currentBranch = execGit(rt, ['branch', '--show-current'], {
    allowFail: true,
  });
  let targetBranch = explicitArgBranch || currentBranch;

  let issueRepo = trackerRepo;
  let issueNumber = 0;

  if (rawIssue) {
    const urlMatch = rawIssue.match(
      /github\.com\/[^/]+\/([^/]+)\/issues\/(\d+)/
    );
    if (urlMatch) {
      issueRepo = urlMatch[1];
      issueNumber = Number(urlMatch[2]);
    } else {
      const numMatch = rawIssue.match(/(\d+)/);
      if (numMatch) issueNumber = Number(numMatch[1]);
    }
  }

  if (!issueNumber && targetBranch) {
    const numMatch = targetBranch.match(/(\d+)/);
    if (numMatch) issueNumber = Number(numMatch[1]);
  }

  if (!issueNumber) {
    rt.writeOut(
      `⚠️ Could not determine issue number from arguments or branch '${targetBranch}'. Skipping branch link.`
    );
    return { skipped: true, targetBranch };
  }

  let issueObj = queryIssueState(rt, org, issueRepo, issueNumber);
  if (!issueObj?.id && issueRepo !== frontendRepo) {
    issueRepo = frontendRepo;
    issueObj = queryIssueState(rt, org, issueRepo, issueNumber);
  }
  if (!issueObj?.id) {
    throw createCliError(
      `ERROR: Could not find issue #${issueNumber} in ${org}/${trackerRepo} or ${org}/${frontendRepo}.`,
      1
    );
  }

  let openPrsByTicket = [];
  if (!explicitArgBranch) {
    const rawOpenPrs = execGh(
      rt,
      [
        'pr',
        'list',
        '--repo',
        `${org}/${frontendRepo}`,
        '--state',
        'open',
        '--limit',
        '30',
        '--json',
        'number,headRefName,title,body',
      ],
      { allowFail: true }
    );
    if (rawOpenPrs) {
      try {
        const parsedPrs = JSON.parse(rawOpenPrs) || [];
        const tkRe = new RegExp(
          `(?:^|/|-|#)${issueNumber}(?:(?![A-Za-z0-9_])|-|$)`
        );
        openPrsByTicket = parsedPrs.filter(
          (p) =>
            tkRe.test(String(p?.headRefName || '')) ||
            tkRe.test(String(p?.title || ''))
        );
      } catch {}
    }
  }

  const candidateForProbe =
    targetBranch && targetBranch !== 'develop' && targetBranch !== 'main'
      ? targetBranch
      : (issueObj.linkedBranches?.nodes || [])
          .map((n) => n?.ref?.name)
          .find((b) => b && b !== 'develop' && b !== 'main') ||
        deriveBranchNameFromIssue(issueNumber, issueObj.title);

  const probeLsRemote = execGit(
    rt,
    ['ls-remote', '--heads', 'origin', candidateForProbe],
    { allowFail: true }
  );

  const runBoundGh = (args, ghOpts) => execGh(rt, args, ghOpts);

  const directProbeCheck = probeLsRemote
    ? queryBranchOpenPrState({
        org,
        frontendRepo,
        targetBranch: candidateForProbe,
        execGh: runBoundGh,
      })
    : null;

  const branchPlan = resolveTicketBranchPlan({
    issueNumber,
    issueObj,
    requestedBranch:
      explicitArgBranch ||
      (currentBranch !== 'develop' && currentBranch !== 'main'
        ? currentBranch
        : ''),
    openPrsByTicket,
    remoteBranchExists: Boolean(probeLsRemote),
    directBranchOpenPrCheck: directProbeCheck,
  });

  targetBranch = branchPlan.targetBranch;
  rt.writeOut(
    `ℹ️ Selected target branch '${targetBranch}' for #${issueNumber} (hasOpenPr=${branchPlan.hasOpenPr}, resetToOriginDevelop=${branchPlan.resetToOriginDevelop}).`
  );

  execGit(rt, ['fetch', 'origin', 'develop', '--quiet'], { allowFail: true });
  const remoteBaseOid =
    execGit(rt, ['rev-parse', 'refs/remotes/origin/develop'], {
      allowFail: true,
    }) || execGit(rt, ['rev-parse', 'HEAD']);

  if (branchPlan.resetToOriginDevelop) {
    const finalResetCheck =
      targetBranch === candidateForProbe && directProbeCheck
        ? directProbeCheck
        : queryBranchOpenPrState({
            org,
            frontendRepo,
            targetBranch,
            execGh: runBoundGh,
          });
    if (finalResetCheck.ok && finalResetCheck.openPrCount === 0) {
      rt.writeOut(
        `ℹ️ Resetting stale remote branch origin/${targetBranch} (verified 0 open PRs) to latest origin/develop (${remoteBaseOid.slice(0, 7)})...`
      );
      execGit(
        rt,
        [
          'push',
          'origin',
          '--force',
          `${remoteBaseOid}:refs/heads/${targetBranch}`,
        ],
        { allowFail: true }
      );
    } else {
      rt.writeErr(
        `⚠️ Skipping --force reset of origin/${targetBranch} because open-PR check did not confirm 0 open PRs (ok=${finalResetCheck.ok}, count=${finalResetCheck.openPrCount}).`
      );
      branchPlan.resetToOriginDevelop = false;
    }
  }

  const repoIdQuery = `
    query($login: String!, $repo: String!) {
      repository(owner: $login, name: $repo) { id }
    }
  `;
  const repoNodeId = execGh(rt, [
    'api',
    'graphql',
    '-f',
    `login=${org}`,
    '-f',
    `repo=${frontendRepo}`,
    '-f',
    `query=${repoIdQuery}`,
    '--jq',
    '.data.repository.id',
  ]);

  const existingBranches = (issueObj.linkedBranches?.nodes || [])
    .map((n) => n?.ref?.name)
    .filter(Boolean);
  const existingOpenPrs = (issueObj.closedByPullRequestsReferences?.nodes || [])
    .filter((n) => n?.state === 'OPEN')
    .map((n) => n?.headRefName)
    .filter(Boolean);

  if (existingBranches.includes(targetBranch) || existingOpenPrs.length > 0) {
    rt.writeOut(
      `✅ Issue #${issueNumber} (${issueRepo}) is already linked to active branch/open PR on GitHub.`
    );
  } else {
    const lsRemote = execGit(
      rt,
      ['ls-remote', '--heads', 'origin', targetBranch],
      { allowFail: true }
    );
    let branchOidForMutation = remoteBaseOid;

    if (lsRemote) {
      const remoteOid = lsRemote.split(/\s+/)[0];
      if (remoteOid) {
        branchOidForMutation = remoteOid;
      }
      const deleteGuard = queryBranchOpenPrState({
        org,
        frontendRepo,
        targetBranch,
        execGh: runBoundGh,
      });
      let deletedRemoteBranch = false;
      if (deleteGuard.ok && deleteGuard.openPrCount === 0) {
        rt.writeOut(
          `ℹ️ Remote branch origin/${targetBranch} exists without an open PR; recreating via createLinkedBranch at ${branchOidForMutation.slice(0, 7)}...`
        );
        execGit(rt, ['fetch', 'origin', targetBranch, '--quiet'], {
          allowFail: true,
        });
        execGit(rt, ['push', 'origin', '--delete', targetBranch], {
          allowFail: true,
        });
        deletedRemoteBranch = true;
      }

      const linkedId = createLinkedBranchWithRetry(rt, {
        issueId: issueObj.id,
        repositoryId: repoNodeId,
        oid: branchOidForMutation,
        branchName: targetBranch,
        maxAttempts: 4,
      });

      if (linkedId) {
        rt.writeOut(
          `✅ Linked branch '${targetBranch}' to ${org}/${issueRepo}#${issueNumber} (id: ${linkedId})`
        );
      } else if (deletedRemoteBranch) {
        rt.writeErr(
          `⚠️ createLinkedBranch did not succeed after retries; restoring remote branch origin/${targetBranch} at ${branchOidForMutation.slice(0, 7)}...`
        );
        execGit(
          rt,
          [
            'push',
            'origin',
            `${branchOidForMutation}:refs/heads/${targetBranch}`,
          ],
          { allowFail: true }
        );
      }
    } else {
      const linkedId = createLinkedBranchWithRetry(rt, {
        issueId: issueObj.id,
        repositoryId: repoNodeId,
        oid: branchOidForMutation,
        branchName: targetBranch,
        maxAttempts: 3,
      });
      if (linkedId) {
        rt.writeOut(
          `✅ Linked branch '${targetBranch}' to ${org}/${issueRepo}#${issueNumber} (id: ${linkedId})`
        );
      }
    }
  }

  execGit(rt, ['fetch', 'origin', targetBranch], { allowFail: true });
  const hasLocalBranch = Boolean(
    execGit(rt, ['show-ref', '--verify', `refs/heads/${targetBranch}`], {
      allowFail: true,
    })
  );
  const hasRemoteBranch = Boolean(
    execGit(
      rt,
      ['show-ref', '--verify', `refs/remotes/origin/${targetBranch}`],
      { allowFail: true }
    )
  );

  if (!noCheckout) {
    if (branchPlan.resetToOriginDevelop) {
      execGit(rt, ['checkout', '-B', targetBranch, remoteBaseOid]);
    } else {
      const nowBranch = execGit(rt, ['branch', '--show-current'], {
        allowFail: true,
      });
      if (nowBranch !== targetBranch) {
        if (hasLocalBranch) {
          execGit(rt, ['checkout', targetBranch]);
        } else if (hasRemoteBranch) {
          execGit(rt, [
            'checkout',
            '-b',
            targetBranch,
            '--track',
            `origin/${targetBranch}`,
          ]);
        } else {
          execGit(rt, ['checkout', '-b', targetBranch]);
        }
      }
    }
  }

  if (
    execGit(rt, ['show-ref', '--verify', `refs/heads/${targetBranch}`], {
      allowFail: true,
    }) &&
    hasRemoteBranch
  ) {
    execGit(
      rt,
      ['branch', `--set-upstream-to=origin/${targetBranch}`, targetBranch],
      { allowFail: true }
    );
  }

  let verifyObj = null;
  let vBranches = [];
  let vPrs = [];
  for (let vAttempt = 1; vAttempt <= 3; vAttempt++) {
    verifyObj = queryIssueState(rt, org, issueRepo, issueNumber);
    vBranches = (verifyObj?.linkedBranches?.nodes || [])
      .map((n) => n?.ref?.name)
      .filter(Boolean);
    vPrs = (verifyObj?.closedByPullRequestsReferences?.nodes || [])
      .filter((n) => n?.state === 'OPEN')
      .map((n) => `#${n?.number}`)
      .filter(Boolean);
    if (vBranches.length > 0 || vPrs.length > 0) break;
    if (vAttempt < 3) rt.sleepSync(1500);
  }

  if (vBranches.length > 0 || vPrs.length > 0) {
    rt.writeOut(
      `✅ Verified Development link on #${issueNumber}: linkedBranches=[${vBranches.join(',')}] linkedPRs=[${vPrs.join(',')}]`
    );
  } else {
    const existingPrNum = execGh(
      rt,
      [
        'pr',
        'list',
        '--repo',
        `${org}/${frontendRepo}`,
        '--head',
        targetBranch,
        '--state',
        'open',
        '--limit',
        '1',
        '--json',
        'number',
        '--jq',
        '.[0].number // empty',
      ],
      { allowFail: true }
    );
    if (existingPrNum) {
      const issueUrl = `https://github.com/${org}/${issueRepo}/issues/${issueNumber}`;
      const curBody = execGh(
        rt,
        [
          'pr',
          'view',
          existingPrNum,
          '--repo',
          `${org}/${frontendRepo}`,
          '--json',
          'body',
          '--jq',
          '.body // ""',
        ],
        { allowFail: true }
      );
      if (
        !curBody.includes(`Closes ${issueUrl}`) &&
        !curBody.includes(`Closes ${org}/${issueRepo}#${issueNumber}`)
      ) {
        execGh(
          rt,
          [
            'pr',
            'edit',
            existingPrNum,
            '--repo',
            `${org}/${frontendRepo}`,
            '--body',
            `${curBody}${LF}${LF}Closes ${issueUrl}`,
          ],
          { allowFail: true }
        );
        rt.writeOut(`✅ Linked existing PR #${existingPrNum} to ${issueUrl}`);
      }
    } else {
      rt.writeErr(
        `⚠️ Warning: #${issueNumber} still has no linkedBranches or linkedPRs in Development.`
      );
    }
  }

  if (!noBoardUpdate) {
    const existingProjectItem = (
      verifyObj?.projectItems?.nodes ||
      issueObj?.projectItems?.nodes ||
      []
    ).find((n) => n?.project?.number === projectNumber);

    const existingStatusName =
      existingProjectItem?.fieldValueByName?.name || '';
    if (shouldPreserveBoardStatus(existingStatusName)) {
      rt.writeOut(
        `ℹ️ Ticket #${issueNumber} is already in '${existingStatusName}' on Project Board; preserving current status.`
      );
      return { skipped: false, issueNumber, targetBranch };
    }

    let itemId = existingProjectItem?.id || '';

    if (!itemId && projectId && issueObj.id) {
      const addMut = `
        mutation($project_id: ID!, $content_id: ID!) {
          addProjectV2ItemById(input: { projectId: $project_id, contentId: $content_id }) {
            item { id }
          }
        }
      `;
      itemId = execGh(
        rt,
        [
          'api',
          'graphql',
          '-f',
          `project_id=${projectId}`,
          '-f',
          `content_id=${issueObj.id}`,
          '-f',
          `query=${addMut}`,
          '--jq',
          '.data.addProjectV2ItemById.item.id',
        ],
        { allowFail: true }
      );
      rt.sleepSync(3000);
    }

    if (itemId && inProgressOptionId && inProgressOptionId !== 'null') {
      const upMut = `
        mutation($project_id: ID!, $item_id: ID!, $field_id: ID!, $option_id: String!) {
          updateProjectV2ItemFieldValue(
            input: { projectId: $project_id, itemId: $item_id, fieldId: $field_id, value: { singleSelectOptionId: $option_id } }
          ) { projectV2Item { id } }
        }
      `;
      let boardMoved = false;
      for (let attempt = 1; attempt <= 4; attempt++) {
        execGh(
          rt,
          [
            'api',
            'graphql',
            '-f',
            `project_id=${projectId}`,
            '-f',
            `item_id=${itemId}`,
            '-f',
            `field_id=${fieldId}`,
            '-f',
            `option_id=${inProgressOptionId}`,
            '-f',
            `query=${upMut}`,
          ],
          { allowFail: true, retries: 1 }
        );
        rt.sleepSync(2000);
        const actualOpt = execGh(
          rt,
          [
            'api',
            'graphql',
            '-f',
            `item_id=${itemId}`,
            '-f',
            'query=query($item_id: ID!) { node(id: $item_id) { ... on ProjectV2Item { fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { optionId } } } } }',
            '--jq',
            '.data.node.fieldValueByName.optionId // empty',
          ],
          { allowFail: true, retries: 1 }
        );
        if (actualOpt === inProgressOptionId) {
          boardMoved = true;
          break;
        }
      }
      if (boardMoved) {
        rt.writeOut(
          `✅ Ticket #${issueNumber} moved to In progress on Project Board`
        );
      } else {
        rt.writeErr(
          `⚠️ Warning: Could not confirm Project Board status update for Ticket #${issueNumber}`
        );
      }
    }
  }

  return { skipped: false, issueNumber, targetBranch };
}

function resolveDialect(dialectInput = 'none', argv = []) {
  let dialect = String(dialectInput || 'none')
    .trim()
    .toLowerCase();
  for (const arg of argv) {
    if (arg === '--claude' || arg === '--dialect=claude') {
      dialect = 'claude';
    } else if (arg === '--gemini' || arg === '--dialect=gemini') {
      dialect = 'gemini';
    } else if (arg === '--dialect=none') {
      dialect = 'none';
    }
  }
  if (!['none', 'claude', 'gemini'].includes(dialect)) {
    throw createCliError(`ERROR: Unsupported hook dialect '${dialect}'`, 2);
  }
  return dialect;
}

function emitHookOutcome(rt, dialect, { ok, healed = false, reason = '' }) {
  if (ok) {
    if (dialect === 'gemini') {
      rt.writeOut('{}');
      return { ok: true, healed, reason: '', exitCode: 0, output: `{}${LF}` };
    }
    return { ok: true, healed, reason: '', exitCode: 0, output: '' };
  }

  if (dialect === 'claude') {
    const payload = JSON.stringify({ decision: 'block', reason });
    rt.writeOut(payload);
    return {
      ok: false,
      healed: false,
      decision: 'block',
      reason,
      exitCode: 0,
      output: `${payload}${LF}`,
    };
  }

  if (dialect === 'gemini') {
    const payload = JSON.stringify({ decision: 'deny', reason });
    rt.writeOut(payload);
    return {
      ok: false,
      healed: false,
      decision: 'deny',
      reason,
      exitCode: 0,
      output: `${payload}${LF}`,
    };
  }

  rt.writeOut(reason);
  return {
    ok: false,
    healed: false,
    reason,
    exitCode: 1,
    output: `${reason}${LF}`,
  };
}

function hasGraphqlErrors(rawOutput = '') {
  const trimmed = String(rawOutput ?? '').trim();
  if (!trimmed.startsWith('{')) return false;
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed?.errors) && parsed.errors.length > 0;
  } catch {
    return false;
  }
}

/**
 * Verifies and self-heals:
 *  1. GitHub `Development` branch/PR link for the current ticket branch.
 *  2. Project V2 board status (`In progress` vs `PR Review`).
 *
 * When drift remains unhealed after self-heal retries, enforces the requested
 * hook dialect (`none` -> exit 1 + text, `claude` -> `{"decision":"block"}`,
 * `gemini` -> `{"decision":"deny"}`). Unrelated branches or lookup unavailability
 * always fail open so non-ticket work is never blocked.
 */
export function verifyAndHealBoardStatus(options = {}) {
  const rt = resolveRuntime(options);
  const dialect = resolveDialect(options.dialect, options.argv || []);

  try {
    const branch = execGit(rt, ['branch', '--show-current'], {
      allowFail: true,
    });
    if (
      !branch ||
      branch === 'develop' ||
      branch === 'main' ||
      branch === 'master'
    ) {
      return emitHookOutcome(rt, dialect, { ok: true });
    }

    const numMatch = branch.match(/(\d+)/);
    if (!numMatch) {
      return emitHookOutcome(rt, dialect, { ok: true });
    }
    const issueNumber = Number(numMatch[1]);

    let cfg;
    try {
      cfg = loadProjectConfig({
        ...options,
        port: rt.port,
        repoRoot: rt.repoRoot,
        env: rt.env,
        fs: rt.fsImpl,
      });
    } catch {
      return emitHookOutcome(rt, dialect, { ok: true });
    }

    const org = cfg.org;
    const trackerRepo = cfg.repos.tracker;
    const frontendRepo = cfg.repos.frontend;
    const projectNumber = Number(cfg.project.number);
    const projectId = cfg.project.id;
    const fieldId = cfg.fields.status.id;
    const inProgressOpt = cfg.fields.status.options.in_progress;
    const prReviewOpt = cfg.fields.status.options.pr_review;

    const openPrState = queryBranchOpenPrState({
      org,
      frontendRepo,
      targetBranch: branch,
      execGh: (args, ghOpts) => execGh(rt, args, ghOpts),
    });
    if (!openPrState.ok) {
      return emitHookOutcome(rt, dialect, { ok: true });
    }

    const openPrCount = openPrState.openPrCount || 0;
    const expectedOpt = openPrCount > 0 ? prReviewOpt : inProgressOpt;
    const expectedLabel = openPrCount > 0 ? 'PR Review' : 'In progress';

    let matchedRepo = trackerRepo;
    let issue = queryIssueState(rt, org, matchedRepo, issueNumber);
    if (!issue?.id && trackerRepo !== frontendRepo) {
      matchedRepo = frontendRepo;
      issue = queryIssueState(rt, org, matchedRepo, issueNumber);
    }
    if (!issue?.id) {
      return emitHookOutcome(rt, dialect, { ok: true });
    }

    let healed = false;
    const countLinks = (iss) =>
      (iss?.linkedBranches?.nodes || []).length +
      (iss?.closedByPullRequestsReferences?.nodes || []).length;

    if (countLinks(issue) === 0) {
      const silentBuffer = { write: () => {} };
      try {
        linkTicketBranch(
          [String(issueNumber), branch, '--no-checkout', '--no-board-update'],
          {
            ...options,
            port: rt.port,
            repoRoot: rt.repoRoot,
            env: rt.env,
            fs: rt.fsImpl,
            stdio: { stdout: silentBuffer, stderr: silentBuffer },
          }
        );
      } catch {}

      const refreshed = queryIssueState(rt, org, matchedRepo, issueNumber);
      if (refreshed?.id) {
        issue = refreshed;
      }
      if (countLinks(issue) === 0) {
        const reason = [
          `X-Tracker #${issueNumber} 的 Development 欄位尚未連結目前分支「${branch}」。請在結束前執行以下指令完成 Ticket 與 Branch 連結：`,
          '',
          `node .agents/scripts/link-ticket-branch.mjs "${issueNumber}" "${branch}" --no-checkout`,
        ].join(LF);
        return emitHookOutcome(rt, dialect, { ok: false, reason });
      }
      healed = true;
    }

    const pItem = (issue.projectItems?.nodes || []).find(
      (n) => n?.project?.number === projectNumber
    );
    let itemId = pItem?.id || '';
    const curLabel = pItem?.fieldValueByName?.name || '';
    const curOpt = pItem?.fieldValueByName?.optionId || '';

    if (shouldPreserveBoardStatus(curLabel)) {
      return emitHookOutcome(rt, dialect, { ok: true, healed });
    }
    if (openPrCount === 0 && curLabel === 'PR Review') {
      return emitHookOutcome(rt, dialect, { ok: true, healed });
    }
    if (curOpt === expectedOpt) {
      return emitHookOutcome(rt, dialect, { ok: true, healed });
    }

    if (!itemId && projectId) {
      const addMut =
        'mutation($project_id: ID!, $content_id: ID!) { addProjectV2ItemById(input: { projectId: $project_id, contentId: $content_id }) { item { id } } }';
      itemId = execGh(
        rt,
        [
          'api',
          'graphql',
          '-f',
          `project_id=${projectId}`,
          '-f',
          `content_id=${issue.id}`,
          '-f',
          `query=${addMut}`,
          '--jq',
          '.data.addProjectV2ItemById.item.id',
        ],
        { allowFail: true, retries: 1 }
      );
      if (itemId) {
        rt.sleepSync(3000);
      }
    }

    if (!itemId) {
      return emitHookOutcome(rt, dialect, { ok: true, healed });
    }

    const upMut =
      'mutation($project_id: ID!, $item_id: ID!, $field_id: ID!, $option_id: String!) { updateProjectV2ItemFieldValue(input: { projectId: $project_id, itemId: $item_id, fieldId: $field_id, value: { singleSelectOptionId: $option_id } }) { projectV2Item { id } } }';

    let statusHealed = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const mutRes = execGh(
          rt,
          [
            'api',
            'graphql',
            '-f',
            `project_id=${projectId}`,
            '-f',
            `item_id=${itemId}`,
            '-f',
            `field_id=${fieldId}`,
            '-f',
            `option_id=${expectedOpt}`,
            '-f',
            `query=${upMut}`,
          ],
          { allowFail: false, retries: 1 }
        );
        if (!hasGraphqlErrors(mutRes)) {
          statusHealed = true;
          break;
        }
      } catch {}
      if (attempt < 3) {
        rt.sleepSync(1000 * attempt);
      }
    }

    if (statusHealed) {
      return emitHookOutcome(rt, dialect, { ok: true, healed: true });
    }

    const displayActual = curLabel || '未設定';
    const reason = [
      `X-Tracker #${issueNumber} 的看板狀態還停在「${displayActual}」，但目前分支狀態顯示應該是「${expectedLabel}」。請在結束前執行以下 mutation 把狀態改過來，再結束這個 turn：`,
      '',
      `gh api graphql -F project_id="${projectId}" -F item_id="${itemId}" -F field_id="${fieldId}" -F option_id="${expectedOpt}" -f query='`,
      '  mutation($project_id: ID!, $item_id: ID!, $field_id: ID!, $option_id: String!) {',
      '    updateProjectV2ItemFieldValue(',
      '      input: { projectId: $project_id, itemId: $item_id, fieldId: $field_id, value: { singleSelectOptionId: $option_id } }',
      '    ) { projectV2Item { id } }',
      '  }',
      "'",
    ].join(LF);

    return emitHookOutcome(rt, dialect, { ok: false, reason });
  } catch {
    return emitHookOutcome(rt, dialect, { ok: true });
  }
}

export function parseGitHubRepoSlug(remoteUrl = '') {
  const clean = String(remoteUrl ?? '').trim();
  const match = clean.match(
    /^(?:git@github\.com:|ssh:\/\/(?:[^@/]+@)?github\.com\/|https?:\/\/(?:[^@/]+@)?github\.com\/)([^/\s:]+\/[^/\s]+?)(?:\.git)?\/?$/i
  );
  return match ? match[1] : '';
}

function formatEvidenceTimestamp(date) {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Publishes screenshot/evidence files to an orphan branch (`pr-evidence` by
 * default) using an isolated `GIT_INDEX_FILE`, building a fresh commit tree
 * (never running `git read-tree $ParentSha` so historical PR blobs never
 * accumulate), redacting credentials from all error messages, and retrying
 * concurrent pushes up to 6 times with jittered backoff.
 */
export async function publishEvidence(filesOrArgv = [], options = {}) {
  const rt = resolveRuntime(options);
  let dryRun = Boolean(options.dryRun);
  let explicitEvidenceBranch = options.evidenceBranch || '';
  const files = [];

  for (const item of filesOrArgv) {
    if (item === '--dry-run') {
      dryRun = true;
    } else if (item.startsWith('--branch=')) {
      explicitEvidenceBranch = item.slice('--branch='.length).trim();
    } else {
      files.push(item);
    }
  }

  if (files.length === 0) {
    throw createCliError(
      'Usage: tracker-ops.mjs publish-evidence [--dry-run] <file> [<file> ...]',
      2
    );
  }

  for (const filePath of files) {
    let isFile = false;
    try {
      isFile =
        rt.fsImpl.existsSync(filePath) &&
        rt.fsImpl.statSync(filePath).isFile();
    } catch {
      isFile = false;
    }
    if (!isFile) {
      throw createCliError(`ERROR: file not found: ${filePath}`, 1);
    }
  }

  const evidenceBranch =
    String(
      explicitEvidenceBranch || rt.env.EVIDENCE_BRANCH || 'pr-evidence'
    ).trim() || 'pr-evidence';

  const remoteUrl = execGit(rt, ['remote', 'get-url', 'origin']);
  const repoSlug = parseGitHubRepoSlug(remoteUrl);
  if (!repoSlug) {
    throw createCliError(
      `ERROR: could not resolve owner/repo from origin remote (${redactCredentials(remoteUrl)})`,
      1
    );
  }

  const branch =
    execGit(rt, ['branch', '--show-current'], { allowFail: true }) ||
    String(rt.env.GITHUB_HEAD_REF || '').trim();
  if (!branch) {
    throw createCliError('ERROR: not on a branch (detached HEAD)', 1);
  }

  const branchSlug = branch.replace(/\//g, '-');
  const prefix = `${branchSlug}/${formatEvidenceTimestamp(rt.now())}`;
  const randSuffix = Math.floor(rt.random() * 1e9);
  const scratchIndex = path.join(
    os.tmpdir(),
    `tracker-evidence-index-${process.pid}-${Date.now()}-${randSuffix}`
  );

  const configuredName = execGit(rt, ['config', 'user.name'], {
    allowFail: true,
  });
  const configuredEmail = execGit(rt, ['config', 'user.email'], {
    allowFail: true,
  });

  const indexEnv = {
    ...rt.env,
    GIT_INDEX_FILE: scratchIndex,
  };
  if (!configuredName && !indexEnv.GIT_AUTHOR_NAME) {
    indexEnv.GIT_AUTHOR_NAME = 'github-actions[bot]';
    indexEnv.GIT_COMMITTER_NAME = 'github-actions[bot]';
  }
  if (!configuredEmail && !indexEnv.GIT_AUTHOR_EMAIL) {
    indexEnv.GIT_AUTHOR_EMAIL =
      '41898282+github-actions[bot]@users.noreply.github.com';
    indexEnv.GIT_COMMITTER_EMAIL =
      '41898282+github-actions[bot]@users.noreply.github.com';
  }

  const markerContent = [
    'Evidence branch for PR screenshots, published by .agents/scripts/tracker-ops.mjs.',
    '',
    'This is an orphan branch: it shares no history with the repository code',
    'branches. Pull request bodies link into it by commit sha, so links stay',
    'stable even without accumulating previous PR trees on the branch tip.',
    '',
  ].join(LF);

  let commitSha = '';
  let newTree = '';
  let parentSha = '';
  let relPaths = [];

  try {
    for (let attempt = 1; attempt <= 6; attempt++) {
      try {
        rt.fsImpl.unlinkSync(scratchIndex);
      } catch {}

      parentSha = '';
      if (!dryRun) {
        try {
          execGit(rt, ['fetch', 'origin', evidenceBranch, '--depth=1']);
          parentSha = execGit(rt, ['rev-parse', 'FETCH_HEAD'], {
            allowFail: true,
          });
        } catch {
          parentSha = '';
        }
      }

      const markerBlob = execGit(rt, ['hash-object', '-w', '--stdin'], {
        input: markerContent,
        env: indexEnv,
      });
      execGit(
        rt,
        [
          'update-index',
          '--add',
          '--cacheinfo',
          '100644',
          markerBlob,
          '.pr-evidence',
        ],
        { env: indexEnv }
      );

      relPaths = [];
      for (let i = 0; i < files.length; i++) {
        const filePath = files[i];
        const blob = execGit(rt, ['hash-object', '-w', filePath], {
          env: indexEnv,
        });
        const filename = path.basename(filePath);
        const relPath = `${prefix}/${i}-${filename}`;
        execGit(
          rt,
          ['update-index', '--add', '--cacheinfo', '100644', blob, relPath],
          { env: indexEnv }
        );
        relPaths.push(relPath);
      }

      newTree = execGit(rt, ['write-tree'], { env: indexEnv });

      const commitArgs = parentSha
        ? ['commit-tree', newTree, '-p', parentSha]
        : ['commit-tree', newTree];
      commitSha = execGit(rt, commitArgs, {
        input: `evidence: ${branch}`,
        env: indexEnv,
      });

      if (dryRun) {
        break;
      }

      try {
        execGit(rt, [
          'push',
          'origin',
          `${commitSha}:refs/heads/${evidenceBranch}`,
        ]);
        break;
      } catch (pushErr) {
        const safeErr = redactCredentials(extractErrorDetail(pushErr));
        if (attempt === 6) {
          const suffix = safeErr ? `: ${safeErr}` : '';
          throw createCliError(
            `ERROR: failed to push to ${evidenceBranch} after 6 attempts${suffix}`,
            1
          );
        }
        const delaySeconds = Math.floor(rt.random() * 4) + attempt * 2;
        await rt.sleepAsync(delaySeconds * 1000);
      }
    }
  } finally {
    try {
      rt.fsImpl.unlinkSync(scratchIndex);
    } catch {}
  }

  const urls = relPaths.map(
    (relPath) =>
      `https://raw.githubusercontent.com/${repoSlug}/${commitSha}/${relPath}`
  );
  for (const url of urls) {
    rt.writeOut(url);
  }

  return {
    urls,
    commitSha,
    treeSha: newTree,
    parentSha,
    repoSlug,
    branch,
    dryRun,
  };
}

export function evaluatePollProgress(pr = {}) {
  const checks = Array.isArray(pr?.statusCheckRollup)
    ? pr.statusCheckRollup
    : [];
  if (checks.length === 0) {
    return { done: false, passed: 0, failed: 0, pending: 0, total: 0 };
  }

  let pending = 0;
  let failed = 0;
  let passed = 0;
  let hasAnyAiReview = false;
  let hasFinalSummary = false;

  for (const c of checks) {
    const name = String(c?.name || c?.context || '');
    const typename =
      c?.__typename ||
      (c?.context && !c?.status ? 'StatusContext' : 'CheckRun');
    const status = String(c?.status || '').toUpperCase();
    const state = String(c?.state || '').toUpperCase();
    const conc = String(c?.conclusion || '').toUpperCase();

    if (/AI Review/i.test(name)) {
      hasAnyAiReview = true;
    }
    if (name.includes('AI Review: Final Summary') && status === 'COMPLETED') {
      hasFinalSummary = true;
    }

    const isPending =
      typename === 'StatusContext'
        ? state === 'PENDING' || state === 'EXPECTED'
        : status !== 'COMPLETED';

    if (isPending) {
      pending++;
    } else if (
      conc === 'SUCCESS' ||
      conc === 'NEUTRAL' ||
      conc === 'SKIPPED' ||
      state === 'SUCCESS'
    ) {
      passed++;
    } else {
      failed++;
    }
  }

  const aiReviewSettled =
    hasFinalSummary || (!hasAnyAiReview && checks.length >= 5);

  return {
    done: pending === 0 && aiReviewSettled,
    passed,
    failed,
    pending,
    total: checks.length,
  };
}

function shaMatches(headSha, taggedSha) {
  const cleanHead = String(headSha || '')
    .trim()
    .toLowerCase();
  const cleanTag = String(taggedSha || '')
    .trim()
    .toLowerCase();
  if (!cleanHead || !cleanTag || cleanTag.length < 7) return false;
  return cleanHead.startsWith(cleanTag) || cleanTag.startsWith(cleanHead);
}

export function evaluateFinalPrConvergence(pr = {}, comments = []) {
  const checks = Array.isArray(pr?.statusCheckRollup)
    ? pr.statusCheckRollup
    : [];
  const safeComments = Array.isArray(comments) ? comments : [];
  const headSha = String(pr?.headRefOid || '')
    .trim()
    .toLowerCase();

  const quotaCommentMatchesHead = Boolean(
    headSha &&
    safeComments.some((c) => {
      const body = String(c?.body || '');
      const m = body.match(/<!--\s*vercel-quota-limit:sha=([^\s-]+)\s*-->/i);
      return Boolean(m && shaMatches(headSha, m[1]));
    })
  );

  let anyVercelQuotaExempted = quotaCommentMatchesHead;
  const failedChecks = [];

  for (const c of checks) {
    const name = String(c?.name || c?.context || 'unknown');
    const typename =
      c?.__typename ||
      (c?.context && !c?.status ? 'StatusContext' : 'CheckRun');
    const status = String(c?.status || '').toUpperCase();
    const state = String(c?.state || '').toUpperCase();
    const conc = String(c?.conclusion || '').toUpperCase();
    const desc = String(c?.description || c?.title || '');

    const isCompleted =
      typename === 'StatusContext'
        ? state !== 'PENDING' && state !== 'EXPECTED' && Boolean(state)
        : status === 'COMPLETED';
    const effectiveResult = typename === 'StatusContext' ? state : conc;

    const isDeployPrPreviewWorkflow = /deploy pr preview/i.test(name);
    const isNativeVercelStatusContext =
      typename === 'StatusContext' &&
      /vercel/i.test(name) &&
      !isDeployPrPreviewWorkflow;
    const nativeStatusReportsQuota =
      isNativeVercelStatusContext &&
      /api-deployments-free-per-day|Resource is limited/i.test(desc);

    if (nativeStatusReportsQuota) {
      anyVercelQuotaExempted = true;
    }

    if (!isCompleted) {
      if (
        isNativeVercelStatusContext &&
        (quotaCommentMatchesHead || nativeStatusReportsQuota)
      ) {
        continue;
      }
      failedChecks.push(`${name} (${status || state || 'PENDING'})`);
    } else if (!['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(effectiveResult)) {
      if (isDeployPrPreviewWorkflow && quotaCommentMatchesHead) {
        continue;
      }
      if (
        isNativeVercelStatusContext &&
        (quotaCommentMatchesHead || nativeStatusReportsQuota)
      ) {
        continue;
      }
      failedChecks.push(`${name} (${effectiveResult || 'FAILED'})`);
    }
  }

  const finalSummaryCheck = checks.find((c) =>
    String(c?.name || c?.context || '').includes('AI Review: Final Summary')
  );
  const finalSummarySkipped =
    Boolean(finalSummaryCheck) &&
    String(finalSummaryCheck.status || '').toUpperCase() === 'COMPLETED' &&
    String(finalSummaryCheck.conclusion || '').toUpperCase() === 'SKIPPED';

  const aiComment = [...safeComments].reverse().find((c) => {
    const login = String(c?.author?.login || '');
    const isBot = login === 'github-actions' || login === 'github-actions[bot]';
    const body = String(c?.body || '');
    if (!isBot || !body.includes('<!-- ai-review-pipeline -->')) return false;
    const shaTag = body.match(/<!--\s*ai-review-sha:([^\s-]+)\s*-->/i);
    if (shaTag && headSha) {
      return shaMatches(headSha, shaTag[1]);
    }
    return true;
  });

  let riskLevel = finalSummarySkipped ? 'low' : 'unknown';
  let findingsExcerpt = '';
  if (!finalSummarySkipped && aiComment?.body) {
    const body = String(aiComment.body);
    const riskMatch = body.match(/### ⚠️ Overall Risk\s+\*\*([a-zA-Z]+)\*\*/i);
    if (riskMatch) {
      riskLevel = riskMatch[1].toLowerCase();
    }
    if (riskLevel !== 'low') {
      findingsExcerpt = body.slice(0, 3500);
    }
  }

  const mergeable = String(pr?.mergeable || '');
  if (mergeable === 'CONFLICTING') {
    failedChecks.push('Merge Conflict against base branch (CONFLICTING)');
  }

  const converged =
    checks.length > 0 && failedChecks.length === 0 && riskLevel === 'low';

  return {
    totalChecks: checks.length,
    mergeable: mergeable || 'UNKNOWN',
    failedChecks,
    riskLevel,
    findingsExcerpt,
    vercelQuotaReached: anyVercelQuotaExempted,
    converged,
  };
}

function execGhJson(rt, args) {
  const raw = execGh(rt, args, { allowFail: true, retries: 1 });
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Polls PR checks & AI Review comments until settled and prints a token-compact
 * convergence summary (`CONVERGED=true` / `CONVERGED=false`).
 */
export async function waitPrChecks(argv = process.argv.slice(2), options = {}) {
  const rt = resolveRuntime(options);
  let cfg = null;
  try {
    cfg = loadProjectConfig({
      ...options,
      port: rt.port,
      repoRoot: rt.repoRoot,
      env: rt.env,
      fs: rt.fsImpl,
    });
  } catch {}

  const org = String(rt.env.ORG || cfg?.org || 'Xchange-Taiwan').trim();
  const frontendRepo = String(
    rt.env.FRONTEND_REPO || cfg?.repos?.frontend || 'X-Talent-Frontend'
  ).trim();
  const repoSlug = `${org}/${frontendRepo}`;
  const prArg = argv[0] ? String(argv[0]).trim() : '';

  const viewNumArgs = prArg
    ? ['pr', 'view', prArg, '--repo', repoSlug, '--json', 'number']
    : ['pr', 'view', '--repo', repoSlug, '--json', 'number'];
  const numObj = execGhJson(rt, viewNumArgs);
  const prNumber = numObj?.number ? String(numObj.number) : '';

  if (!prNumber) {
    throw createCliError(
      'ERROR: Could not resolve open PR number. Run /submit-pr first.',
      1
    );
  }

  const maxPolls = Math.max(1, Number(options.maxPolls) || 60);
  const pollIntervalMs =
    options.pollIntervalMs !== undefined
      ? Number(options.pollIntervalMs)
      : 15000;

  let latestPr = null;
  for (let i = 1; i <= maxPolls; i++) {
    const fetched = execGhJson(rt, [
      'pr',
      'view',
      prNumber,
      '--repo',
      repoSlug,
      '--json',
      'headRefName,headRefOid,state,mergeable,labels,statusCheckRollup',
    ]);
    if (fetched) {
      latestPr = fetched;
      const progress = evaluatePollProgress(latestPr);
      if (progress.done) {
        break;
      }
    }
    if (i < maxPolls) {
      await rt.sleepAsync(pollIntervalMs);
    }
  }

  const commentsObj = execGhJson(rt, [
    'pr',
    'view',
    prNumber,
    '--repo',
    repoSlug,
    '--json',
    'comments',
  ]);
  const result = evaluateFinalPrConvergence(
    latestPr || {},
    commentsObj?.comments || []
  );

  rt.writeOut(`=== PR #${prNumber} CI & AI REVIEW SUMMARY ===`);
  rt.writeOut(
    `Total checks: ${result.totalChecks} | Mergeable: ${result.mergeable} | Failed: ${result.failedChecks.length} | AI Review Overall Risk: ${result.riskLevel} | VercelQuotaLimit: ${result.vercelQuotaReached}`
  );
  if (result.vercelQuotaReached) {
    rt.writeOut('VERCEL_LIMIT=true');
  }
  if (result.failedChecks.length > 0) {
    rt.writeOut(
      `Failed checks:${LF}  - ${result.failedChecks.join(`${LF}  - `)}`
    );
  }
  if (result.converged) {
    rt.writeOut('CONVERGED=true');
    rt.writeOut(
      '✅ All CI checks passed and AI Review risk is low. No fixes needed!'
    );
  } else {
    rt.writeOut('CONVERGED=false');
    if (result.findingsExcerpt) {
      rt.writeOut(
        `${LF}=== AI REVIEW FINDINGS ===${LF}${result.findingsExcerpt}`
      );
    }
  }

  return result;
}

export const runWaitPrChecksCli = waitPrChecks;

export async function runTrackerOpsCli(
  argv = process.argv.slice(2),
  options = {}
) {
  const rt = resolveRuntime(options);
  const [subcommand = '', ...rest] = argv;

  try {
    if (subcommand === 'load-config') {
      let format = 'json';
      for (const arg of rest) {
        if (arg.startsWith('--format=')) {
          format = arg.slice('--format='.length).trim().toLowerCase();
        } else if (arg === '--sh') {
          format = 'sh';
        } else if (arg === '--ps1') {
          format = 'ps1';
        }
      }
      const cfg = loadProjectConfig({
        ...options,
        port: rt.port,
        repoRoot: rt.repoRoot,
        env: rt.env,
        fs: rt.fsImpl,
      });
      if (format === 'sh') {
        rt.writeOut(formatShellConfigExports(cfg));
      } else if (format === 'ps1') {
        rt.writeOut(formatPowerShellConfigExports(cfg));
      } else if (format === 'json') {
        rt.writeOut(JSON.stringify(cfg, null, 2));
      } else {
        throw createCliError(
          `ERROR: Unsupported load-config format '${format}'`,
          2
        );
      }
      return { exitCode: 0 };
    }

    if (subcommand === 'link-ticket-branch') {
      linkTicketBranch(rest, {
        ...options,
        port: rt.port,
        repoRoot: rt.repoRoot,
        env: rt.env,
        fs: rt.fsImpl,
        stdio: { stdout: rt.stdout, stderr: rt.stderr },
      });
      return { exitCode: 0 };
    }

    if (
      subcommand === 'verify-board-status' ||
      subcommand === 'check-board-status'
    ) {
      const outcome = verifyAndHealBoardStatus({
        ...options,
        argv: rest,
        port: rt.port,
        repoRoot: rt.repoRoot,
        env: rt.env,
        fs: rt.fsImpl,
        stdio: { stdout: rt.stdout, stderr: rt.stderr },
      });
      return { exitCode: outcome.exitCode };
    }

    if (subcommand === 'publish-evidence') {
      await publishEvidence(rest, {
        ...options,
        port: rt.port,
        repoRoot: rt.repoRoot,
        env: rt.env,
        fs: rt.fsImpl,
        stdio: { stdout: rt.stdout, stderr: rt.stderr },
      });
      return { exitCode: 0 };
    }

    if (subcommand === 'wait-pr-checks') {
      await waitPrChecks(rest, {
        ...options,
        port: rt.port,
        repoRoot: rt.repoRoot,
        env: rt.env,
        fs: rt.fsImpl,
        stdio: { stdout: rt.stdout, stderr: rt.stderr },
      });
      return { exitCode: 0 };
    }

    throw createCliError(
      'Usage: tracker-ops.mjs <load-config|link-ticket-branch|verify-board-status|publish-evidence|wait-pr-checks> [args...]',
      2
    );
  } catch (err) {
    const msg = redactCredentials(err?.message || String(err));
    rt.writeErr(msg);
    return { exitCode: err?.exitCode || 1 };
  }
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  runTrackerOpsCli().then(({ exitCode }) => {
    if (exitCode !== 0) {
      process.exit(exitCode);
    }
  });
}
