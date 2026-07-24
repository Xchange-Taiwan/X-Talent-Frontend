// Reuses the CI ai-review building blocks (diff extraction, the Gemini
// text-in/JSON-out client, and the business-rules/project-context prompt
// fragments) instead of fanning out to all 7 CI specialist reviewers — a
// local iteration loop needs one fast combined pass, not a full PR-grade
// pipeline on every round.
import { getDiff } from '../../ai-review/lib/diff.mjs';
import { callGemini } from '../../ai-review/lib/gemini.mjs';
import { buildPrompt } from '../../ai-review/lib/prompt.mjs';

const PROMPT_URL = new URL('../prompts/dev-review.md', import.meta.url);

// Round 6 risk: warn well before diff.mjs's own 60000-char hard truncation
// so the user finds out the task has grown too large before a MAX_TOKENS
// failure ends the run instead.
const DIFF_SIZE_WARNING_THRESHOLD = 40_000;

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

/** Runs the reviewer against the full cumulative diff (baseRef...HEAD, including all WIP commits so far). */
export async function reviewDiff({ baseRef, ticket }) {
  const { diff, truncated } = getDiff(baseRef);

  if (diff.length > DIFF_SIZE_WARNING_THRESHOLD) {
    console.warn(
      `[review] cumulative diff is ${diff.length} chars — approaching the truncation limit. ` +
        'Consider splitting this task if it keeps growing.'
    );
  }

  const prompt = buildPrompt(PROMPT_URL, {
    TICKET_SECTION: formatTicketSection(ticket),
    DIFF: diff,
    TRUNCATED_NOTE: truncated ? '（注意：diff 過大，內容已截斷）' : '',
  });

  const result = await callGemini(prompt);
  return {
    hasBlockingFindings: Boolean(result.hasBlockingFindings),
    summary: result.summary ?? '',
    findings: Array.isArray(result.findings) ? result.findings : [],
  };
}
