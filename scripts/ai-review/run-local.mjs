#!/usr/bin/env node
/**
 * Thin CLI adapter for running the unified multimodal AI Review pipeline
 * locally or in the Cloud Pre-PR convergence loop (`cloud-converge-loop.mjs`).
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { config } from 'dotenv';

import {
  createGeminiLlmPort,
  createLocalContextPort,
  runAiReviewPipeline,
} from './pipeline.mjs';

config({ path: path.resolve('.env.development.local'), quiet: true });
config({ path: path.resolve('.env.local'), quiet: true });
config({ path: path.resolve('.env'), quiet: true });

if (!process.env.GEMINI_MAX_OUTPUT_TOKENS) {
  process.env.GEMINI_MAX_OUTPUT_TOKENS = '32768';
}

export function parseCliOption(argv, prefix) {
  const arg = argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : '';
}

export function formatLocalCliOutput(result) {
  if (
    result.mode === 'fallback-in-context' ||
    result.mode === 'fallback-ci' ||
    result.mode === 'review-error'
  ) {
    return {
      mode: result.mode,
      ...(result.reviewError ? { reviewError: true } : {}),
      overallRisk: result.overallRisk,
      requirementCoverage: result.requirementCoverage ?? [],
      findings: result.findings ?? {},
    };
  }

  if (result.emptyDiff) {
    return {
      overallRisk: result.overallRisk,
      requirementCoverage: result.requirementCoverage ?? [],
      findings: result.findings ?? {},
    };
  }

  return {
    mode: 'gemini-local',
    overallRisk: result.overallRisk,
    mergeRecommendation: result.mergeRecommendation ?? '',
    requirementCoverage: result.requirementCoverage ?? [],
    findings: result.findings ?? {},
  };
}

export async function runLocalCli(argv = process.argv.slice(2)) {
  const baseRef =
    parseCliOption(argv, '--base-ref=') ||
    process.env.BASE_REF ||
    'origin/develop';
  const ticketNumber =
    parseCliOption(argv, '--ticket=') || process.env.TICKET_NUMBER || '';
  const e2eReport = process.env.E2E_VERIFICATION_REPORT || '';
  const strict = process.env.STRICT_AI_REVIEW !== '0';

  if (!process.env.GEMINI_API_KEY && strict) {
    console.error(
      '[ai-review-local] GEMINI_API_KEY is missing (fail-closed by default; set STRICT_AI_REVIEW=0 only for offline local dev).'
    );
  }

  const result = await runAiReviewPipeline(
    {
      mode: 'local',
      baseRef,
      ticketNumber,
      e2eReport,
      strict,
      includeReviewGuide: false,
      postComment: false,
    },
    {
      llmPort: createGeminiLlmPort(),
      contextPort: createLocalContextPort(),
    }
  );

  console.log(JSON.stringify(formatLocalCliOutput(result), null, 2));
  if (result.exitCode && result.exitCode !== 0) {
    process.exit(result.exitCode);
  }
}

const isMainModule =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  runLocalCli().catch((err) => {
    console.error(
      `[ai-review-local] Review failed (fail-closed): ${err.message}`
    );
    console.log(
      JSON.stringify({
        mode: 'review-error',
        reviewError: true,
        overallRisk: {
          level: 'high',
          reason: `AI Review execution failed: ${err.message}`,
        },
        requirementCoverage: [],
        findings: {},
      })
    );
    process.exit(1);
  });
}
