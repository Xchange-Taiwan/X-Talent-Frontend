#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

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
  modelTextTurn,
  modelTurnFromCandidate,
  userTurn,
} from './lib/gemini-agent.mjs';
import {
  commit,
  commitWip,
  currentBranch,
  GitError,
  hasStagedChanges,
  isWorkingTreeClean,
  mergeBase,
  parseOwnerRepo,
  pushBranch,
  remoteOriginUrl,
  resetSoft,
  stageAll,
  updateDevelopFastForward,
} from './lib/git.mjs';
import {
  buildCommitSubject,
  buildPrBody,
  commentOnPr,
  createPr,
  findOpenPrForBranch,
  PrError,
} from './lib/pr.mjs';
import { killActiveChildren } from './lib/proc.mjs';
import { reviewDiff } from './lib/review-bridge.mjs';
import { runQa } from '../ai-qa/lib/qa-bridge.mjs';
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
const MAX_TURNS_PER_ITERATION = 200;
// When this few turns remain, nudge the agent to wrap up instead of letting
// it keep investigating until the hard cutoff.
const WRAP_UP_WARNING_TURNS_REMAINING = 25;
const EXPECTED_ORG = 'Xchange-Taiwan';
const SYSTEM_PROMPT_URL = new URL(
  './prompts/dev-agent-system.md',
  import.meta.url
);

// Module-scope on purpose: set once in main() after the ticket branch is
// checked out, then read via closure from the retry/follow-up task builders
// below — all in this same file. (attemptAutoPr takes resolvedBaseRef as an
// explicit parameter instead, for testability — see orchestrator.test.mjs.)
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

export function buildRetryTask({
  baseRef,
  failureText,
  reviewFindings,
  qaFindings,
}) {
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
  if (qaFindings) {
    sections.push(
      '## QA Agent 執行失敗的情境（需要修正）',
      JSON.stringify(qaFindings, null, 2)
    );
  }
  sections.push('請根據上面的資訊修正問題，完成後呼叫 submitForReview。');
  return sections.join('\n\n');
}

/** Same idea as buildRetryTask, but driven by a human's free-form follow-up message instead of an automatic lint/type-check/review failure. */
export function buildFollowUpTask({ baseRef, userMessage }) {
  const { diff, truncated } = getDiff(baseRef);
  const sections = [
    `## 目前累積的完整 Diff${truncated ? '（已截斷）' : ''}`,
    '```diff\n' + diff + '\n```',
    '## 使用者的追加指示',
    userMessage,
    '如果這是問題，調查後在 submitForReview 的 summary 裡回答；如果是修改需求，才動手改程式碼。完成後呼叫 submitForReview。',
  ];
  return sections.join('\n\n');
}

/**
 * Runs the dev agent until it calls submitForReview (or the per-iteration
 * turn cap is hit). Fresh `contents` every call in the main iteration loop —
 * no cross-iteration history, only the current diff/findings carry state
 * forward. `priorContents` lets the follow-up session (runFollowUpSession)
 * seed a running conversation instead — see its own comment for why that
 * history is kept to lightweight Q&A turns, not full tool-call traces.
 *
 * Never throws on running out of turns — any file edits already made by tool
 * calls are real (writeFile executes immediately), so exhausting the budget
 * returns `{ submitted: false }` and lets the caller preserve that partial
 * progress as a WIP commit instead of losing it to an uncaught crash.
 */
