#!/usr/bin/env node
/**
 * Exports a complete GitHub Issue specification (title, state, metadata, top
 * description body, and non-command comments) via `gh issue view --json` or
 * REST fallback.
 *
 * Avoids the `gh issue view --comments > file` non-TTY trap where GitHub CLI
 * omits the issue title and top description body when stdout is redirected.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PURE_SLASH_COMMAND_RE =
  /^\s*\/(?:implement|fix-pr|skip-qa|needs-qa)(?:\s+--force)?\s*$/i;

export function isPureCommandComment(body = '') {
  return PURE_SLASH_COMMAND_RE.test(String(body ?? ''));
}

export function formatIssueJsonToSpecMarkdown(issue = {}) {
  const title = String(issue?.title ?? '')
    .replace(/[\r\n]+/g, ' ')
    .trim();
  const state = String(issue?.state ?? 'OPEN')
    .trim()
    .toUpperCase();
  const author = String(
    issue?.author?.login ?? issue?.user?.login ?? ''
  ).trim();
  const labels = Array.isArray(issue?.labels)
    ? issue.labels
        .map((item) =>
          typeof item === 'string'
            ? item.trim()
            : String(item?.name ?? '').trim()
        )
        .filter(Boolean)
        .join(', ')
    : '';
  const number = issue?.number ?? '';
  const body = String(issue?.body ?? '').trim();

  const rawComments = Array.isArray(issue?.comments)
    ? issue.comments
    : Array.isArray(issue?.comments?.nodes)
      ? issue.comments.nodes
      : [];

  const meaningfulComments = rawComments.filter((comment) => {
    const text = String(comment?.body ?? '').trim();
    return Boolean(text) && !isPureCommandComment(text);
  });

  const lines = [
    `title:\t${title}`,
    `state:\t${state}`,
    `author:\t${author}`,
    `labels:\t${labels}`,
    `comments:\t${meaningfulComments.length}`,
    `number:\t${number}`,
    '--',
    body,
  ];

  if (meaningfulComments.length > 0) {
    lines.push('', '## Issue Comments');
    for (const comment of meaningfulComments) {
      const cAuthor = String(
        comment?.author?.login ?? comment?.user?.login ?? 'unknown'
      ).trim();
      const createdAt = String(
        comment?.createdAt ?? comment?.created_at ?? ''
      ).trim();
      const header = createdAt
        ? `### [${createdAt}] @${cAuthor}`
        : `### @${cAuthor}`;
      lines.push('', header, String(comment?.body ?? '').trim());
    }
  }

  return `${lines.join('\n')}\n`;
}

export function fetchIssueSpecViaGh(
  { ticketNumber, repo = 'Xchange-Taiwan/X-Talent-Tracker', token = '' },
  { execGh = execFileSync } = {}
) {
  const cleanTicket = String(ticketNumber ?? '')
    .replace(/^#/, '')
    .trim();
  if (!/^\d+$/.test(cleanTicket)) {
    throw new Error(`Invalid ticket number: ${ticketNumber}`);
  }

  const env = {
    ...process.env,
    ...(token ? { GH_TOKEN: token } : {}),
  };

  try {
    const rawJson = execGh(
      'gh',
      [
        'issue',
        'view',
        cleanTicket,
        '--repo',
        repo,
        '--json',
        'number,title,state,author,labels,body,comments',
      ],
      {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        timeout: 20000,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    const parsed = JSON.parse(rawJson);
    if (parsed && (parsed.title || parsed.body)) {
      return formatIssueJsonToSpecMarkdown(parsed);
    }
  } catch {
    // Fall back to REST API below if GraphQL fields fail
  }

  const issueRaw = execGh(
    'gh',
    ['api', `repos/${repo}/issues/${cleanTicket}`],
    {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 20000,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  const issueObj = JSON.parse(issueRaw);
  let comments = [];
  try {
    const commentsRaw = execGh(
      'gh',
      [
        'api',
        '--paginate',
        `repos/${repo}/issues/${cleanTicket}/comments?per_page=100`,
      ],
      {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        timeout: 20000,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    const parsedComments = JSON.parse(commentsRaw);
    if (Array.isArray(parsedComments)) {
      comments = parsedComments;
    }
  } catch {
    // Proceed with top issue spec if comments fetch fails
  }

  return formatIssueJsonToSpecMarkdown({
    ...issueObj,
    comments,
  });
}

function parseCliOption(argv, prefix) {
  const found = argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : '';
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const argv = process.argv.slice(2);
  const ticketNumber =
    parseCliOption(argv, '--ticket=') || process.env.TICKET_NUMBER || '';
  const repo =
    parseCliOption(argv, '--repo=') || 'Xchange-Taiwan/X-Talent-Tracker';
  const outFile = parseCliOption(argv, '--out=');
  const token = process.env.TRACKER_READ_TOKEN || process.env.GH_TOKEN || '';

  try {
    const markdown = fetchIssueSpecViaGh({ ticketNumber, repo, token });
    if (outFile) {
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      fs.writeFileSync(outFile, markdown, 'utf8');
    } else {
      process.stdout.write(markdown);
    }
  } catch (err) {
    console.error(`[export-ticket-spec] Failed: ${err.message}`);
    process.exit(1);
  }
}
