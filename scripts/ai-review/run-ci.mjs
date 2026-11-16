#!/usr/bin/env node
/**
 * Thin CLI adapter for running the unified multimodal AI Review pipeline
 * inside the single Node 24 GitHub Actions job (`AI Review: Final Summary`).
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  createCiContextPort,
  createGeminiLlmPort,
  runAiReviewPipeline,
} from './pipeline.mjs';

if (!process.env.GEMINI_MAX_OUTPUT_TOKENS) {
  process.env.GEMINI_MAX_OUTPUT_TOKENS = '32768';
}

export async function runCiCli(env = process.env) {
  const baseRef = env.BASE_REF;
  const headSha = env.HEAD_SHA;
  const branch = env.HEAD_REF || '';
  const prNumber = env.PR_NUMBER || '';
  const repo = env.GITHUB_REPOSITORY || '';
  const githubToken = env.GITHUB_TOKEN || '';
  const trackerToken = env.TRACKER_READ_TOKEN || '';

  if (!baseRef) {
    throw new Error('BASE_REF env var is required');
  }
  if (!headSha) {
    throw new Error('HEAD_SHA env var is required');
  }
  if (!githubToken) {
    throw new Error('GITHUB_TOKEN env var is required');
  }
  if (!repo) {
    throw new Error('GITHUB_REPOSITORY env var is required');
  }
  if (!prNumber) {
    throw new Error('PR_NUMBER env var is required');
  }

  const result = await runAiReviewPipeline(
    {
      mode: 'ci',
      baseRef,
      headSha,
      branch,
      prNumber,
      repo,
      strict: true,
      includeReviewGuide: true,
      postComment: true,
    },
    {
      llmPort: createGeminiLlmPort({ apiKey: env.GEMINI_API_KEY }),
      contextPort: createCiContextPort({
        trackerToken,
        githubToken,
        repo,
      }),
    }
  );

  console.log(
    `[ai-review-ci] posted PR #${prNumber} review comment (overallRisk=${result.overallRisk?.level ?? 'unknown'})`
  );
  return result;
}

const isMainModule =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  runCiCli().catch((err) => {
    console.error(`[ai-review-ci] fatal error: ${err.message}`);
    process.exit(1);
  });
}
