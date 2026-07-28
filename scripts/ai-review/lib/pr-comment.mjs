const BOT_LOGIN = 'github-actions[bot]';

function parseNextLink(linkHeader) {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match) return match[1];
  }
  return null;
}

async function* listAllComments({ repo, issueNumber, token }) {
  let url = `https://api.github.com/repos/${repo}/issues/${issueNumber}/comments?per_page=100`;

  while (url) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!res.ok) {
      throw new Error(
        `GitHub API error listing comments (${res.status}): ${await res.text()}`
      );
    }
    yield* await res.json();
    url = parseNextLink(res.headers.get('link'));
  }
}

/**
 * Creates the PR comment carrying `marker`, or updates it in place if one
 * already exists — paginates through comment pages (stopping as soon as the
 * bot's own prior comment is found) so a long PR thread can't hide it on
 * page 2+ without requiring every page to be fetched.
 */
export async function upsertComment({
  repo,
  issueNumber,
  token,
  marker,
  body,
}) {
  let existing;
  for await (const comment of listAllComments({ repo, issueNumber, token })) {
    if (comment.user?.login === BOT_LOGIN && comment.body?.includes(marker)) {
      existing = comment;
      break;
    }
  }

  const url = existing
    ? `https://api.github.com/repos/${repo}/issues/comments/${existing.id}`
    : `https://api.github.com/repos/${repo}/issues/${issueNumber}/comments`;
  const method = existing ? 'PATCH' : 'POST';

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });

  if (!res.ok) {
    const action = existing ? 'updating' : 'creating';
    throw new Error(
      `GitHub API error ${action} comment (${res.status}): ${await res.text()}`
    );
  }

  return res.json();
}
