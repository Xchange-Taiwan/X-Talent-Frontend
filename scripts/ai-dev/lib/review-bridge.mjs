// Mirrors the CI ai-review pipeline exactly: Planner -> 6 parallel specialist
// reviewers (Security / Correctness / Business Logic / Performance / Testing /
// Architecture) -> a final Summary judgment call. Reuses the CI pipeline's
// own prompts, shared fragments, diff extraction, and Gemini client — this
// file is just the local orchestration of the same building blocks CI uses
// as separate GitHub Actions jobs.
import { getDiff } from '../../ai-review/lib/diff.mjs';
import { callGemini } from '../../ai-review/lib/gemini.mjs';
import { buildPrompt } from '../../ai-review/lib/prompt.mjs';

const PROMPTS_DIR = new URL('../../ai-review/prompts/', import.meta.url);

const SPECIALISTS = [
  { key: 'security', title: '🔒 Security' },
  { key: 'correctness', title: '🧩 Correctness / Regression' },
  { key: 'business-logic', title: '🧭 Business Logic / Requirements' },
  { key: 'performance', title: '⚡ Performance' },
  { key: 'testing', title: '🧪 Testing' },
  { key: 'architecture', title: '🏗️ Architecture / Code Smell' },
];

function formatTicketSection(ticket) {
  const commentsText = ticket.comments.length
    ? ticket.comments.map((c) => `- ${c.author}: ${c.body}`).join('\n')
    : '(無留言)';
  return [
    `**#${ticket.number} ${ticket.title}**`,
    '',
    ticket.body,
    '',
    '### Comments',
    commentsText,
  ].join('\n');
}

// Round 6 risk: warn well before diff.mjs's own 60000-char hard truncation.
const DIFF_SIZE_WARNING_THRESHOLD = 40_000;

async function runPlanner({ ticketSection, diff, truncatedNote }) {
  const prompt = buildPrompt(new URL('planner.md', PROMPTS_DIR), {
    TICKET_SECTION: ticketSection,
    DIFF: diff,
    TRUNCATED_NOTE: truncatedNote,
  });
  return callGemini(prompt);
}

async function runSpecialist(key, plan, diff, truncatedNote) {
  try {
    const prompt = buildPrompt(new URL(`${key}.md`, PROMPTS_DIR), {
      PLAN_JSON: JSON.stringify(plan, null, 2),
      DIFF: diff,
      TRUNCATED_NOTE: truncatedNote,
    });
    return await callGemini(prompt);
  } catch (err) {
    // One specialist failing must not kill the whole review round — the
    // others still have useful findings, and this one shows up as "not run".
    console.warn(`[review-bridge] ${key} reviewer failed: ${err.message}`);
    return null;
  }
}

async function runSummary(plan, findingsByKey) {
  try {
    const replacements = { PLAN_JSON: JSON.stringify(plan, null, 2) };
    for (const { key } of SPECIALISTS) {
      const placeholder =
        key.toUpperCase().replace(/-/g, '_') + '_FINDINGS_JSON';
      replacements[placeholder] = JSON.stringify(
        findingsByKey[key] ?? null,
        null,
        2
      );
    }
    const prompt = buildPrompt(
      new URL('summary.md', PROMPTS_DIR),
      replacements
    );
    return await callGemini(prompt);
  } catch (err) {
    console.warn(`[review-bridge] summary judgment failed: ${err.message}`);
    return null;
  }
}

/**
 * Runs the full CI-equivalent review pipeline against the cumulative diff
 * (baseRef...HEAD). Unlike the CI pipeline this returns a single
 * `hasBlockingFindings` boolean for the orchestrator's loop-continue
 * decision — defined as the Summary agent's overallRisk being "high".
 * "medium"/"low" findings still get surfaced in the flattened `findings`
 * list and in the printed report, they just don't force another round.
 */
export async function reviewDiff({ baseRef, ticket }) {
  const { diff, truncated } = getDiff(baseRef);
  const truncatedNote = truncated ? '（注意：diff 過大，內容已截斷）' : '';

  if (diff.length > DIFF_SIZE_WARNING_THRESHOLD) {
    console.warn(
      `[review] cumulative diff is ${diff.length} chars — approaching the truncation limit. ` +
        'Consider splitting this task if it keeps growing.'
    );
  }

  const plan = await runPlanner({
    ticketSection: formatTicketSection(ticket),
    diff,
    truncatedNote,
  });

  const results = await Promise.all(
    SPECIALISTS.map(({ key }) => runSpecialist(key, plan, diff, truncatedNote))
  );
  const findingsByKey = Object.fromEntries(
    SPECIALISTS.map(({ key }, i) => [key, results[i]])
  );

  const summary = await runSummary(plan, findingsByKey);

  const findings = SPECIALISTS.flatMap(({ key, title }) => {
    const result = findingsByKey[key];
    if (!result?.hasFindings) return [];
    return (result.findings ?? []).map((f) => ({ ...f, source: title }));
  });

  const overallRisk = summary?.overallRisk ?? null;
  const hasBlockingFindings = overallRisk?.level === 'high';

  return {
    hasBlockingFindings,
    summary: overallRisk
      ? `${overallRisk.level} — ${overallRisk.reason}`
      : (plan?.requirementSummary ?? ''),
    findings,
    overallRisk,
    mergeRecommendation: summary?.mergeRecommendation ?? null,
    plan,
  };
}
