// Turns a ticket + diff into a bounded list of browser-executable QA
// scenarios. Mirrors scripts/ai-review/lib/review-bridge.mjs's runPlanner —
// same buildPrompt/callGemini building blocks, single-turn JSON-out call.
import { getDiff } from '../../ai-review/lib/diff.mjs';
import { callGemini } from '../../ai-review/lib/gemini.mjs';
import { buildPrompt } from '../../ai-review/lib/prompt.mjs';

const PROMPT_URL = new URL('../prompts/scenario-planner.md', import.meta.url);
const MAX_SCENARIOS = 5;
const VALID_ROLES = new Set(['visitor', 'mentee', 'mentor']);

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

/**
 * Returns `{ applicable, reason, scenarios }`. `scenarios` is always an
 * array (empty when !applicable), each capped/validated so a malformed
 * planner response can't hand the executor an unknown role or blow past the
 * scenario budget.
 */
export async function planScenarios({ ticket, baseRef }) {
  const { diff, truncated } = getDiff(baseRef);
  const truncatedNote = truncated ? '（注意：diff 過大，內容已截斷）' : '';

  const prompt = buildPrompt(PROMPT_URL, {
    TICKET_SECTION: formatTicketSection(ticket),
    DIFF: diff,
    TRUNCATED_NOTE: truncatedNote,
  });

  const plan = await callGemini(prompt);

  if (!plan?.applicable) {
    return {
      applicable: false,
      reason: plan?.reason ?? '規劃者判斷此變更無可觀察的畫面/互動影響。',
      scenarios: [],
    };
  }

  const scenarios = (plan.scenarios ?? [])
    .filter(
      (s) => s?.id && VALID_ROLES.has(s.role) && s.description && s.expected
    )
    .slice(0, MAX_SCENARIOS)
    .map((s) => ({
      id: s.id,
      role: s.role,
      route: s.route || '/',
      description: s.description,
      expected: s.expected,
    }));

  if (scenarios.length === 0) {
    return {
      applicable: false,
      reason: '規劃者回傳 applicable:true 但沒有任何有效情境，視為不適用。',
      scenarios: [],
    };
  }

  return { applicable: true, reason: plan.reason ?? '', scenarios };
}
