#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

import { config } from 'dotenv';

import { getDiff } from '../ai-review/lib/diff.mjs';
import { buildPrompt } from '../ai-review/lib/prompt.mjs';
import {
  autoFixAndLintStaged,
  captureTypeCheckBaseline,
  ChecksError,
  diffTypeCheckErrors,
  verifyRequiredScripts,
} from './lib/checks.mjs';
import {
  callGeminiAgent,
  extractFunctionCalls,
  functionResponseTurn,
  modelTurnFromCandidate,
  userTurn,
} from './lib/gemini-agent.mjs';
import {
  commitWip,
  currentBranch,
  GitError,
  hasStagedChanges,
  isWorkingTreeClean,
  mergeBase,
  parseOwnerRepo,
  remoteOriginUrl,
  resetSoft,
  stageAll,
  updateDevelopFastForward,
} from './lib/git.mjs';
import { killActiveChildren } from './lib/proc.mjs';
import { reviewDiff } from './lib/review-bridge.mjs';
import { setupTicketBranch, TicketError } from './lib/ticket-branch.mjs';
import {
  executeTool,
  FileTooLargeError,
  SUBMIT_FOR_REVIEW_TOOL,
  TOOL_DECLARATIONS,
} from './lib/tools.mjs';

config();
config({ path: '.env.development.local', override: true });

const MAX_ITERATIONS = 10;
const MAX_TURNS_PER_ITERATION = 40;
// When this few turns remain, nudge the agent to wrap up instead of letting
// it keep investigating until the hard cutoff.
const WRAP_UP_WARNING_TURNS_REMAINING = 5;
const EXPECTED_ORG = 'Xchange-Taiwan';
const SYSTEM_PROMPT_URL = new URL(
  './prompts/dev-agent-system.md',
  import.meta.url
);

let hasCommittedThisRun = false;
let resolvedBaseRef = null;

function log(msg) {
  console.log(`[ai:dev] ${msg}`);
}

function fail(message) {
  console.error(`[ai:dev] ${message}`);
  process.exitCode = 1;
}

function registerSignalHandler() {
  process.on('SIGINT', () => {
    console.log('\n[ai:dev] interrupted.');
    killActiveChildren();
    if (hasCommittedThisRun && resolvedBaseRef) {
      console.log(
        `[ai:dev] progress is saved as local WIP commits. To take over:\n  git reset --soft ${resolvedBaseRef}`
      );
    } else {
      console.log(
        '[ai:dev] no WIP commit exists yet for this iteration — check `git status`; any uncommitted ' +
          'changes are still in your working tree (`git stash` if you want to set them aside).'
      );
    }
    process.exit(130);
  });
}

async function preflight() {
  try {
    execFileSync('gh', ['--version'], { stdio: 'ignore' });
  } catch {
    throw new Error('`gh` CLI not found. Install it: https://cli.github.com/');
  }
  try {
    execFileSync('gh', ['auth', 'status'], { stdio: 'ignore' });
  } catch {
    throw new Error(
      '`gh` is not authenticated. Run `gh auth login` (and `gh auth refresh -s project,read:project`).'
    );
  }
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      'GEMINI_API_KEY is not set. Add it to .env — see .env.example.'
    );
  }

  verifyRequiredScripts();

  if (!isWorkingTreeClean()) {
    throw new Error(
      'Working tree has uncommitted changes. Commit or `git stash` before running ai:dev.'
    );
  }

  const { owner } = parseOwnerRepo(remoteOriginUrl());
  if (owner !== EXPECTED_ORG) {
    throw new Error(
      `\`origin\` remote points to "${owner}", not "${EXPECTED_ORG}" — ai:dev does not support fork-based workflows yet.`
    );
  }
}

function buildDevAgentSystemPrompt(ticket) {
  const commentsText = ticket.comments.length
    ? ticket.comments.map((c) => `- ${c.author}: ${c.body}`).join('\n')
    : '(無留言)';
  const ticketSection = [
    `**#${ticket.number} ${ticket.title}**`,
    '',
    ticket.body,
    '',
    '### Comments',
    commentsText,
  ].join('\n');
  return buildPrompt(SYSTEM_PROMPT_URL, { TICKET_SECTION: ticketSection });
}