async function runDevAgentTurn({ systemPrompt, task, priorContents = [] }) {
  const contents = [...priorContents, userTurn(task)];

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

/** Runs the QA stage (scripts/ai-qa/lib/qa-bridge.mjs), honoring the
 * SKIP_QA escape hatch and never letting an unexpected crash in the QA stage
 * itself abort the whole ai:dev run — same "infra trouble isn't a code bug"
 * rule the stage applies internally to its own dev-server/session failures. */
async function runQaStage({ ticket, baseRef }) {
  if (process.env.SKIP_QA === '1') {
    log('QA: skipped (SKIP_QA=1)');
    return { status: 'skipped', findings: [], reportMarkdown: null };
  }
  log('running QA agent...');
  try {
    const qa = await runQa({ ticket, baseRef });
    log(`QA: ${qa.status}${qa.reason ? ` — ${qa.reason}` : ''}`);
    return qa;
  } catch (err) {
    log(`QA: unexpected error, treating as infra-error (${err.message})`);
    return {
      status: 'infra-error',
      reason: err.message,
      findings: [],
      reportMarkdown: null,
    };
  }
}

/**
 * The "does this QA result stop the loop and force a retry round" decision —
 * the sharp end of issue #318's "無限重試與回饋迴圈" risk area, so it's
 * pulled out on its own to be directly unit-testable rather than only
 * reachable by driving the whole main() loop. Only a confirmed `failed`
 * (a genuine scenario assertion mismatch) can block, and only when
 * explicitly opted into via AI_QA_BLOCKING — `infra-error` / `not-applicable`
 * / `skipped` must never trigger a retry no matter what the flag says,
 * since retrying can't fix an environment problem and would just burn
 * iterations (or worse, feed the dev agent a "fix" for something that was
 * never actually broken).
 */
export function isQaBlocking(qa) {
  return process.env.AI_QA_BLOCKING === 'true' && qa.status === 'failed';
}

function printFinalReport(finalState, prResult) {
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
  if (finalState.qa) {
    console.log(`[ai:dev] QA: ${finalState.qa.status}`);
    for (const f of finalState.qa.findings ?? []) {
      console.log(`  - [${f.source}] ${f.file} — ${f.issue}`);
    }
  }
  if (prResult?.created) {
    console.log(`\n[ai:dev] opened PR: ${prResult.url}`);
    return;
  }
  if (prResult?.pushed) {
    console.log(
      `\n[ai:dev] commit was pushed to origin/${currentBranch()} but no PR was opened — ` +
        'open one manually, or re-run.'
    );
    return;
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

/**
 * Only called once the gating condition (passed, low risk, zero findings)
 * already holds. Every failure here falls back to the "leave it staged"
 * behavior instead of leaving a broken half-done state — see README for the
 * exact gating condition and risk trade-off.
 *
 * `resolvedBaseRef` is passed explicitly (rather than read off the
 * module-scope variable of the same name) so this function stays testable
 * in isolation — see orchestrator.test.mjs.
 */
export async function attemptAutoPr({ ticket, resolvedBaseRef, qa }) {
  if (!hasStagedChanges()) {
    log('auto-pr: nothing staged after collapsing WIP commits, skipping.');
    return { created: false };
  }

  let existingPrUrl;
  try {
    existingPrUrl = findOpenPrForBranch(ticket.branchName);
  } catch (err) {
    log(
      `auto-pr: could not check for an existing PR (${err.message}) — falling back to manual hand-off.`
    );
    return { created: false };
  }
  if (existingPrUrl) {
    log(
      `auto-pr: branch "${ticket.branchName}" already has an open PR (${existingPrUrl}) — falling back to manual hand-off.`
    );
    return { created: false };
  }

  const subject = buildCommitSubject(ticket);

  try {
    commit(subject);
  } catch (err) {
    log(
      `auto-pr: commit failed (${err.message}) — falling back to manual hand-off.`
    );
    return { created: false };
  }

  try {
    pushBranch(ticket.branchName);
  } catch (err) {
    log(
      `auto-pr: push failed (${err.message}) — rolling back the local commit, falling back to manual hand-off.`
    );
    resetSoft(resolvedBaseRef);
    return { created: false };
  }

  try {
    const url = createPr({
      branch: ticket.branchName,
      title: subject,
      body: buildPrBody(ticket),
    });
    hasCommittedThisRun = false; // it's a real, already-pushed commit now — nothing left to collapse

    if (qa?.reportMarkdown) {
      try {
        commentOnPr({ branch: ticket.branchName, body: qa.reportMarkdown });
      } catch (err) {
        // Best-effort — the PR itself already exists and is the important
        // part; a failed follow-up comment must never look like a failed PR.
        log(
          `auto-pr: posting QA report comment failed (${err.message}) — PR was still created.`
        );
      }
    }

    return { created: true, pushed: true, url };
  } catch (err) {
    log(
      `auto-pr: branch was pushed but \`gh pr create\` failed (${err.message}). ` +
        `The commit is already on origin/${ticket.branchName} — open the PR manually or re-run.`
    );
    hasCommittedThisRun = false; // already pushed; a local reset here would not undo the remote commit
    // pushed: true is load-bearing — main() must skip runFollowUpSession in
    // this case too, not just when created is true. Once a real commit is
    // pushed, resolvedBaseRef no longer represents "nothing has happened
    // yet"; letting the follow-up loop's resetSoft(resolvedBaseRef) run
    // would erase this already-pushed commit from local history.
    return { created: false, pushed: true };
  }
}

/**
 * Interactive follow-up mode: after the automatic dev→lint→review loop
 * finishes, keep the process alive and let a human give free-form follow-up
 * instructions on top of whatever's already there, instead of forcing a full
 * re-run (re-preflight, re-fetch ticket, re-baseline) for every small tweak.
 *
 * Each round still goes through the same stage → lint → type-check → commit
 * → reviewer pipeline as an automatic iteration — a human driving it round
 * by round doesn't relax those gates. After every round the WIP commit is
 * immediately collapsed back to staged/uncommitted (resetSoft), so the
 * working tree is always in the same "ready to review" state between
 * prompts, and the next round's diff still includes everything accepted so
 * far.
 *
 * Conversation memory: `history` carries across rounds so you can ask
 * follow-up questions that reference earlier answers ("有記憶的對話"). It's
 * deliberately kept to just each round's user message + the agent's final
 * text answer (two turns per round) — never the round's internal
 * readFile/searchFiles/writeFile trace. Persisting that raw trace too would
 * make every subsequent round resend the accumulated tool output from every
 * prior round, which balloons token cost/context fast and buys nothing:
 * dev-agent-system.md already tells the agent to never trust remembered
 * file content and re-`readFile` before writing regardless of what's in
 * `history`.
 */
async function runFollowUpSession({ ticket, systemPrompt, typeCheckBaseline }) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  log(
    'follow-up mode — type an instruction or ask a question to keep going, or "exit"/"quit" to finish.'
  );

  let history = [];

  try {
    let round = 1;
    for (;;) {
      const userMessage = (await rl.question('> ')).trim();
      if (
        !userMessage ||
        ['exit', 'quit'].includes(userMessage.toLowerCase())
      ) {
        break;
      }

      const task = buildFollowUpTask({
        baseRef: resolvedBaseRef,
        userMessage,
      });
      const devResult = await runDevAgentTurn({
        systemPrompt,
        task,
        priorContents: history,
      });

      history = [
        ...history,
        userTurn(userMessage),
        modelTextTurn(devResult.summary || '（沒有回應內容）'),
      ];
      if (devResult.summary) {
        log(`agent: ${devResult.summary}`);
      }

      stageAll();
      if (!hasStagedChanges()) {
        if (!devResult.summary) {
          log(
            devResult.submitted
              ? 'agent 呼叫了 submitForReview，但沒有任何檔案變更，也沒有留下說明。'
              : `用完 ${MAX_TURNS_PER_ITERATION} 輪工具呼叫但沒有任何檔案變更。`
          );
        }
        continue;
      }

      const lintResult = await autoFixAndLintStaged();
      commitWip(`wip: ai:dev follow-up ${round}`);
      hasCommittedThisRun = true;

      const typeCheckResult = await diffTypeCheckErrors(typeCheckBaseline);
      if (!lintResult.ok || !typeCheckResult.ok) {
        if (!lintResult.ok) log(`Lint errors:\n${lintResult.output}`);
        if (!typeCheckResult.ok) {
          log(
            `New type-check errors:\n${typeCheckResult.newErrors.join('\n')}`
          );
        }
        resetSoft(resolvedBaseRef);
        round++;
        continue;
      }

      log('running reviewer...');
      const review = await reviewDiff({ baseRef: resolvedBaseRef, ticket });
      log(`overall risk: ${review.summary}`);
      if (review.findings?.length) {
        log('findings:');
        for (const f of review.findings) {
          log(
            `  - [${f.source ?? f.category}] ${f.file}:${f.line ?? '?'} — ${f.issue}`
          );
        }
      }

      resetSoft(resolvedBaseRef);
      round++;
    }
  } finally {
    rl.close();
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
      'dependency/config changes) but this is not a full sandbox. Once the static reviewer passes, ' +
      'the QA stage boots a real `pnpm dev` server and drives it with a real browser under a ' +
      'dedicated QA test account (see scripts/ai-qa/README.md) — set SKIP_QA=1 to skip this. If the ' +
      'review pipeline judges the result low risk with zero findings, it will automatically commit, ' +
      'push, and open a real PR — no manual step required.'
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
  let qaFindings = null;
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
            qaFindings,
          });

    const devResult = await runDevAgentTurn({ systemPrompt, task });

    stageAll();
    if (!hasStagedChanges()) {
      failureText = devResult.submitted
        ? '你呼叫了 submitForReview，但 working tree 沒有任何檔案變更。請先完成實際的程式碼修改再 submit。'
        : `你在 ${MAX_TURNS_PER_ITERATION} 輪工具呼叫內都沒有完成任何檔案修改就用完輪數。請減少讀檔／搜尋的輪數，優先動手修改檔案，並在完成後盡快呼叫 submitForReview。`;
      reviewFindings = null;
      qaFindings = null;
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
      qaFindings = null;

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
      qaFindings = null;

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
      // QA only runs once the (cheaper) static review already passed —
      // no point spending a dev-server boot + browser turns on a diff
      // that's about to get reworked anyway.
      const qa = await runQaStage({ ticket, baseRef: resolvedBaseRef });

      if (isQaBlocking(qa)) {
        failureText = null;
        reviewFindings = null;
        qaFindings = qa.findings;
        const signature = JSON.stringify(
          (qa.findings ?? []).map((f) => `${f.file}:${f.issue}`).sort()
        );
        const hash = diffHash(resolvedBaseRef);
        if (
          checkCircuitBreaker({
            signature,
            priorSignature,
            hash,
            priorDiffHash,
          })
        ) {
          finalState = { status: 'stuck-no-progress', iteration, review, qa };
          break;
        }
        priorSignature = signature;
        priorDiffHash = hash;
        continue;
      }

      // Non-blocking by default (see issue #318: v1 QA runs and reports but
      // doesn't gate) — `infra-error`/`not-applicable`/`skipped` never block
      // regardless of AI_QA_BLOCKING; only a confirmed `failed` does, and
      // only when explicitly opted in.
      finalState = { status: 'passed', iteration, review, qa };
      break;
    }

    failureText = null;
    reviewFindings = review.findings;
    qaFindings = null;
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

  const gatePassed =
    finalState.status === 'passed' &&
    finalState.review?.overallRisk?.level === 'low' &&
    (finalState.review?.findings?.length ?? 0) === 0;

  const prResult = gatePassed
    ? await attemptAutoPr({ ticket, resolvedBaseRef, qa: finalState.qa })
    : null;

  printFinalReport(finalState, prResult);

  if (prResult?.created || prResult?.pushed) {
    // A real commit is on origin/<branch> in both cases — skip the follow-up
    // loop entirely. Its resetSoft(resolvedBaseRef) is only safe when nothing
    // has been pushed yet; running it here would erase that pushed commit
    // from local history (see attemptAutoPr's push-succeeded-but-create-
    // failed branch).
    log(
      `further changes should be pushed as additional commits to branch "${ticket.branchName}" — not through another local WIP loop.`
    );
    return;
  }

  await runFollowUpSession({ ticket, systemPrompt, typeCheckBaseline });

  // The follow-up session may have made more changes since printFinalReport
  // ran; collapse those too and print a closing summary before exiting.
  if (hasCommittedThisRun) {
    resetSoft(resolvedBaseRef);
    log(
      `follow-up session ended — changes are staged and uncommitted on branch "${currentBranch()}". ` +
        'git diff --cached to review, then commit yourself.'
    );
  } else {
    log('follow-up session ended — no changes were made.');
  }
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

// Only auto-run when this file is the actual entry point (`node
// orchestrator.mjs ...` / `pnpm ai:dev`) — not when it's imported, e.g. by
// orchestrator.test.mjs importing attemptAutoPr for unit testing.
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    if (err instanceof FileTooLargeError) {
      fail(`stopped early: ${err.message}`);
      return;
    }
    if (
      err instanceof GitError ||
      err instanceof TicketError ||
      err instanceof ChecksError ||
      err instanceof PrError
    ) {
      fail(err.message);
      return;
    }
    fail(err.stack || err.message);
  });
}
