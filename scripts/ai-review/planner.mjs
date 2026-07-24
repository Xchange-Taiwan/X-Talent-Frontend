import { callGemini } from './lib/gemini.mjs';
import { getDiff } from './lib/diff.mjs';
import { fetchTicketContext } from './lib/ticket.mjs';
import { buildPrompt } from './lib/prompt.mjs';
import { encodeContext, writeGithubOutput } from './lib/context-io.mjs';

const baseRef = process.env.BASE_REF;
const headBranch = process.env.HEAD_REF || '';
const trackerToken = process.env.TRACKER_READ_TOKEN;

if (!baseRef) {
  throw new Error('BASE_REF env var is required');
}

const { diff, truncated } = getDiff(baseRef);

let ticket = { ticketFound: false };
if (trackerToken) {
  try {
    ticket = await fetchTicketContext(headBranch, trackerToken);
  } catch (err) {
    console.warn(
      `[planner] failed to fetch ticket context, falling back to diff-only: ${err.message}`
    );
  }
} else {
  console.warn('[planner] TRACKER_READ_TOKEN not set, skipping ticket lookup');
}

const ticketSection = ticket.ticketFound
  ? [
      '## 對應 Ticket',
      `**#${ticket.number} ${ticket.title}**`,
      '',
      ticket.body,
      '',
      '### Comments',
      ticket.comments.length
        ? ticket.comments.map((c) => `- ${c.author}: ${c.body}`).join('\n')
        : '(無留言)',
    ].join('\n')
  : '## 對應 Ticket\n（這個 PR 的 branch 名稱找不到對應的 ticket 編號，僅根據 diff 進行分析）';

const prompt = buildPrompt(new URL('./prompts/planner.md', import.meta.url), {
  TICKET_SECTION: ticketSection,
  DIFF: diff,
  TRUNCATED_NOTE: truncated ? '（注意：diff 過大，內容已截斷）' : '',
});

const plan = await callGemini(prompt);

console.log('[planner] plan:', JSON.stringify(plan, null, 2));
writeGithubOutput('plan', encodeContext(plan));
