import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/auth.config', () => ({
  default: {},
}));

vi.mock('next/server', () => ({
  after: vi.fn(),
}));

vi.mock('@/lib/profile/confirmDeletionSynced', () => ({
  confirmDeletionSynced: vi.fn(),
}));

import { after } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { confirmDeletionSynced } from '@/lib/profile/confirmDeletionSynced';

import { revalidateProfilePathAfterDelete } from './auth';

const mockGetServerSession = vi.mocked(getServerSession);
const mockAfter = vi.mocked(after);
const mockConfirmDeletionSynced = vi.mocked(confirmDeletionSynced);

describe('revalidateProfilePathAfterDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirmDeletionSynced.mockResolvedValue(undefined);
  });

  it('no-ops when there is no session (anonymous/unauthenticated caller)', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);

    await revalidateProfilePathAfterDelete();

    expect(mockAfter).not.toHaveBeenCalled();
  });

  // Not a realistic NextAuth shape (id is always a numeric-string here),
  // but this is the same "don't trust the payload" reasoning as
  // revalidateProfilePath's isValidUserId cases — belt-and-suspenders
  // against a malformed/tampered session object reaching this far.
  it('no-ops when the session has a non-numeric user id', async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: '../about', name: 'Someone' },
    } as never);

    await revalidateProfilePathAfterDelete();

    expect(mockAfter).not.toHaveBeenCalled();
  });

  it("derives the id/name from the caller's own session and returns immediately, deferring confirmDeletionSynced to run after the response via after()", async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: '42', name: 'Jane Doe' },
    } as never);

    let resolveConfirm: () => void = () => {};
    mockConfirmDeletionSynced.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveConfirm = resolve;
      })
    );

    await revalidateProfilePathAfterDelete();

    // Scheduled via after(), but nothing has run yet — the caller (e.g.
    // useDeleteAccountForm, right before signOut) is never blocked on this.
    expect(mockAfter).toHaveBeenCalledTimes(1);
    expect(mockConfirmDeletionSynced).not.toHaveBeenCalled();

    // Simulate Next.js invoking the deferred callback after the response.
    const deferredWork = mockAfter.mock.calls[0][0] as () => Promise<void>;
    const workPromise = deferredWork();
    expect(mockConfirmDeletionSynced).toHaveBeenCalledWith(
      42,
      '42',
      'Jane Doe'
    );

    resolveConfirm();
    await workPromise;
  });

  it('works without a session name (passes undefined through to confirmDeletionSynced)', async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: '42' },
    } as never);

    await revalidateProfilePathAfterDelete();
    const deferredWork = mockAfter.mock.calls[0][0] as () => Promise<void>;
    await deferredWork();

    expect(mockConfirmDeletionSynced).toHaveBeenCalledWith(42, '42', undefined);
  });
});
