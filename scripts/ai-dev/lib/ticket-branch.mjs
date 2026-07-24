import { execFileSync } from 'node:child_process';

import {
  branchExistsLocally,
  branchExistsOnRemote,
  checkoutBranch,
  fetchAndCheckoutRemoteBranch,
  parseOwnerRepo,
  remoteOriginUrl,
} from './git.mjs';

export class TicketError extends Error {}

const TRACKER_OWNER = 'Xchange-Taiwan';
const TRACKER_REPO = 'X-Talent-Tracker';

/** Accepts `306`, `#306`, or a full issue URL and returns the bare number. */
export function normalizeTicketNumber(input) {
  const match = String(input).match(/(?:issues\/)?#?(\d+)\s*$/);
  if (!match) {
    throw new TicketError(`Could not parse a ticket number out of "${input}".`);
  }
  return Number(match[1]);
}

export function slugify(title) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '');
  return slug || 'ticket';
}

function ghGraphql(query, variables) {
  const args = ['api', 'graphql', '-f', `query=${query}`];
  for (const [key, value] of Object.entries(variables)) {
    if (typeof value === 'number' || typeof value === 'boolean') {
      args.push('-F', `${key}=${value}`);
    } else {
      args.push('-f', `${key}=${value}`);
    }
  }
  let raw;
  try {
    raw = execFileSync('gh', args, {
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024 * 10,
    });
  } catch (err) {
    throw new TicketError(
      `gh api graphql failed: ${err.stderr || err.message}`
    );
  }
  return JSON.parse(raw);
}

const ISSUE_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        id
        title
        body
        comments(first: 50) { nodes { author { login } body } }
        linkedBranches(first: 5) { nodes { ref { name } } }
      }
    }
  }
`;

/** Fetches ticket content + any already-linked branch. Distinguishes "not an issue" (e.g. a PR number was passed) with a friendly message rather than a raw GraphQL error. */
export function fetchTicket(number) {
  const data = ghGraphql(ISSUE_QUERY, {
    owner: TRACKER_OWNER,
    repo: TRACKER_REPO,
    number,
  });
  const issue = data?.data?.repository?.issue;
  if (!issue) {
    throw new TicketError(
      `Issue #${number} not found in ${TRACKER_OWNER}/${TRACKER_REPO}. ` +
        'If this is a Pull Request number, note that PRs are not issues — pass an Issue number.'
    );
  }
  return {
    number,
    nodeId: issue.id,
    title: issue.title,
    body: issue.body ?? '',
    comments: (issue.comments?.nodes ?? []).map((c) => ({
      author: c.author?.login ?? 'unknown',
      body: c.body ?? '',
    })),
    linkedBranchName: issue.linkedBranches?.nodes?.[0]?.ref?.name ?? null,
  };
}

const CREATE_LINKED_BRANCH_MUTATION = `
  mutation($issueId: ID!, $repositoryId: ID!, $oid: GitObjectID!, $name: String!) {
    createLinkedBranch(input: { issueId: $issueId, repositoryId: $repositoryId, oid: $oid, name: $name }) {
      linkedBranch { id }
    }
  }
`;

function getCodeRepoNodeId(owner, repo) {
  const data = ghGraphql(
    `query($owner: String!, $repo: String!) { repository(owner: $owner, name: $repo) { id } }`,
    { owner, repo }
  );
  const id = data?.data?.repository?.id;
  if (!id)
    throw new TicketError(
      `Could not resolve repository id for ${owner}/${repo}.`
    );
  return id;
}

function createLinkedBranch({ issueNodeId, repoNodeId, headOid, branchName }) {
  ghGraphql(CREATE_LINKED_BRANCH_MUTATION, {
    issueId: issueNodeId,
    repositoryId: repoNodeId,
    oid: headOid,
    name: branchName,
  });
}

/**
 * Ensures the ticket's branch is checked out locally, creating + linking it
 * if needed. Must be called while HEAD is on the up-to-date `develop` branch
 * (the caller is expected to have run updateDevelopFastForward() first) so a
 * freshly-created branch forks from the right place.
 */
export function setupTicketBranch(ticketInput, { headOid }) {
  const number = normalizeTicketNumber(ticketInput);
  const ticket = fetchTicket(number);

  const branchName =
    ticket.linkedBranchName || `feat/${number}-${slugify(ticket.title)}`;

  if (branchExistsLocally(branchName)) {
    checkoutBranch(branchName);
  } else if (branchExistsOnRemote(branchName)) {
    fetchAndCheckoutRemoteBranch(branchName);
  } else {
    const { owner: codeOwner, repo: codeRepo } =
      parseOwnerRepo(remoteOriginUrl());
    const repoNodeId = getCodeRepoNodeId(codeOwner, codeRepo);
    createLinkedBranch({
      issueNodeId: ticket.nodeId,
      repoNodeId,
      headOid,
      branchName,
    });
    fetchAndCheckoutRemoteBranch(branchName);
  }

  return { ...ticket, branchName };
}
