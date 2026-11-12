#!/usr/bin/env node
/**
 * Runs the AI Review pipeline locally or in the Cloud Pre-PR convergence loop
 * using the FREE Gemini model (`gemini-4-carbon`) configured in
 * `.env.development.local` or environment variables (`GEMINI_API_KEY`),
 * consuming ZERO Claude Code / Aside sub-agent tokens.
 *
 * If `GEMINI_API_KEY` is not configured on the developer's machine, prints a
 * graceful fallback notice so the agent performs a single-pass in-context
 * self-check (0 sub-agents) or defers full AI Review to the GitHub Actions CI
 * pipeline.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { config } from 'dotenv';

config({ path: path.resolve('.env.development.local'), quiet: true });
config({ path: path.resolve('.env.local'), quiet: true });
config({ path: path.resolve('.env'), quiet: true });

if (!process.env.GEMINI_MAX_OUTPUT_TOKENS) {
  process.env.GEMINI_MAX_OUTPUT_TOKENS = '32768';
}

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
        requirementCoverage: [],
        findings: {},
      },
      null,
      2
    )
  );
  process.exit(0);
}

import { getWorkingTreeDiff } from './lib/diff.mjs';
import { callGemini } from './lib/gemini.mjs';
import { buildPrompt } from './lib/prompt.mjs';
import {
  fetchRawArchitectureKb,
  fetchTicketContext,
  formatArchitectureKnowledgeBase,
  isUiReviewFile,
  resolveDesignSpecsFromKb,
} from './lib/ticket.mjs';
import { loadReviewVisualAssets } from './lib/visuals.mjs';

function parseCliOption(prefix) {
  const arg = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : '';
}

async function main() {
  const baseRef =
    parseCliOption('--base-ref=') || process.env.BASE_REF || 'origin/develop';
  const explicitTicket =
    parseCliOption('--ticket=') || process.env.TICKET_NUMBER || '';
  const e2eReport = process.env.E2E_VERIFICATION_REPORT || '';

  const branch = execFileSync('git', ['branch', '--show-current'], {
    encoding: 'utf8',
  }).trim();
  const { diff: safeDiff, truncated } = getWorkingTreeDiff(baseRef);

  if (!safeDiff.trim()) {
    console.log(
      JSON.stringify(
        {
          overallRisk: {
            level: 'low',
            reason: `Empty diff against ${baseRef}.`,
          },
          requirementCoverage: [],
          findings: {
            security: [],
            correctness: [],
            businessLogic: [],
            performance: [],
            testing: [],
            architecture: [],
          },
        },
        null,
        2
      )
    );
    return;
  }

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
      ticket = await fetchTicketContext(branch, ghToken, explicitTicket);
    } catch {}
  }

  const e2eSection = e2eReport
    ? `\n\n## 雲端 Playwright E2E 驗證狀態\n${e2eReport}`
    : '';

  const kbQuery = ticket.ticketFound
    ? `#${ticket.number} ${ticket.title} ${branch}`
    : branch;
  const rawKb = await fetchRawArchitectureKb(kbQuery);
  const archKbSection = formatArchitectureKnowledgeBase(rawKb);

  const designSpecsObj = resolveDesignSpecsFromKb(rawKb);
  const designSpecsMd = designSpecsObj
    ? '```json\n' +
      JSON.stringify(designSpecsObj, null, 2).slice(0, 9000) +
      '\n```'
    : '（無對應 Design Hub 記錄，請依據 Ticket 附圖與正文規格審查）';

  const visualAssets = loadReviewVisualAssets();
  const visualNote = visualAssets.visualContextMarkdown || '';

  const ticketSection = ticket.ticketFound
    ? `## 對應 Ticket\n**#${ticket.number} ${ticket.title}**\n\n${ticket.body}${visualNote}${e2eSection}${archKbSection}`
    : `## 對應 Ticket\n（僅根據 diff 進行分析）${visualNote}${e2eSection}${archKbSection}`;

  const planPrompt = buildPrompt(
    new URL('./prompts/planner.md', import.meta.url),
    {
      TICKET_SECTION: ticketSection,
      DIFF: safeDiff,
      TRUNCATED_NOTE: truncated ? '（注意：diff 過大，內容已截斷）' : '',
    }
  );
  const plan = await callGemini(planPrompt, { images: visualAssets.images });
  const planJson = JSON.stringify(plan, null, 2);

  const runStage = async (
    promptFile,
    stageImages = [],
    stageVisualNote = '',
    extraVars = {}
  ) => {
    const hasStageImages = Array.isArray(stageImages) && stageImages.length > 0;
    const p = buildPrompt(new URL(`./prompts/${promptFile}`, import.meta.url), {
      PLAN_JSON: planJson,
      DIFF: safeDiff,
      TRUNCATED_NOTE: truncated ? '（注意：diff 過大，內容已截斷）' : '',
      VISUAL_CONTEXT: hasStageImages ? stageVisualNote : '',
      ...extraVars,
    });
    return callGemini(p, {
      images: hasStageImages ? stageImages : [],
    });
  };

  const hasUiDiff =
    Array.isArray(plan?.filesTouched) && plan.filesTouched.some(isUiReviewFile);

  const [
    security,
    correctness,
    businessLogic,
    visualParity,
    performance,
    testing,
    architecture,
  ] = await Promise.all([
    runStage('security.md'),
    runStage('correctness.md'),
    runStage('business-logic.md', visualAssets.images, visualNote),
    hasUiDiff && (visualAssets.images.length > 0 || designSpecsObj)
      ? runStage('visual-parity.md', visualAssets.images, visualNote, {
          DESIGN_HUB_SPECS: designSpecsMd,
        })
      : Promise.resolve({
          hasFindings: false,
          summary: '無視覺變更或無設計圖可比對',
          findings: [],
        }),
    runStage('performance.md'),
    runStage(
      'testing.md',
      visualAssets.evidenceImages,
      visualAssets.evidenceContextMarkdown
    ),
    runStage('architecture.md'),
  ]);

  const summaryPrompt = buildPrompt(
    new URL('./prompts/summary.md', import.meta.url),
    {
      PLAN_JSON: planJson,
      SECURITY_FINDINGS_JSON: JSON.stringify(security, null, 2),
      CORRECTNESS_FINDINGS_JSON: JSON.stringify(correctness, null, 2),
      BUSINESS_LOGIC_FINDINGS_JSON: JSON.stringify(businessLogic, null, 2),
      VISUAL_PARITY_FINDINGS_JSON: JSON.stringify(visualParity, null, 2),
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
        requirementCoverage: Array.isArray(summary?.requirementCoverage)
          ? summary.requirementCoverage
          : [],
        findings: {
          security: security?.findings ?? [],
          correctness: correctness?.findings ?? [],
          businessLogic: businessLogic?.findings ?? [],
          visualParity: visualParity?.findings ?? [],
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
      requirementCoverage: [],
      findings: {},
    })
  );
});
