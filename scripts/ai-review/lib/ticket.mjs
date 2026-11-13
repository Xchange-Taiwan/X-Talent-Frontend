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
  const comments = await ghGet(
    `/issues/${number}/comments?per_page=100`,
    token
  );

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
export async function fetchRawArchitectureKb(queryText) {
  try {
    const res = await fetch(ARCH_KB_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: String(queryText || '').slice(0, 1000) }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.kb ?? null;
  } catch {
    return null;
  }
}

export function isUiReviewFile(filePath = '') {
  const f = String(filePath).replace(/\\/g, '/').trim();
  if (!f) return false;
  if (/\.(test|spec|stories)\.(ts|tsx|js|jsx)$/.test(f)) return false;
  if (f.startsWith('src/app/api/')) return false;
  return (
    (f.startsWith('src/app/') ||
      f.startsWith('src/components/') ||
      f.startsWith('src/styles/')) &&
    /\.(tsx|jsx|css)$/.test(f)
  );
}

export function resolveDesignSpecsFromKb(kb) {
  const isNonEmpty = (val) => {
    if (!val || typeof val !== 'object') return false;
    if (Array.isArray(val)) return val.length > 0;
    return Object.keys(val).length > 0;
  };
  if (isNonEmpty(kb?.matchedDesignSpecs)) return kb.matchedDesignSpecs;
  if (isNonEmpty(kb?.matchedDomains?.design_hub)) {
    return kb.matchedDomains.design_hub;
  }
  return null;
}

export function formatArchitectureKnowledgeBase(kb) {
  if (!kb) return '';
  const designSpecs = resolveDesignSpecsFromKb(kb);
  const parts = [
    '\n\n## X-Talent 跨專案架構知識庫 (Cloudflare KV Architecture KB)',
  ];
  if (kb.matchedDesignSpecs && designSpecs === kb.matchedDesignSpecs) {
    parts.push(
      '### Design Hub 定案畫面與元件規格 (Single Source of Truth)\n```json\n' +
        JSON.stringify(kb.matchedDesignSpecs, null, 2).slice(0, 8000) +
        '\n```'
    );
  }
  const restKb = {
    matchedDomains: kb.matchedDomains,
    globalMap: kb.globalMap,
    ticketsPool: kb.ticketsPool,
  };
  parts.push(
    '```json\n' + JSON.stringify(restKb, null, 2).slice(0, 14000) + '\n```'
  );
  return parts.join('\n\n');
}

/**
 * Fetches the pre-indexed X-Talent Architecture Knowledge Base (putting
 * `matchedDesignSpecs` and `matchedDomains` first so Design Hub rules and
 * domain schemas are never truncated by large ticket pools).
 */
export async function fetchArchitectureKnowledgeBase(queryText) {
  const kb = await fetchRawArchitectureKb(queryText);
  return formatArchitectureKnowledgeBase(kb);
}
