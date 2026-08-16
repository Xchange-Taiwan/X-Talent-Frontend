import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { captureFlowFailure } from '@/lib/monitoring';
import { pollUntilUserDeleted } from '@/lib/profile/pollUntilSynced';

import {
  revalidateProfilePath,
  revalidateProfilePathAfterDelete,
} from './actions';

const mockRevalidatePath = vi.mocked(revalidatePath);
const mockAfter = vi.mocked(after);
const mockCaptureFlowFailure = vi.mocked(captureFlowFailure);
const mockPollUntilUserDeleted = vi.mocked(pollUntilUserDeleted);

describe('revalidateProfilePath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no-ops for an empty userId', async () => {
    await revalidateProfilePath('');

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('revalidates both the profile page and mentor-pool', async () => {
    await revalidateProfilePath('42');

    expect(mockRevalidatePath).toHaveBeenCalledWith('/profile/42');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/mentor-pool');
  });

  // A Server Action is just a POST endpoint under the hood — reachable
  // directly with any string, not just what the UI happens to pass.
  it.each([
    ['path traversal', '../about'],
    ['non-numeric garbage', 'abc'],
    ['leading zero-width numeric-looking id', '1e5'],
    ['negative number', '-1'],
    ['decimal', '1.5'],
  ])(
    'no-ops for an id that is not a plain positive integer (%s: %s)',
    async (_label, userId) => {
      await revalidateProfilePath(userId);

      expect(mockRevalidatePath).not.toHaveBeenCalled();
    }
  );
});

describe('revalidateProfilePathAfterDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPollUntilUserDeleted.mockResolvedValue(true);
  });

  it('no-ops for an empty userId', async () => {
    await revalidateProfilePathAfterDelete('');

    expect(mockAfter).not.toHaveBeenCalled();
  });

  it('no-ops for a non-numeric userId (e.g. path traversal) without scheduling any work', async () => {
    await revalidateProfilePathAfterDelete('../about');

    expect(mockAfter).not.toHaveBeenCalled();
  });

  it('returns immediately, deferring the poll + revalidate to run after the response via after()', async () => {
    let resolvePoll: (value: boolean) => void = () => {};
    mockPollUntilUserDeleted.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolvePoll = resolve;
      })
    );

    await revalidateProfilePathAfterDelete('42', 'Jane Doe');

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

  it('works without a name (falls back to an unscoped poll)', async () => {
    await revalidateProfilePathAfterDelete('42');
    const deferredWork = mockAfter.mock.calls[0][0] as () => Promise<void>;
    await deferredWork();

    expect(mockPollUntilUserDeleted).toHaveBeenCalledWith(42, undefined);
  });

  it('revalidates even if the poll exhausts its retry budget without confirming', async () => {
    mockPollUntilUserDeleted.mockResolvedValueOnce(false);

    await revalidateProfilePathAfterDelete('42');
    const deferredWork = mockAfter.mock.calls[0][0] as () => Promise<void>;
    await deferredWork();

    expect(mockRevalidatePath).toHaveBeenCalledWith('/profile/42');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/mentor-pool');
  });

  it('deferred work failure (pollUntilUserDeleted throws) is caught and reported, not left as an unhandled rejection', async () => {
    mockPollUntilUserDeleted.mockRejectedValueOnce(new Error('poll blew up'));

    await revalidateProfilePathAfterDelete('42');
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
