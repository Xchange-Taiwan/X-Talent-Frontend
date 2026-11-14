// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  extractTicketNumber,
  fetchFullTicketContext,
  fetchTicketContext,
} from './ticket.mjs';

describe('ticket', () => {
  it('extracts ticket number from standard branch names', () => {
    expect(extractTicketNumber('feat/822-reservation-e2e')).toBe(822);
    expect(extractTicketNumber('fix/710-carousel')).toBe(710);
    expect(extractTicketNumber('test/825-static-routes')).toBe(825);
  });

  it('falls back to explicit ticket number when branch name does not contain a ticket prefix', () => {
    expect(extractTicketNumber('chore/custom-branch', '822')).toBe(822);
    expect(extractTicketNumber('chore/custom-branch', '#822')).toBe(822);
    expect(extractTicketNumber('chore/custom-branch', '')).toBeNull();
    expect(extractTicketNumber('chore/custom-branch', 'invalid')).toBeNull();
  });

  it('fetches issue and comments using fallback ticket number when branch has no prefix', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          title: 'Test issue',
          body: 'Acceptance criteria',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          { user: { login: 'LowSugarCoke' }, body: 'Comment 1' },
        ],
      });
    vi.stubGlobal('fetch', fetchMock);

    const ctx = await fetchTicketContext('promote/my-branch', 'token', '822');
    expect(ctx).toEqual({
      ticketFound: true,
      number: 822,
      title: 'Test issue',
      body: 'Acceptance criteria',
      comments: [{ author: 'LowSugarCoke', body: 'Comment 1' }],
    });
    vi.unstubAllGlobals();
  });

  it('paginates multi-page issue comments and builds prioritized htmlBlocks in fetchFullTicketContext', async () => {
    const page2Url =
      'https://api.github.com/repos/Xchange-Taiwan/X-Talent-Tracker/issues/882/comments?per_page=100&page=2';
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          title: 'Full Ticket',
          body: 'Top body',
          body_html: '<p>Top body</p>',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (name) =>
            name.toLowerCase() === 'link' ? `<${page2Url}>; rel="next"` : null,
        },
        json: async () => [
          {
            user: { login: 'reviewer1' },
            body: 'Old comment',
            body_html: '<p>Old comment</p>',
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => [
          {
            user: { login: 'reviewer2' },
            body: 'Latest comment',
            body_html: '<p>Latest comment</p>',
          },
        ],
      });

    const fullCtx = await fetchFullTicketContext(
      'refactor/882-pipeline',
      'token',
      '',
      { fetchImpl }
    );

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fullCtx.ticketFound).toBe(true);
    expect(fullCtx.comments).toHaveLength(2);
    expect(fullCtx.comments.map((c) => c.body)).toEqual([
      'Old comment',
      'Latest comment',
    ]);
    // prioritizeIssueAndCommentBlocks places top issue first, then newest comments first:
    expect(fullCtx.htmlBlocks.map((b) => b.body)).toEqual([
      'Top body',
      'Latest comment',
      'Old comment',
    ]);
  });
});
