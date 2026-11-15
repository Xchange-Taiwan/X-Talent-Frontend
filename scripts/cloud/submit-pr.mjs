import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  createDefaultCommandPort,
  linkTicketBranch,
  publishEvidence,
  redactCredentials,
  verifyAndHealBoardStatus,
} from '../../.agents/scripts/tracker-ops.mjs';
import { runGeneratePrDescription } from '../generate-pr-description.mjs';
import {
  cleanupCloudTempFiles,
  unstageCloudWorkspaceLocks,
} from './workspace-guard.mjs';

const LF = String.fromCharCode(10);
const CR = String.fromCharCode(13);

function splitLines(raw = '') {
  return String(raw ?? '')
    .replaceAll(CR, '')
    .split(LF);
}

function createNoopStream() {
  return { write: () => true };
}

export function parseSubmitPrArgs(argv = [], env = process.env) {
  let mode = 'implement';
  let rawTicket = String(env?.TICKET_NUMBER || '');
  let rawPr = String(env?.PR_NUMBER || '');
  let draftFlag = String(env?.CLOUD_PR_DRAFT ?? 'true');

  for (const arg of argv) {
    const trimmed = String(arg || '').trim();
    if (trimmed === 'implement' || trimmed === 'fix-pr') {
      mode = trimmed;
    } else if (trimmed.startsWith('--mode=')) {
      const m = trimmed.slice('--mode='.length).trim();
      if (m === 'implement' || m === 'fix-pr') {
        mode = m;
      }
    } else if (trimmed.startsWith('--ticket=')) {
      rawTicket = trimmed.slice('--ticket='.length);
    } else if (trimmed.startsWith('--pr=')) {
      rawPr = trimmed.slice('--pr='.length);
    } else if (trimmed.startsWith('--draft=')) {
      draftFlag = trimmed.slice('--draft='.length);
    }
  }

  return {
    mode,
    ticketNumber: String(rawTicket).replace(/\D+/g, ''),
    prNumber: String(rawPr).replace(/\D+/g, ''),
    cloudPrDraft: String(draftFlag).toLowerCase().trim() !== 'false',
  };
}

export function extractIssueTitleFromBundleOrSpec(
  bundle = null,
  specText = ''
) {
  if (bundle?.issue?.title && String(bundle.issue.title).trim()) {
    return String(bundle.issue.title).trim();
  }
  for (const line of splitLines(specText)) {
    if (line.toLowerCase().startsWith('title:')) {
      return line.slice('title:'.length).trim();
    }
  }
  return '';
}

function isPrintableAscii(str = '') {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x20 || code > 0x7e) {
      return false;
    }
  }
  return true;
}

export function inferCommitTypeAndScope({
  branch = '',
  rawIssueTitle = '',
  stagedFiles = [],
} = {}) {
  let type = 'feat';
  if (branch.startsWith('fix/') || /\[bug\]/i.test(rawIssueTitle)) {
    type = 'fix';
  } else if (
    branch.startsWith('refactor/') ||
    /\[refactor\]/i.test(rawIssueTitle)
  ) {
    type = 'refactor';
  } else if (branch.startsWith('chore/') || /\[chore\]/i.test(rawIssueTitle)) {
    type = 'chore';
  } else if (branch.startsWith('test/') || /\[test\]/i.test(rawIssueTitle)) {
    type = 'test';
  }

  let scope = 'ui';
  if (stagedFiles.some((f) => f.includes('notification'))) {
    scope = 'notification';
  } else if (stagedFiles.some((f) => f.includes('mentor-pool'))) {
    scope = 'mentor-pool';
  } else if (stagedFiles.some((f) => f.includes('reservation'))) {
    scope = 'reservation';
  } else if (stagedFiles.some((f) => f.includes('profile'))) {
    scope = 'profile';
  } else if (stagedFiles.some((f) => f.includes('onboarding'))) {
    scope = 'onboarding';
  } else if (stagedFiles.some((f) => f.includes('auth'))) {
    scope = 'auth';
  } else if (
    stagedFiles.length > 0 &&
    stagedFiles.every(
      (f) =>
        f.endsWith('.stories.tsx') ||
        f.endsWith('.test.tsx') ||
        f.endsWith('.test.ts')
    )
  ) {
    scope = 'storybook';
  } else if (
    stagedFiles.length > 0 &&
    stagedFiles.every(
      (f) =>
        f.startsWith('scripts/') ||
        f.startsWith('.github/') ||
        f.startsWith('.agents/')
    )
  ) {
    scope = 'ci';
  }

  return { type, scope };
}

