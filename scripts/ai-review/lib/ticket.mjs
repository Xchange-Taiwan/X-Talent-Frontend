const TICKET_BRANCH_PATTERN =
  /^(?:feat|fix|chore|refactor|perf|docs|test)\/(\d+)-/;
const TRACKER_OWNER = 'Xchange-Taiwan';
const TRACKER_REPO = 'X-Talent-Tracker';

export function extractTicketNumber(branchName, fallbackTicket) {
  const match = branchName?.match(TICKET_BRANCH_PATTERN);
  if (match) {
    return Number(match[1]);
  }
  const cleanFallback = String(fallbackTicket ?? '')
    .replace(/^#/, '')
    .trim();
  if (/^\d+$/.test(cleanFallback)) {
    const num = Number(cleanFallback);
    return num > 0 ? num : null;
  }
  return null;
}

async function ghGet(apiPath, token) {
  const res = await fetch(
    `https://api.github.com/repos/${TRACKER_OWNER}/${TRACKER_REPO}${apiPath}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );
  if (!res.ok) {
    throw new Error(`GitHub API error fetching ${apiPath} (${res.status})`);
  }
  return res.json();
}

/**
 * Parses the ticket number out of the PR's head branch name (or uses an
 * explicit fallback ticket number) and fetches the corresponding issue +
 * comments from the (private) X-Talent-Tracker repo.
 * Returns { ticketFound: false } when no valid ticket number is present,
 * or when the token is missing/invalid — callers should treat that as
 * "no ticket context available", not a hard failure.
 */
export async function fetchTicketContext(branchName, token, fallbackTicket) {
  const number = extractTicketNumber(branchName, fallbackTicket);
  if (!number) {
    return { ticketFound: false };
  }

  const issue = await ghGet(`/issues/${number}`, token);
  const comments = await ghGet(`/issues/${number}/comments`, token);

  return {
    ticketFound: true,
    number,
    title: issue.title,
    body: issue.body ?? '',
    comments: comments.map((c) => ({
      author: c.user?.login ?? 'unknown',
      body: c.body ?? '',
    })),
  };
}

const ARCH_KB_ENDPOINT =
  process.env.ARCH_KB_ENDPOINT ||
  'https://x-talent-discord-mention-notify.x-talent.workers.dev/__arch-kb';

/**
 * Fetches the pre-indexed X-Talent Architecture Knowledge Base (Global Map +
 * matched Domain Cards for Frontend, Backend, AWS Infra, BFF Contracts, ADRs,
 * and Figma Route Mappings) from the Cloudflare KV Worker endpoint.
 * Fails gracefully (returns '') if offline or unreachable.
 */
export async function fetchArchitectureKnowledgeBase(queryText) {
  try {
    const res = await fetch(ARCH_KB_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: String(queryText || '').slice(0, 1000) }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return '';
    const data = await res.json();
    if (!data?.kb) return '';
    return (
      '\n\n## X-Talent 跨專案架構知識庫 (Cloudflare KV Architecture KB)\n```json\n' +
      JSON.stringify(data.kb, null, 2).slice(0, 12000) +
      '\n```'
    );
  } catch {
    return '';
  }
}
