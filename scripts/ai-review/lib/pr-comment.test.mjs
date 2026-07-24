// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { upsertComment } from './pr-comment.mjs';

const MARKER = '<!-- ai-review-pipeline -->';

function jsonResponse(body, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function withLink(response, link) {
  return {
    ...response,
    headers: { get: (name) => (name.toLowerCase() === 'link' ? link : null) },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('upsertComment', () => {
  it('paginates through every comment page via the Link header before deciding whether a bot comment exists', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        withLink(
          jsonResponse([
            { id: 1, user: { login: 'someone' }, body: 'unrelated comment' },
          ]),
          '<https://api.github.com/repos/o/r/issues/5/comments?per_page=100&page=2>; rel="next"'
        )
      )
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: 2,
            user: { login: 'github-actions[bot]' },
            body: `${MARKER}\nold content`,
          },
        ])
      )
      .mockResolvedValueOnce(jsonResponse({ id: 2, body: 'updated' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await upsertComment({
      repo: 'o/r',
      issueNumber: 5,
      token: 't',
      marker: MARKER,
      body: 'new',
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.github.com/repos/o/r/issues/5/comments?per_page=100'
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://api.github.com/repos/o/r/issues/5/comments?per_page=100&page=2'
    );
    expect(result).toEqual({ id: 2, body: 'updated' });
  });

  it('PATCHes the existing bot comment (found on a later page) instead of creating a duplicate', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        withLink(
          jsonResponse([{ id: 1, user: { login: 'someone' }, body: 'noise' }]),
          '<https://api.github.com/repos/o/r/issues/5/comments?page=2>; rel="next"'
        )
      )
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: 2,
            user: { login: 'github-actions[bot]' },
            body: `${MARKER}\nold`,
          },
        ])
      )
      .mockResolvedValueOnce(jsonResponse({ id: 2, body: 'updated' }));
    vi.stubGlobal('fetch', fetchMock);

    await upsertComment({
      repo: 'o/r',
      issueNumber: 5,
      token: 't',
      marker: MARKER,
      body: 'new',
    });

    const [patchUrl, patchOpts] = fetchMock.mock.calls[2];
    expect(patchUrl).toBe('https://api.github.com/repos/o/r/issues/comments/2');
    expect(patchOpts.method).toBe('PATCH');
    expect(JSON.parse(patchOpts.body)).toEqual({ body: 'new' });
  });

  it('POSTs a new comment when no existing bot comment carries the marker', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ id: 99, body: 'new' }));
    vi.stubGlobal('fetch', fetchMock);

    await upsertComment({
      repo: 'o/r',
      issueNumber: 5,
      token: 't',
      marker: MARKER,
      body: 'new',
    });

    const [postUrl, postOpts] = fetchMock.mock.calls[1];
    expect(postUrl).toBe('https://api.github.com/repos/o/r/issues/5/comments');
    expect(postOpts.method).toBe('POST');
  });

  it('does not mistake another user’s comment containing the marker text for the bot’s own', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: 1,
            user: { login: 'someone-else' },
            body: `${MARKER} pretending to be the bot`,
          },
        ])
      )
      .mockResolvedValueOnce(jsonResponse({ id: 100, body: 'new' }));
    vi.stubGlobal('fetch', fetchMock);

    await upsertComment({
      repo: 'o/r',
      issueNumber: 5,
      token: 't',
      marker: MARKER,
      body: 'new',
    });

    const [, postOpts] = fetchMock.mock.calls[1];
    expect(postOpts.method).toBe('POST');
  });

  it('throws a descriptive error when listing comments returns a non-2xx status', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ message: 'bad creds' }, { status: 401 })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      upsertComment({
        repo: 'o/r',
        issueNumber: 5,
        token: 'bad',
        marker: MARKER,
        body: 'new',
      })
    ).rejects.toThrow(/listing comments \(401\)/i);
  });

  it('throws a descriptive error when creating/updating the comment returns a non-2xx status', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(
        jsonResponse({ message: 'nope' }, { status: 403 })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      upsertComment({
        repo: 'o/r',
        issueNumber: 5,
        token: 't',
        marker: MARKER,
        body: 'new',
      })
    ).rejects.toThrow(/creating comment \(403\)/i);
  });

  it('follows only the "next" rel when the Link header also carries "prev"/"last"', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        withLink(
          jsonResponse([{ id: 1, user: { login: 'someone' }, body: 'noise' }]),
          '<https://api.github.com/repos/o/r/issues/5/comments?page=1>; rel="prev", ' +
            '<https://api.github.com/repos/o/r/issues/5/comments?page=3>; rel="next", ' +
            '<https://api.github.com/repos/o/r/issues/5/comments?page=5>; rel="last"'
        )
      )
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ id: 1 }));
    vi.stubGlobal('fetch', fetchMock);

    await upsertComment({
      repo: 'o/r',
      issueNumber: 5,
      token: 't',
      marker: MARKER,
      body: 'new',
    });

    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://api.github.com/repos/o/r/issues/5/comments?page=3'
    );
  });
});
