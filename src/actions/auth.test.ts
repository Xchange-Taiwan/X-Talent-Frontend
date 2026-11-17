import { fromPartial } from '@total-typescript/shoehorn';
import type { Session } from 'next-auth';
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

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/profile/pollUntilSynced', () => ({
  confirmDeletionSynced: vi.fn(),
}));

vi.mock('@/lib/auth/bffSession.server', () => ({
  exchangeGoogleOAuthCodeWithBridge: vi.fn(),
}));

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { getServerSession } from 'next-auth/next';

import {
  exchangeGoogleOAuthCodeWithBridge,
  type OAuthCallbackResponse,
} from '@/lib/auth/bffSession.server';
import { confirmDeletionSynced } from '@/lib/profile/pollUntilSynced';

import { googleCallback, revalidateProfilePathAfterDelete } from './auth';

const mockGetServerSession = vi.mocked(getServerSession);
const mockAfter = vi.mocked(after);
const mockRevalidatePath = vi.mocked(revalidatePath);
const mockConfirmDeletionSynced = vi.mocked(confirmDeletionSynced);
const mockExchangeGoogleOAuthCode = vi.mocked(
  exchangeGoogleOAuthCodeWithBridge
);

describe('googleCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates Google OAuth code exchange to exchangeGoogleOAuthCodeWithBridge', async () => {
    const expected = fromPartial<OAuthCallbackResponse>({
      code: '0',
      msg: 'ok',
      data: { auth_type: 'LOGIN' },
    });
    mockExchangeGoogleOAuthCode.mockResolvedValueOnce(expected);

    const result = await googleCallback('oauth_code', 'oauth_state');

    expect(mockExchangeGoogleOAuthCode).toHaveBeenCalledWith(
      'oauth_code',
      'oauth_state'
    );
    expect(result).toBe(expected);
  });
});

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
    mockGetServerSession.mockResolvedValueOnce(
      fromPartial<Session>({
        user: { id: '../about', name: 'Someone' },
      })
    );

    await revalidateProfilePathAfterDelete();

    expect(mockAfter).not.toHaveBeenCalled();
  });

  it("derives the id/name from the caller's own session and returns immediately, deferring confirmDeletionSynced to run after the response via after()", async () => {
    mockGetServerSession.mockResolvedValueOnce(
      fromPartial<Session>({
        user: { id: '42', name: 'Jane Doe' },
      })
    );

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
    const deferredWork = mockAfter.mock.calls[0][0];
    if (typeof deferredWork === 'function') {
      const workPromise = deferredWork();
      expect(mockConfirmDeletionSynced).toHaveBeenCalledWith(
        42,
        'Jane Doe',
        expect.arrayContaining([expect.any(Function), expect.any(Function)])
      );

      resolveConfirm();
      await workPromise;
    }
  });

  it('works without a session name (passes undefined through to confirmDeletionSynced)', async () => {
    mockGetServerSession.mockResolvedValueOnce(
      fromPartial<Session>({
        user: { id: '42' },
      })
    );

    await revalidateProfilePathAfterDelete();
    const deferredWork = mockAfter.mock.calls[0][0];
    if (typeof deferredWork === 'function') {
      await deferredWork();
    }

    expect(mockConfirmDeletionSynced).toHaveBeenCalledWith(
      42,
      undefined,
      expect.any(Array)
    );
  });

  it("passes the profile-path and mentor-pool revalidate calls as separate callbacks that actually call revalidatePath with the caller's own id", async () => {
    mockGetServerSession.mockResolvedValueOnce(
      fromPartial<Session>({
        user: { id: '42', name: 'Jane Doe' },
      })
    );

    await revalidateProfilePathAfterDelete();
    const deferredWork = mockAfter.mock.calls[0][0];
    if (typeof deferredWork === 'function') {
      await deferredWork();
    }

    const revalidatePaths = mockConfirmDeletionSynced.mock.calls[0][2];
    expect(revalidatePaths).toHaveLength(2);

    revalidatePaths[0]();
    revalidatePaths[1]();

    expect(mockRevalidatePath).toHaveBeenCalledWith('/profile/42');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/mentor-pool');
  });
});