function buildRetryTask({ baseRef, failureText, reviewFindings }) {
  const { diff, truncated } = getDiff(baseRef);
  const sections = [
    `## 目前累積的完整 Diff${truncated ? '（已截斷）' : ''}`,
    '```diff\n' + diff + '\n```',
  ];
  if (failureText) {
    sections.push('## 需要修正的問題（lint / type-check）', failureText);
  }
  if (reviewFindings) {
    sections.push(
      '## Reviewer Findings（overall risk: high，需要修正）',
      JSON.stringify(reviewFindings, null, 2)
    );
  }
  sections.push('請根據上面的資訊修正問題，完成後呼叫 submitForReview。');
  return sections.join('\n\n');
}

/**
 * Runs the dev agent until it calls submitForReview (or the per-iteration
 * turn cap is hit). Fresh `contents` every call — Round 2: no cross-iteration
 * history, only the current diff/findings carry state forward.
 *
 * Never throws on running out of turns — any file edits already made by tool
 * calls are real (writeFile executes immediately), so exhausting the budget
 * returns `{ submitted: false }` and lets the caller preserve that partial
 * progress as a WIP commit instead of losing it to an uncaught crash.
 */
async function runDevAgentTurn({ systemPrompt, task }) {
  const contents = [userTurn(task)];

  for (let turn = 1; turn <= MAX_TURNS_PER_ITERATION; turn++) {
    const turnsRemaining = MAX_TURNS_PER_ITERATION - turn;
    if (turnsRemaining === WRAP_UP_WARNING_TURNS_REMAINING) {
      contents.push(
        userTurn(
          `Only ${WRAP_UP_WARNING_TURNS_REMAINING} tool-call turns remain in this iteration. Stop investigating and wrap up now: make your remaining edits and call submitForReview before the budget runs out.`
        )
      );
    }

    const candidate = await callGeminiAgent({
      systemInstruction: systemPrompt,
      contents,
      tools: TOOL_DECLARATIONS,
    });
    contents.push(modelTurnFromCandidate(candidate));

    const calls = extractFunctionCalls(candidate);
    if (calls.length === 0) {
      log(`  turn ${turn}/${MAX_TURNS_PER_ITERATION}: no tool call — nudging`);
      contents.push(
        userTurn(
          'You must call a tool to make progress; plain text is not read by anyone. Call submitForReview when your changes are complete.'
        )
      );
      continue;
    }
    log(
      `  turn ${turn}/${MAX_TURNS_PER_ITERATION}: ` +
        calls.map((c) => `${c.name}(${summarizeCallArgs(c)})`).join(', ')
    );

    // Round 8: if the model returns multiple parallel calls in one turn, run
    // every non-submit call first so all edits land before we hand off — and
    // only ever honor the first submitForReview if it sent more than one.
    const nonSubmit = calls.filter((c) => c.name !== SUBMIT_FOR_REVIEW_TOOL);
    const submits = calls
      .filter((c) => c.name === SUBMIT_FOR_REVIEW_TOOL)
      .slice(0, 1);

    const results = [];
    let submitSummary = null;
    for (const call of [...nonSubmit, ...submits]) {
      try {
        const response = await executeTool(call.name, call.args);
        results.push({ name: call.name, response });
        if (call.name === SUBMIT_FOR_REVIEW_TOOL) {
          submitSummary = call.args.summary ?? '';
        }
      } catch (err) {
        if (err instanceof FileTooLargeError) throw err; // Round 10: abort the whole run, don't loop on it
        log(`    ${call.name} failed: ${err.message}`);
        results.push({ name: call.name, response: { error: err.message } });
      }
    }

    contents.push(functionResponseTurn(results));
    // If a non-submit call in this same turn failed (e.g. writeFile refused),
    // honoring submitForReview anyway would hand a diff to the reviewer that
    // silently doesn't contain the edit the agent thinks it made. Keep the
    // iteration going so the agent sees the error and can react to it.
    const hasError = results.some((r) => r.response?.error);
    if (submitSummary !== null && !hasError) {
      return { submitted: true, summary: submitSummary };
    }
  }

  log(
    `  turn budget exhausted (${MAX_TURNS_PER_ITERATION}/${MAX_TURNS_PER_ITERATION}) without calling submitForReview`
  );
  return { submitted: false, summary: null };
}

