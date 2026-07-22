import { callGemini } from './gemini.mjs';
import { getDiff } from './diff.mjs';
import { buildPrompt } from './prompt.mjs';
import {
  encodeContext,
  decodeContext,
  writeGithubOutput,
} from './context-io.mjs';

/**
 * Runs one downstream review-agent stage: recomputes the PR diff, decodes the
 * upstream job outputs it depends on, builds this agent's prompt, calls
 * Gemini, and writes the structured result to $GITHUB_OUTPUT under
 * `outputName` so the next stage in the pipeline can read it via
 * `needs.<job>.outputs.<outputName>`.
 */
export async function runAgent({ promptUrl, upstreamEnvVars, outputName }) {
  const baseRef = process.env.BASE_REF;
  if (!baseRef) {
    throw new Error('BASE_REF env var is required');
  }

  const { diff, truncated } = getDiff(baseRef);

  const upstreamReplacements = {};
  for (const [placeholder, envVar] of Object.entries(upstreamEnvVars)) {
    const value = decodeContext(process.env[envVar]);
    if (!value) {
      throw new Error(
        `${envVar} env var is required (missing upstream job output)`
      );
    }
    upstreamReplacements[placeholder] = JSON.stringify(value, null, 2);
  }

  const prompt = buildPrompt(promptUrl, {
    DIFF: diff,
    TRUNCATED_NOTE: truncated ? '（注意：diff 過大，內容已截斷）' : '',
    ...upstreamReplacements,
  });

  const result = await callGemini(prompt);
  console.log(`[${outputName}] result:`, JSON.stringify(result, null, 2));
  writeGithubOutput(outputName, encodeContext(result));
  return result;
}
