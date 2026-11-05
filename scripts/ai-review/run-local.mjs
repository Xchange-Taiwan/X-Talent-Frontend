#!/usr/bin/env node
/**
 * Runs the AI Review pipeline locally using the FREE Gemini model (`gemini-4-argon`)
 * configured in `.env.development.local` (`GEMINI_API_KEY`), consuming ZERO
 * Claude Code / Aside sub-agent tokens.
 *
 * If `GEMINI_API_KEY` is not configured on the developer's machine, prints a
 * graceful fallback notice so the agent performs a single-pass in-context
 * self-check (0 sub-agents) or defers full AI Review to the GitHub Actions CI
 * pipeline.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { config } from 'dotenv';

config({ path: path.resolve('.env.development.local') });
config({ path: path.resolve('.env.local') });
config({ path: path.resolve('.env') });

if (!process.env.GEMINI_API_KEY) {
  console.log(
    JSON.stringify(
      {
        mode: 'fallback-in-context',
        overallRisk: {
          level: 'low',
          reason:
            'No local GEMINI_API_KEY found in .env.development.local. Skip spawning sub-agents; rely on local lint/type-check/vitest and GitHub Actions CI Gemini review.',
        },
      },
      null,
      2
    )
  );
  process.exit(0);
}

import { callGemini } from './lib/gemini.mjs';
import { buildPrompt } from './lib/prompt.mjs';
import { fetchTicketContext } from './lib/ticket.mjs';

async function main() {
  const branch = execFileSync('git', ['branch', '--show-current'], {
    encoding: 'utf8',
  }).trim();
  const diff = execFileSync('git', ['diff', 'origin/develop'], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });

  if (!diff.trim()) {
    console.log(
      JSON.stringify(
        {
          overallRisk: {
            level: 'low',
            reason: 'Empty diff against origin/develop.',
          },
        },
        null,
        2
      )
    );
    return;
  }

  const MAX_DIFF = 80000;
  const truncated = diff.length > MAX_DIFF;
  const safeDiff = truncated ? diff.slice(0, MAX_DIFF) : diff;

  let ghToken =
    process.env.TRACKER_READ_TOKEN || process.env.GITHUB_TOKEN || '';
  if (!ghToken) {
    try {
      ghToken = execFileSync('gh', ['auth', 'token'], {
        encoding: 'utf8',
      }).trim();
    } catch {}
  }

  let ticket = { ticketFound: false };
  if (ghToken) {
    try {
      ticket = await fetchTicketContext(branch, ghToken);
    } catch {}
  }

  const ticketSection = ticket.ticketFound
    ? `## 對應 Ticket\n**#${ticket.number} ${ticket.title}**\n\n${ticket.body}`
    : '## 對應 Ticket\n（僅根據 diff 進行分析）';

  const planPrompt = buildPrompt(
    new URL('./prompts/planner.md', import.meta.url),
    {
      TICKET_SECTION: ticketSection,
      DIFF: safeDiff,
      TRUNCATED_NOTE: truncated ? '（注意：diff 過大，內容已截斷）' : '',
    }
  );
  const plan = await callGemini(planPrompt);
  const planJson = JSON.stringify(plan, null, 2);

  const runStage = async (promptFile) => {
    const p = buildPrompt(new URL(`./prompts/${promptFile}`, import.meta.url), {
      PLAN_JSON: planJson,
      DIFF: safeDiff,
      TRUNCATED_NOTE: truncated ? '（注意：diff 過大，內容已截斷）' : '',
    });
    return callGemini(p);
  };

  const [
    security,
    correctness,
    businessLogic,
    performance,
    testing,
    architecture,
  ] = await Promise.all([
    runStage('security.md'),
    runStage('correctness.md'),
    runStage('business-logic.md'),
    runStage('performance.md'),
    runStage('testing.md'),
    runStage('architecture.md'),
  ]);

  const summaryPrompt = buildPrompt(
    new URL('./prompts/summary.md', import.meta.url),
    {
      PLAN_JSON: planJson,
      SECURITY_FINDINGS_JSON: JSON.stringify(security, null, 2),
      CORRECTNESS_FINDINGS_JSON: JSON.stringify(correctness, null, 2),
      BUSINESS_LOGIC_FINDINGS_JSON: JSON.stringify(businessLogic, null, 2),
      PERFORMANCE_FINDINGS_JSON: JSON.stringify(performance, null, 2),
      TESTING_FINDINGS_JSON: JSON.stringify(testing, null, 2),
      ARCHITECTURE_FINDINGS_JSON: JSON.stringify(architecture, null, 2),
    }
  );
  const summary = await callGemini(summaryPrompt);

  console.log(
    JSON.stringify(
      {
        mode: 'gemini-local',
        overallRisk: summary?.overallRisk ?? {
          level: 'low',
          reason: 'Completed',
        },
        mergeRecommendation: summary?.mergeRecommendation ?? '',
        findings: {
          security: security?.findings ?? [],
          correctness: correctness?.findings ?? [],
          businessLogic: businessLogic?.findings ?? [],
          performance: performance?.findings ?? [],
          testing: testing?.findings ?? [],
          architecture: architecture?.findings ?? [],
        },
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.warn(
    `[ai-review-local] Gemini call skipped (${err.message}); falling back to CI review.`
  );
  console.log(
    JSON.stringify({
      mode: 'fallback-ci',
      overallRisk: {
        level: 'low',
        reason: 'Deferred to GitHub Actions CI Gemini pipeline.',
      },
    })
  );
});
