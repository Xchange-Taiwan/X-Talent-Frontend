import { prioritizeIssueAndCommentBlocks } from '../../prefetch-ticket-visuals.mjs';

const TICKET_BRANCH_PATTERN =
  /^(?:feat|fix|chore|refactor|perf|docs|test)\/(\d+)-/;
const TRACKER_OWNER = 'Xchange-Taiwan';
const TRACKER_REPO = 'X-Talent-Tracker';
const MAX_COMMENT_PAGES = 20;
const NL = String.fromCharCode(10);
const BACKSLASH = String.fromCharCode(92);

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

function parseNextLink(linkHeader) {
  if (!linkHeader) return null;
  for (const part of String(linkHeader).split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match) return match[1];
  }
  return null;
}

async function ghGet(
  urlOrPath,
  token,
  { accept = 'application/vnd.github+json', fetchImpl = fetch } = {}
) {
  const url = urlOrPath.startsWith('https://')
    ? urlOrPath
    : `https://api.github.com/repos/${TRACKER_OWNER}/${TRACKER_REPO}${urlOrPath}`;
  const res = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: accept,
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API error fetching ${urlOrPath} (${res.status})`);
  }
  const data = await res.json();
  const nextUrl = parseNextLink(res.headers?.get?.('link'));
  return { data, nextUrl };
}

async function fetchPaginatedIssueComments(
  number,
  token,
  { accept = 'application/vnd.github+json', fetchImpl = fetch } = {}
) {
  const allComments = [];
  let nextUrl = `/issues/${number}/comments?per_page=100`;
  let pageCount = 0;

  while (nextUrl && pageCount < MAX_COMMENT_PAGES) {
    pageCount += 1;
    const { data, nextUrl: linkNext } = await ghGet(nextUrl, token, {
      accept,
      fetchImpl,
    });
    if (Array.isArray(data)) {
      allComments.push(...data);
    }
    nextUrl = linkNext;
  }

  return allComments;
}

/**
 * Parses the ticket number out of the PR's head branch name (or uses an
 * explicit fallback ticket number) and fetches the corresponding issue +
 * paginated comments from the (private) X-Talent-Tracker repo.
 * Returns { ticketFound: false } when no valid ticket number is present.
 */
export async function fetchTicketContext(
  branchName,
  token,
  fallbackTicket,
  { fetchImpl = fetch } = {}
) {
  const number = extractTicketNumber(branchName, fallbackTicket);
  if (!number) {
    return { ticketFound: false };
  }

  const { data: issue } = await ghGet(`/issues/${number}`, token, {
    fetchImpl,
  });
  const comments = await fetchPaginatedIssueComments(number, token, {
    fetchImpl,
  });

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

/**
 * Single-flight full issue + paginated comments loader (`application/vnd.github.full+json`),
 * returning both plain text (`body`) and rendered HTML (`body_html` / `htmlBlocks`)
 * so downstream stages and visual reference extraction share one GitHub API round-trip.
 */
export async function fetchFullTicketContext(
  branchName,
  token,
  fallbackTicket,
  { fetchImpl = fetch } = {}
) {
  const number = extractTicketNumber(branchName, fallbackTicket);
  if (!number || !token) {
    return { ticketFound: false };
  }

  const accept = 'application/vnd.github.full+json';
  const { data: issue } = await ghGet(`/issues/${number}`, token, {
    accept,
    fetchImpl,
  });
  const rawComments = await fetchPaginatedIssueComments(number, token, {
    accept,
    fetchImpl,
  });

  return {
    ticketFound: true,
    number,
    title: issue.title ?? '',
    body: issue.body ?? '',
    bodyHtml: issue.body_html ?? '',
    comments: rawComments.map((c) => ({
      author: c.user?.login ?? 'unknown',
      body: c.body ?? '',
      bodyHtml: c.body_html ?? '',
    })),
    htmlBlocks: prioritizeIssueAndCommentBlocks(issue, rawComments),
  };
}

const ARCH_KB_ENDPOINT =
  process.env.ARCH_KB_ENDPOINT ||
  'https://x-talent-discord-mention-notify.x-talent.workers.dev/__arch-kb';

/**
 * Fetches the pre-indexed X-Talent Architecture Knowledge Base (Global Map +
 * matched Domain Cards for Frontend, Backend, AWS Infra, BFF Contracts, ADRs,
 * and Figma Route Mappings) from the Cloudflare KV Worker endpoint.
 * Fails gracefully (returns null) if offline or unreachable.
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
  const f = String(filePath).split(BACKSLASH).join('/').trim();
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
    NL + NL + '## X-Talent 跨專案架構知識庫 (Cloudflare KV Architecture KB)',
  ];
  if (kb.matchedDesignSpecs && designSpecs === kb.matchedDesignSpecs) {
    parts.push(
      [
        '### Design Hub 定案畫面與元件規格 (Single Source of Truth)',
        '```json',
        JSON.stringify(kb.matchedDesignSpecs, null, 2).slice(0, 8000),
        '```',
      ].join(NL)
    );
  }
  const restKb = {
    matchedDomains: kb.matchedDomains,
    globalMap: kb.globalMap,
    ticketsPool: kb.ticketsPool,
  };
  parts.push(
    ['```json', JSON.stringify(restKb, null, 2).slice(0, 14000), '```'].join(NL)
  );
  return parts.join(NL + NL);
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
