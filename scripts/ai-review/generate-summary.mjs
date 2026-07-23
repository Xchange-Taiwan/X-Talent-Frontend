import { writeFileSync } from 'node:fs';
import { callGemini } from './lib/gemini.mjs';
import { buildPrompt } from './lib/prompt.mjs';
import { decodeContext } from './lib/context-io.mjs';
import { formatComment } from './lib/format-comment.mjs';

/**
 * Decodes an upstream job output. Missing/undecodable output is logged and
 * passed through as undefined rather than thrown — one reviewer stage
 * failing to run must not prevent the other stages' results from being
 * posted (formatComment renders a missing stage as "not run").
 */
function decodeUpstream(name, envVar) {
  const value = decodeContext(process.env[envVar]);
  if (!value) {
    console.warn(
      `[generate-summary] missing or undecodable upstream output: ${name} (${envVar})`
    );
  }
  return value;
}

const plan = decodeUpstream('plan', 'PLAN_B64');
const security = decodeUpstream('security', 'SECURITY_FINDINGS_B64');
const correctness = decodeUpstream('correctness', 'CORRECTNESS_FINDINGS_B64');
const businessLogic = decodeUpstream(
  'businessLogic',
  'BUSINESS_LOGIC_FINDINGS_B64'
);
const performance = decodeUpstream('performance', 'PERFORMANCE_FINDINGS_B64');
const testing = decodeUpstream('testing', 'TESTING_FINDINGS_B64');
const architecture = decodeUpstream(
  'architecture',
  'ARCHITECTURE_FINDINGS_B64'
);
const reviewGuide = decodeUpstream('reviewGuide', 'REVIEW_GUIDE_B64');

let summary;
try {
  const prompt = buildPrompt(new URL('./prompts/summary.md', import.meta.url), {
    PLAN_JSON: JSON.stringify(plan ?? null, null, 2),
    SECURITY_FINDINGS_JSON: JSON.stringify(security ?? null, null, 2),
    CORRECTNESS_FINDINGS_JSON: JSON.stringify(correctness ?? null, null, 2),
    BUSINESS_LOGIC_FINDINGS_JSON: JSON.stringify(
      businessLogic ?? null,
      null,
      2
    ),
    PERFORMANCE_FINDINGS_JSON: JSON.stringify(performance ?? null, null, 2),
    TESTING_FINDINGS_JSON: JSON.stringify(testing ?? null, null, 2),
    ARCHITECTURE_FINDINGS_JSON: JSON.stringify(architecture ?? null, null, 2),
  });
  summary = await callGemini(prompt);
  console.log('[generate-summary] summary:', JSON.stringify(summary, null, 2));
} catch (err) {
  // The per-agent sections still have everything they need without this
  // call, so a failure here should degrade the comment, not kill it.
  console.error(
    `[generate-summary] final-judgment call failed, posting without it: ${err.message}`
  );
  summary = undefined;
}

const comment = formatComment({
  plan,
  reviewGuide,
  security,
  correctness,
  businessLogic,
  performance,
  testing,
  architecture,
  summary,
});
writeFileSync('ai-review-comment.md', comment, 'utf-8');
