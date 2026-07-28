const BOT_LOGIN = 'github-actions[bot]';

function parseNextLink(linkHeader) {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match) return match[1];
  }
  return null;
}

async function listAllComments({ repo, issueNumber, token }) {
  const comments = [];
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
    comments.push(...(await res.json()));
    url = parseNextLink(res.headers.get('link'));
  }

  return comments;
}

/**
 * Creates the PR comment carrying `marker`, or updates it in place if one
 * already exists — paginates through every comment page so a long PR thread
 * can't hide the bot's own prior comment on page 2+.
 */
export async function upsertComment({
  repo,
  issueNumber,
  token,
  marker,
  body,
}) {
  const comments = await listAllComments({ repo, issueNumber, token });
  const existing = comments.find(
    (c) => c.user?.login === BOT_LOGIN && c.body?.includes(marker)
  );

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