export function buildPhase3CommitMessage({
  ticket = '',
  branch = '',
  rawIssueTitle = '',
  stagedFiles = [],
  evidenceUrls = [],
} = {}) {
  const cleanedIssueTitle = String(rawIssueTitle || '')
    .replace(/^(\[[^\]]+\]\s*)+/, '')
    .trim();
  const { type, scope } = inferCommitTypeAndScope({
    branch,
    rawIssueTitle,
    stagedFiles,
  });

  const slug = String(branch || '')
    .replace(/^(feat|fix|chore|refactor|test)\//, '')
    .replace(/^\d+-/, '')
    .replace(/-/g, ' ')
    .trim();

  const useIssueTitle =
    cleanedIssueTitle.length > 0 &&
    cleanedIssueTitle.length <= 72 &&
    isPrintableAscii(cleanedIssueTitle);

  const rawDesc = useIssueTitle
    ? cleanedIssueTitle.charAt(0).toLowerCase() + cleanedIssueTitle.slice(1)
    : slug || 'implement ticket requirements';

  const ticketTag = ticket ? ` (#${ticket})` : '';
  const subject = `${type}(${scope}): ${rawDesc}${ticketTag}`;

  const bodyLines = ['Updated files:'];
  for (const filePath of stagedFiles.slice(0, 25)) {
    bodyLines.push(`- ${filePath}`);
  }
  if (stagedFiles.length > 25) {
    bodyLines.push(`- ...and ${stagedFiles.length - 25} more files`);
  }
  if (evidenceUrls.length > 0) {
    bodyLines.push('', 'Published UI evidence:');
    for (const url of evidenceUrls) {
      bodyLines.push(`- ${url}`);
    }
  }

  return `${subject}${LF}${LF}${bodyLines.join(LF)}${LF}`;
}

