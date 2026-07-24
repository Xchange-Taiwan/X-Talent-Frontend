import { execFileSync } from 'node:child_process';

import { TRACKER_OWNER, TRACKER_REPO } from './ticket-branch.mjs';

export class PrError extends Error {}

function ghRun(args) {
  try {
    return execFileSync('gh', args, {
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024 * 10,
    }).trim();
  } catch (err) {
    throw new PrError(
      `gh ${args.join(' ')} failed: ${err.stderr || err.message}`
    );
  }
}

function stripTicketTitlePrefix(title) {
  return title
    .replace(/^(\[[^\]]+\]\s*)+/, '')
    .replace(/^#?\d+\s*[—–-]\s*/, '')
    .trim();
}

/** Conventional-Commits-style subject line, reusing the repo's existing convention rather than inventing a new one. */
export function buildCommitSubject(ticket) {
  return `feat: ${stripTicketTitlePrefix(ticket.title)}`;
}

export function buildPrBody(ticket) {
  return [
    'Auto-created by `pnpm ai:dev --auto-pr` — the review pipeline judged this change low risk with zero findings.',
    '',
    `Closes ${TRACKER_OWNER}/${TRACKER_REPO}#${ticket.number}`,
  ].join('\n');
}

/** Returns the URL of an already-open PR for this branch, or null. Checked before creating to avoid `gh pr create` erroring on a duplicate. */
export function findOpenPrForBranch(branch) {
  const out = ghRun([
    'pr',
    'list',
    '--head',
    branch,
    '--state',
    'open',
    '--json',
    'url',
  ]);
  const prs = out ? JSON.parse(out) : [];
  return prs[0]?.url ?? null;
}

/** Returns the created PR's URL. */
export function createPr({ branch, title, body }) {
  return ghRun([
    'pr',
    'create',
    '--base',
    'develop',
    '--head',
    branch,
    '--title',
    title,
    '--body',
    body,
  ]);
}