function summarizeCallArgs(call) {
  const { path, command, pattern } = call.args ?? {};
  if (path) return path;
  if (command) return command;
  if (pattern) return pattern;
  return '';
}

function diffHash(baseRef) {
  return createHash('sha256').update(getDiff(baseRef).diff).digest('hex');
}

function printFinalReport(finalState) {
  console.log('\n[ai:dev] ' + '='.repeat(40));
  console.log(
    `[ai:dev] status: ${finalState.status} (iteration ${finalState.iteration}/${MAX_ITERATIONS})`
  );
  if (finalState.review?.summary)
    console.log(`[ai:dev] overall risk: ${finalState.review.summary}`);
  if (finalState.review?.mergeRecommendation)
    console.log(
      `[ai:dev] merge recommendation: ${finalState.review.mergeRecommendation}`
    );
  if (finalState.review?.findings?.length) {
    console.log('[ai:dev] outstanding findings:');
    for (const f of finalState.review.findings) {
      console.log(
        `  - [${f.source ?? f.category}] ${f.file}:${f.line ?? '?'} — ${f.issue}`
      );
    }
  }
  if (hasCommittedThisRun) {
    console.log(
      `\n[ai:dev] collapsed the WIP commit(s) back onto branch "${currentBranch()}" — ` +
        'your changes are staged and uncommitted, ready to review.\n' +
        '  git diff --cached   # review before committing\n' +
        '  # ai:dev never commits or pushes anything real — that part is still on you'
    );
  }
}