function collectEvidenceFiles(evidenceDir, fsImpl) {
  if (!evidenceDir || !fsImpl.existsSync(evidenceDir)) {
    return [];
  }
  try {
    return fsImpl
      .readdirSync(evidenceDir)
      .filter((name) => /\.(png|jpe?g|webp)$/i.test(name))
      .sort()
      .map((name) => path.join(evidenceDir, name))
      .filter((fullPath) => {
        try {
          return fsImpl.statSync(fullPath).isFile();
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
}

export async function submitCloudPr(rawOptions = {}) {
  const cwd = path.resolve(rawOptions.cwd || process.cwd());
  const env = rawOptions.env || process.env;
  const fsImpl = rawOptions.fsImpl || fs;
  const port =
    rawOptions.port || createDefaultCommandPort({ repoRoot: cwd, env });
  const fetchImpl = rawOptions.fetch || rawOptions.fetchImpl || fetch;

  const parsedArgs = Array.isArray(rawOptions.argv)
    ? parseSubmitPrArgs(rawOptions.argv, env)
    : parseSubmitPrArgs([], env);

  const mode = rawOptions.mode || parsedArgs.mode || 'implement';
  let cleanTicket = String(
    rawOptions.ticketNumber ?? parsedArgs.ticketNumber ?? ''
  ).replace(/\D+/g, '');
  const cleanPr = String(
    rawOptions.prNumber ?? parsedArgs.prNumber ?? ''
  ).replace(/\D+/g, '');
  const cloudPrDraft =
    rawOptions.cloudPrDraft !== undefined
      ? Boolean(rawOptions.cloudPrDraft)
      : parsedArgs.cloudPrDraft;

  const linkBranchFn = rawOptions.linkTicketBranchImpl || linkTicketBranch;
  const publishEvidenceFn = rawOptions.publishEvidenceImpl || publishEvidence;
  const verifyBoardFn =
    rawOptions.verifyBoardStatusImpl || verifyAndHealBoardStatus;
  const generatePrDescriptionFn =
    rawOptions.generatePrDescriptionImpl || runGeneratePrDescription;

  const quietStdio = rawOptions.stdio || {
    stdout: createNoopStream(),
    stderr: createNoopStream(),
  };

  const execGit = (args, { allowFail = false, input } = {}) => {
    try {
      return String(port.git(args, { cwd, env, input }) ?? '').trim();
    } catch (err) {
      if (allowFail) return '';
      throw err;
    }
  };

  const execGh = (args, { allowFail = false, input } = {}) => {
    try {
      return String(port.gh(args, { cwd, env, input }) ?? '').trim();
    } catch (err) {
      if (allowFail) return '';
      throw err;
    }
  };

  const summaryPath = path.join(cwd, '.agents/tmp/cloud-converge-summary.md');
  const bundlePath = path.join(cwd, '.agents/tmp/ticket-bundle.json');
  const specPath = path.join(cwd, '.agents/tmp/ticket-spec.md');

  const summaryText = fsImpl.existsSync(summaryPath)
    ? fsImpl.readFileSync(summaryPath, 'utf8').trim()
    : '';

  let ticketBundle = null;
  if (fsImpl.existsSync(bundlePath)) {
    try {
      ticketBundle = JSON.parse(fsImpl.readFileSync(bundlePath, 'utf8'));
    } catch {
      ticketBundle = null;
    }
  }

  const specText = fsImpl.existsSync(specPath)
    ? fsImpl.readFileSync(specPath, 'utf8')
    : '';

  try {
    // 1. Validate / link feature branch
    let currentBranch = execGit(['branch', '--show-current'], {
      allowFail: true,
    });
    if (mode === 'implement') {
      if (
        !currentBranch ||
        currentBranch === 'develop' ||
        currentBranch === 'main'
      ) {
        if (cleanTicket) {
          try {
            linkBranchFn([cleanTicket], {
              port,
              repoRoot: cwd,
              env,
              fs: fsImpl,
              stdio: quietStdio,
            });
          } catch {}
          currentBranch = execGit(['branch', '--show-current'], {
            allowFail: true,
          });
        }
      } else if (cleanTicket) {
        try {
          linkBranchFn(
            [cleanTicket, currentBranch, '--no-checkout', '--no-board-update'],
            {
              port,
              repoRoot: cwd,
              env,
              fs: fsImpl,
              stdio: quietStdio,
            }
          );
        } catch {}
      }
    }

    if (
      !currentBranch ||
      currentBranch === 'develop' ||
      currentBranch === 'main'
    ) {
      throw new Error(
        `Refusing to run Phase 3 directly on branch '${currentBranch || 'detached'}'.`
      );
    }

    // 2. Publish captured UI evidence screenshots
    let evidenceUrls = [];
    const evidenceDir = path.join(cwd, '.agents/tmp/evidence');
    const evidenceFiles = collectEvidenceFiles(evidenceDir, fsImpl);
    if (evidenceFiles.length > 0) {
      try {
        const pubRes = await publishEvidenceFn(evidenceFiles, {
          port,
          repoRoot: cwd,
          env,
          fs: fsImpl,
          stdio: quietStdio,
        });
        if (Array.isArray(pubRes?.urls)) {
          evidenceUrls = pubRes.urls
            .map((u) => String(u || '').trim())
            .filter((u) => u.startsWith('https://'));
        }
      } catch {}
    }

    // 3. Clean temporary cloud files and restore skip-worktree files
    cleanupCloudTempFiles({ cwd, fsImpl, removeAgentsTmp: true });
    unstageCloudWorkspaceLocks({
      cwd,
      env,
      port,
      restoreWorktree: true,
    });

    // 4. Commit any uncommitted working-tree changes
    execGit(['add', '-A']);
    unstageCloudWorkspaceLocks({
      cwd,
      env,
      port,
      restoreWorktree: true,
    });

    const stagedFiles = splitLines(
      execGit(['diff', '--cached', '--name-only'], { allowFail: true })
    )
      .map((s) => s.trim())
      .filter(Boolean);

    let committed = false;
    let commitMessage = '';
    if (stagedFiles.length > 0) {
      const rawIssueTitle = extractIssueTitleFromBundleOrSpec(
        ticketBundle,
        specText
      );
      commitMessage = buildPhase3CommitMessage({
        ticket: cleanTicket,
        branch: currentBranch,
        rawIssueTitle,
        stagedFiles,
        evidenceUrls,
      });
      execGit(['commit', '-F', '-'], { input: commitMessage });
      committed = true;
    }

    // 5. Resolve existing open PR, fetch baseRef, verify ahead count, and push
    let existingPr = cleanPr;
    if (!existingPr) {
      const listRaw = execGh(
        [
          'pr',
          'list',
          '--head',
          currentBranch,
          '--state',
          'open',
          '--json',
          'number',
        ],
        { allowFail: true }
      );
      if (listRaw) {
        try {
          const listArr = JSON.parse(listRaw);
          if (Array.isArray(listArr) && listArr[0]?.number) {
            existingPr = String(listArr[0].number);
          }
        } catch {}
      }
    }

    let existingBaseRef = 'develop';
    let existingBody = '';
    let metaLoaded = false;
    if (existingPr) {
      const metaRaw = execGh(
        ['pr', 'view', existingPr, '--json', 'title,body,baseRefName'],
        { allowFail: true }
      );
      if (metaRaw) {
        try {
          const meta = JSON.parse(metaRaw);
          if (meta && typeof meta === 'object') {
            metaLoaded = true;
            existingBody = String(meta.body ?? '');
            existingBaseRef =
              String(meta.baseRefName || 'develop').trim() || 'develop';
            if (!cleanTicket) {
              const combined = `${meta.title || ''}${LF}${existingBody}`;
              const m = combined.match(
                /X-Talent-Tracker\/issues\/(\d+)|\(X-Tracker\s*#(\d+)\)/i
              );
              cleanTicket = m?.[1] || m?.[2] || '';
            }
          }
        } catch {}
      }
    }

    execGit(['fetch', 'origin', existingBaseRef, '--quiet'], {
      allowFail: true,
    });

    if (mode === 'implement' && !existingPr) {
      const aheadRaw = execGit(
        ['rev-list', '--count', `origin/${existingBaseRef}..HEAD`],
        { allowFail: true }
      );
      const aheadCount = Number.parseInt(aheadRaw || '0', 10) || 0;
      if (aheadCount <= 0) {
        throw new Error(
          `Branch '${currentBranch}' has 0 commits ahead of origin/${existingBaseRef}; refusing to open empty PR.`
        );
      }
      try {
        execGit(['push', '-u', 'origin', currentBranch]);
      } catch {
        execGit(['push', '--force-with-lease', '-u', 'origin', currentBranch]);
      }
    } else {
      try {
        execGit(['push', '-u', 'origin', currentBranch]);
      } catch {
        execGit(['pull', '--rebase', 'origin', currentBranch]);
        execGit(['push', '-u', 'origin', currentBranch]);
      }
    }

    // 6. Generate PR description and create or update Pull Request
    const lastSubject = execGit(['log', '-1', '--format=%s'], {
      allowFail: true,
    });

    const { title: prTitle, body: prBody } = await generatePrDescriptionFn({
      ticket: cleanTicket,
      branch: currentBranch,
      lastSubject,
      bundle: ticketBundle,
      bundleFile: '',
      rawSpec: specText,
      summaryText,
      evidenceUrls,
      existingBody,
      baseRef: `origin/${existingBaseRef}`,
      port,
      cwd,
      env,
      fsImpl,
      fetchImpl,
    });

    let prAction = 'none';
    let prUrl = '';
    if (!existingPr && mode === 'implement') {
      const createArgs = [
        'pr',
        'create',
        ...(cloudPrDraft ? ['--draft'] : []),
        '--base',
        existingBaseRef,
        '--head',
        currentBranch,
        '--title',
        prTitle,
        '--body-file',
        '-',
      ];
      prUrl = execGh(createArgs, { input: prBody });
      prAction = 'created';
    } else if (existingPr) {
      if (mode === 'implement') {
        execGh(
          ['pr', 'edit', existingPr, '--title', prTitle, '--body-file', '-'],
          { allowFail: true, input: prBody }
        );
        prAction = 'updated';
      } else if (metaLoaded) {
        execGh(['pr', 'edit', existingPr, '--body-file', '-'], {
          allowFail: true,
          input: prBody,
        });
        prAction = 'updated';
      }
    }

    if (mode === 'implement') {
      try {
        verifyBoardFn({
          dialect: 'claude',
          port,
          repoRoot: cwd,
          env,
          fs: fsImpl,
          stdio: quietStdio,
        });
      } catch {}
    }

    return {
      branch: currentBranch,
      ticketNumber: cleanTicket,
      existingPr,
      prAction,
      prUrl,
      prTitle,
      prBody,
      committed,
      commitMessage,
      stagedFiles,
      evidenceUrls,
    };
  } finally {
    cleanupCloudTempFiles({ cwd, fsImpl, removeAgentsTmp: false });
  }
}

const isMainModule =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  submitCloudPr({ argv: process.argv.slice(2) }).catch((err) => {
    const safeMsg = redactCredentials(err?.message || String(err));
    process.stderr.write(`::error::${safeMsg}${LF}`);
    process.exit(1);
  });
}
