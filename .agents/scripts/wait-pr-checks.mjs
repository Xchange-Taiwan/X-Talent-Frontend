#!/usr/bin/env node
/**
 * Cross-platform PR check & AI Review convergence waiter used by both
 * `.agents/scripts/wait-pr-checks.sh` and `.agents/scripts/wait-pr-checks.ps1`.
 *
 * Exports pure evaluation helpers (`evaluatePollProgress` and
 * `evaluateFinalPrConvergence`) so every edge case is unit-tested in Vitest.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
      c?.__typename || (c?.context && !c?.status ? 'StatusContext' : 'CheckRun');
    const status = String(c?.status || '').toUpperCase();
    const state = String(c?.state || '').toUpperCase();
    const conc = String(c?.conclusion || '').toUpperCase();

    if (/AI Review/i.test(name)) {
      hasAnyAiReview = true;
    }
    if (
      name.includes('AI Review: Final Summary') &&
      status === 'COMPLETED'
    ) {
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

  // Strictly match `<!-- vercel-quota-limit:sha=<HEAD_SHA> -->` emitted by
  // `deploy-pr.yml` ONLY AFTER `vercel build` (`next build`) succeeded on this exact commit.
  const quotaCommentMatchesHead = Boolean(
    headSha &&
      safeComments.some((c) => {
        const body = String(c?.body || '');
        const m = body.match(
          /<!--\s*vercel-quota-limit:sha=([^\s-]+)\s*-->/i
        );
        return Boolean(m && shaMatches(headSha, m[1]));
      })
  );

  let anyVercelQuotaExempted = quotaCommentMatchesHead;
  const failedChecks = [];

  for (const c of checks) {
    const name = String(c?.name || c?.context || 'unknown');
    const typename =
      c?.__typename || (c?.context && !c?.status ? 'StatusContext' : 'CheckRun');
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
      // GitHub Actions `Deploy PR Preview` is ONLY exempted when `quotaCommentMatchesHead`
      // is true (proving `vercel build` / `next build` passed on this exact HEAD_SHA).
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
    const isBot =
      login === 'github-actions' || login === 'github-actions[bot]';
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

function loadRepoDefaults() {
  try {
    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    const cfgPath = path.resolve(scriptDir, '..', 'project-config.json');
    const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    return {
      org: process.env.ORG || raw.org || 'Xchange-Taiwan',
      frontendRepo:
        process.env.FRONTEND_REPO || raw.repos?.frontend || 'X-Talent-Frontend',
    };
  } catch {
    return {
      org: process.env.ORG || 'Xchange-Taiwan',
      frontendRepo: process.env.FRONTEND_REPO || 'X-Talent-Frontend',
    };
  }
}

function execGhJson(args) {
  try {
    const out = execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(out);
  } catch {
    return null;
  }
}

function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runWaitPrChecksCli(argv = process.argv.slice(2)) {
  const { org, frontendRepo } = loadRepoDefaults();
  const repoSlug = `${org}/${frontendRepo}`;
  const prArg = argv[0] ? String(argv[0]).trim() : '';

  const viewNumArgs = prArg
    ? ['pr', 'view', prArg, '--repo', repoSlug, '--json', 'number']
    : ['pr', 'view', '--repo', repoSlug, '--json', 'number'];
  const numObj = execGhJson(viewNumArgs);
  const prNumber = numObj?.number ? String(numObj.number) : '';

  if (!prNumber) {
    console.error(
      'ERROR: Could not resolve open PR number. Run /submit-pr first.'
    );
    process.exit(1);
  }

  let latestPr = null;
  for (let i = 1; i <= 60; i++) {
    const fetched = execGhJson([
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
    if (i < 60) {
      await sleepMs(15000);
    }
  }

  const commentsObj = execGhJson([
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

  console.log(`=== PR #${prNumber} CI & AI REVIEW SUMMARY ===`);
  console.log(
    `Total checks: ${result.totalChecks} | Mergeable: ${result.mergeable} | Failed: ${result.failedChecks.length} | AI Review Overall Risk: ${result.riskLevel} | VercelQuotaLimit: ${result.vercelQuotaReached}`
  );
  if (result.vercelQuotaReached) {
    console.log('VERCEL_LIMIT=true');
  }
  if (result.failedChecks.length > 0) {
    console.log('Failed checks:\n  - ' + result.failedChecks.join('\n  - '));
  }
  if (result.converged) {
    console.log('CONVERGED=true');
    console.log(
      '✅ All CI checks passed and AI Review risk is low. No fixes needed!'
    );
  } else {
    console.log('CONVERGED=false');
    if (result.findingsExcerpt) {
      console.log('\n=== AI REVIEW FINDINGS ===\n' + result.findingsExcerpt);
    }
  }
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  runWaitPrChecksCli().catch((err) => {
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
  });
}