async function main() {
  const ticketArg = process.argv[2];
  if (!ticketArg) {
    console.error('Usage: pnpm ai:dev <ticket-number>');
    process.exitCode = 1;
    return;
  }

  registerSignalHandler();

  console.log(
    '[ai:dev] ⚠️  This runs an AI agent with local file write + command execution against ticket ' +
      "content you don't fully control. Only use this on tickets from trusted sources — a malicious " +
      'ticket could attempt prompt injection. Reviewed mitigations exist (path sandboxing, no ' +
      'dependency/config changes, no test/build execution) but this is not a full sandbox.'
  );

  log('running preflight checks...');
  await preflight();

  log('updating local develop (fast-forward only)...');
  updateDevelopFastForward();

  const headOid = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf-8',
  }).trim();

  log(`resolving ticket #${ticketArg}...`);
  const ticket = setupTicketBranch(ticketArg, { headOid });
  log(`branch: ${ticket.branchName}`);

  if (!isWorkingTreeClean()) {
    throw new Error(
      'Working tree became dirty after checking out the ticket branch — investigate before continuing.'
    );
  }

  resolvedBaseRef = mergeBase('HEAD', 'develop');
  log(`base ref (fork point from develop): ${resolvedBaseRef}`);

  log('capturing type-check baseline...');
  const typeCheckBaseline = await captureTypeCheckBaseline();

  const systemPrompt = buildDevAgentSystemPrompt(ticket);

  let failureText = null;
  let reviewFindings = null;
  let priorSignature = null;
  let priorDiffHash = null;
  let finalState = null;

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    log(`=== iteration ${iteration}/${MAX_ITERATIONS} ===`);

    const task =
      iteration === 1
        ? '請開始實作這張 ticket。'
        : buildRetryTask({
            baseRef: resolvedBaseRef,
            failureText,
            reviewFindings,
          });

    const devResult = await runDevAgentTurn({ systemPrompt, task });

    stageAll();
    if (!hasStagedChanges()) {
      failureText = devResult.submitted
        ? '你呼叫了 submitForReview，但 working tree 沒有任何檔案變更。請先完成實際的程式碼修改再 submit。'
        : `你在 ${MAX_TURNS_PER_ITERATION} 輪工具呼叫內都沒有完成任何檔案修改就用完輪數。請減少讀檔／搜尋的輪數，優先動手修改檔案，並在完成後盡快呼叫 submitForReview。`;
      reviewFindings = null;
      const stuck = checkCircuitBreaker({
        signature: failureText,
        priorSignature,
        hash: diffHash(resolvedBaseRef),
        priorDiffHash,
      });
      if (stuck) {
        finalState = { status: 'stuck-no-progress', iteration };
        break;
      }
      priorSignature = failureText;
      continue;
    }

    const lintResult = await autoFixAndLintStaged();
    commitWip(`wip: ai:dev iteration ${iteration}`);
    hasCommittedThisRun = true;

    const typeCheckResult = await diffTypeCheckErrors(typeCheckBaseline);

    if (!lintResult.ok || !typeCheckResult.ok) {
      const parts = [];
      if (!lintResult.ok) parts.push(`Lint errors:\n${lintResult.output}`);
      if (!typeCheckResult.ok)
        parts.push(
          `New type-check errors:\n${typeCheckResult.newErrors.join('\n')}`
        );
      failureText = parts.join('\n\n');
      reviewFindings = null;

      const hash = diffHash(resolvedBaseRef);
      if (
        checkCircuitBreaker({
          signature: failureText,
          priorSignature,
          hash,
          priorDiffHash,
        })
      ) {
        finalState = { status: 'stuck-no-progress', iteration };
        break;
      }
      priorSignature = failureText;
      priorDiffHash = hash;
      continue;
    }

    if (!devResult.submitted) {
      failureText = `你在 ${MAX_TURNS_PER_ITERATION} 輪工具呼叫內沒有呼叫 submitForReview，但已完成的修改通過 lint/type-check 並保留為 WIP commit。請延續之前的進度，優先完成剩餘修改並盡快呼叫 submitForReview，避免再花太多輪數在讀檔／搜尋上。`;
      reviewFindings = null;

      const hash = diffHash(resolvedBaseRef);
      if (
        checkCircuitBreaker({
          signature: failureText,
          priorSignature,
          hash,
          priorDiffHash,
        })
      ) {
        finalState = { status: 'stuck-no-progress', iteration };
        break;
      }
      priorSignature = failureText;
      priorDiffHash = hash;
      continue;
    }

    log('running reviewer...');
    const review = await reviewDiff({ baseRef: resolvedBaseRef, ticket });

    if (!review.hasBlockingFindings) {
      finalState = { status: 'passed', iteration, review };
      break;
    }

    failureText = null;
    reviewFindings = review.findings;
    const signature = JSON.stringify(
      review.findings.map((f) => `${f.file}:${f.issue}`).sort()
    );
    const hash = diffHash(resolvedBaseRef);
    if (
      checkCircuitBreaker({ signature, priorSignature, hash, priorDiffHash })
    ) {
      finalState = { status: 'stuck-no-progress', iteration, review };
      break;
    }
    priorSignature = signature;
    priorDiffHash = hash;
  }

  if (!finalState) {
    finalState = { status: 'iteration-cap-reached', iteration: MAX_ITERATIONS };
  }

  // Collapse the per-iteration WIP commits back into uncommitted staged
  // changes so the run ends with something ready to review, not a WIP commit
  // you have to manually reset yourself every time.
  if (hasCommittedThisRun) {
    resetSoft(resolvedBaseRef);
  }

  printFinalReport(finalState);
}

/** Round 8/10: if this round's failure signature (or the diff itself) is unchanged from last round, the agent isn't making progress — stop before burning the rest of the iteration cap. */
function checkCircuitBreaker({
  signature,
  priorSignature,
  hash,
  priorDiffHash,
}) {
  return (
    priorSignature !== null &&
    (signature === priorSignature || hash === priorDiffHash)
  );
}

main().catch((err) => {
  if (err instanceof FileTooLargeError) {
    fail(`stopped early: ${err.message}`);
    return;
  }
  if (
    err instanceof GitError ||
    err instanceof TicketError ||
    err instanceof ChecksError
  ) {
    fail(err.message);
    return;
  }
  fail(err.stack || err.message);
});
