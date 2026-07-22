import { writeFileSync } from 'node:fs';
import { callGemini } from './lib/gemini.mjs';
import { getDiff } from './lib/diff.mjs';
import { buildPrompt } from './lib/prompt.mjs';
import { decodeContext } from './lib/context-io.mjs';
import { formatComment } from './lib/format-comment.mjs';

const baseRef = process.env.BASE_REF;
if (!baseRef) {
  throw new Error('BASE_REF env var is required');
}

const plan = decodeContext(process.env.PLAN_B64);
const security = decodeContext(process.env.SECURITY_FINDINGS_B64);
const correctness = decodeContext(process.env.CORRECTNESS_FINDINGS_B64);
const performance = decodeContext(process.env.PERFORMANCE_FINDINGS_B64);
const testing = decodeContext(process.env.TESTING_FINDINGS_B64);

for (const [name, value] of Object.entries({
  plan,
  security,
  correctness,
  performance,
  testing,
})) {
  if (!value) {
    throw new Error(`missing upstream job output: ${name}`);
  }
}

const { diff, truncated } = getDiff(baseRef);

const prompt = buildPrompt(
  new URL('./prompts/architecture.md', import.meta.url),
  {
    PLAN_JSON: JSON.stringify(plan, null, 2),
    SECURITY_FINDINGS_JSON: JSON.stringify(security, null, 2),
    CORRECTNESS_FINDINGS_JSON: JSON.stringify(correctness, null, 2),
    PERFORMANCE_FINDINGS_JSON: JSON.stringify(performance, null, 2),
    TESTING_FINDINGS_JSON: JSON.stringify(testing, null, 2),
    DIFF: diff,
    TRUNCATED_NOTE: truncated ? '（注意：diff 過大，內容已截斷）' : '',
  }
);

const architecture = await callGemini(prompt);
console.log('[architecture] result:', JSON.stringify(architecture, null, 2));

const comment = formatComment({
  plan,
  security,
  correctness,
  performance,
  testing,
  architecture,
});
writeFileSync('ai-review-comment.md', comment, 'utf-8');
