// Identifies which additional API endpoints (beyond the mock server's
// built-in /v1/auth/login) this ticket's scenarios will call, and drafts a
// plausible JSON response for each — so QA scenarios that need real-looking
// data don't just 404 against the mock server. Same building blocks as
// scenario-planner.mjs (getDiff/callGemini/buildPrompt), single-turn JSON-out.
import { getDiff } from '../../ai-review/lib/diff.mjs';
import { callGemini } from '../../ai-review/lib/gemini.mjs';
import { buildPrompt } from '../../ai-review/lib/prompt.mjs';

const PROMPT_URL = new URL('../prompts/fixture-planner.md', import.meta.url);
const MAX_FIXTURES = 8;
const VALID_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

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

export function isValidFixture(f) {
  return (
    f &&
    VALID_METHODS.has(f.method) &&
    typeof f.path === 'string' &&
    f.path.startsWith('/') &&
    f.path !== '/v1/auth/login' && // baseline handler already owns this route
    typeof f.status === 'number' &&
    f.status >= 200 &&
    f.status < 600 &&
    f.body !== undefined &&
    f.body !== null &&
    typeof f.body === 'object'
  );
}

/**
 * Returns a validated `{ method, path, status, body }[]`, capped at
 * MAX_FIXTURES. Never throws on a malformed planner response — an empty
 * array just means scenarios only get the baseline login mock, and any
 * endpoint they actually need 404s loudly (see mock-api-server.mjs) rather
 * than silently serving something wrong-shaped.
 */
export async function planFixtures({ ticket, baseRef }) {
  const { diff, truncated } = getDiff(baseRef);
  const truncatedNote = truncated ? '（注意：diff 過大，內容已截斷）' : '';

  const prompt = buildPrompt(PROMPT_URL, {
    TICKET_SECTION: formatTicketSection(ticket),
    DIFF: diff,
    TRUNCATED_NOTE: truncatedNote,
  });

  let plan;
  try {
    plan = await callGemini(prompt);
  } catch (err) {
    console.warn(
      `[ai-qa] fixture planner call failed, proceeding with baseline mocks only: ${err.message}`
    );
    return [];
  }

  // plan.fixtures being present but not an array (e.g. the model returned a
  // string or object instead of a list) must degrade to "no fixtures", not
  // throw — this function's contract is "never throws on a malformed
  // planner response", and an uncaught TypeError here would abort the whole
  // QA run instead of just falling back to the baseline login mock.
  const fixtures = Array.isArray(plan?.fixtures) ? plan.fixtures : [];
  return fixtures.filter(isValidFixture).slice(0, MAX_FIXTURES);
}
