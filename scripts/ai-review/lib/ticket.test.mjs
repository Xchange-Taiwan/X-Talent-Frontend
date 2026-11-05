// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { extractTicketNumber, fetchTicketContext } from './ticket.mjs';

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
});
