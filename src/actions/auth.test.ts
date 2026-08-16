import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/auth.config', () => ({
  default: {},
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/server', () => ({
  after: vi.fn(),
}));

vi.mock('@/lib/monitoring', () => ({
  captureFlowFailure: vi.fn(),
}));

vi.mock('@/lib/profile/pollUntilSynced', () => ({
  pollUntilUserDeleted: vi.fn(),
}));

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { captureFlowFailure } from '@/lib/monitoring';
import { pollUntilUserDeleted } from '@/lib/profile/pollUntilSynced';

import { revalidateProfilePathAfterDelete } from './auth';

const mockGetServerSession = vi.mocked(getServerSession);
const mockRevalidatePath = vi.mocked(revalidatePath);
const mockAfter = vi.mocked(after);
const mockCaptureFlowFailure = vi.mocked(captureFlowFailure);
const mockPollUntilUserDeleted = vi.mocked(pollUntilUserDeleted);

describe('revalidateProfilePathAfterDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPollUntilUserDeleted.mockResolvedValue(true);
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

  it("derives the id/name from the caller's own session and returns immediately, deferring the poll + revalidate to run after the response via after()", async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: '42', name: 'Jane Doe' },
    } as never);

    let resolvePoll: (value: boolean) => void = () => {};
    mockPollUntilUserDeleted.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolvePoll = resolve;
      })
    );

    await revalidateProfilePathAfterDelete();

    // Scheduled via after(), but nothing has run yet — the caller (e.g.
    // useDeleteAccountForm, right before signOut) is never blocked on this.
    expect(mockAfter).toHaveBeenCalledTimes(1);
    expect(mockRevalidatePath).not.toHaveBeenCalled();

    // Simulate Next.js invoking the deferred callback after the response.
    const deferredWork = mockAfter.mock.calls[0][0] as () => Promise<void>;
    const workPromise = deferredWork();
    expect(mockRevalidatePath).not.toHaveBeenCalled();

    resolvePoll(true);
    await workPromise;

    expect(mockPollUntilUserDeleted).toHaveBeenCalledWith(42, 'Jane Doe');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/profile/42');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/mentor-pool');
  });

  it('works without a session name (falls back to an unscoped poll)', async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: '42' },
    } as never);

    await revalidateProfilePathAfterDelete();
    const deferredWork = mockAfter.mock.calls[0][0] as () => Promise<void>;
    await deferredWork();

    expect(mockPollUntilUserDeleted).toHaveBeenCalledWith(42, undefined);
  });

  it('revalidates even if the poll exhausts its retry budget without confirming', async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: '42', name: 'Jane Doe' },
    } as never);
    mockPollUntilUserDeleted.mockResolvedValueOnce(false);

    await revalidateProfilePathAfterDelete();
    const deferredWork = mockAfter.mock.calls[0][0] as () => Promise<void>;
    await deferredWork();

    expect(mockRevalidatePath).toHaveBeenCalledWith('/profile/42');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/mentor-pool');
  });

  it('deferred work failure (pollUntilUserDeleted throws) is caught and reported, not left as an unhandled rejection', async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: '42', name: 'Jane Doe' },
    } as never);
    mockPollUntilUserDeleted.mockRejectedValueOnce(new Error('poll blew up'));

    await revalidateProfilePathAfterDelete();
    const deferredWork = mockAfter.mock.calls[0][0] as () => Promise<void>;

    await expect(deferredWork()).resolves.not.toThrow();

    expect(mockRevalidatePath).not.toHaveBeenCalled();
    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'delete_account',
        step: 'after_revalidate',
        message: 'poll blew up',
        level: 'warning',
      })
    );
  });
});
