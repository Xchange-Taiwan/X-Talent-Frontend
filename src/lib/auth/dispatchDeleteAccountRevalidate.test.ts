import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/profile/[pageUserId]/actions', () => ({
  revalidateProfilePathAfterDelete: vi.fn(),
}));

vi.mock('@/lib/monitoring', () => ({
  captureFlowFailure: vi.fn(),
}));

import { revalidateProfilePathAfterDelete } from '@/app/profile/[pageUserId]/actions';
import { captureFlowFailure } from '@/lib/monitoring';

import { dispatchDeleteAccountRevalidate } from './dispatchDeleteAccountRevalidate';

const mockRevalidateProfilePathAfterDelete = vi.mocked(
  revalidateProfilePathAfterDelete
);
const mockCaptureFlowFailure = vi.mocked(captureFlowFailure);

describe('dispatchDeleteAccountRevalidate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls revalidateProfilePathAfterDelete with no arguments (id/name are derived server-side from the session)', async () => {
    mockRevalidateProfilePathAfterDelete.mockResolvedValueOnce(undefined);

    await dispatchDeleteAccountRevalidate();

    expect(mockRevalidateProfilePathAfterDelete).toHaveBeenCalledWith();
    expect(mockCaptureFlowFailure).not.toHaveBeenCalled();
  });

  it('swallows a rejection and reports it via captureFlowFailure instead of throwing', async () => {
    mockRevalidateProfilePathAfterDelete.mockRejectedValueOnce(
      new Error('network down')
    );

    await expect(dispatchDeleteAccountRevalidate()).resolves.not.toThrow();

    expect(mockCaptureFlowFailure).toHaveBeenCalledWith({
      flow: 'delete_account',
      step: 'revalidate_dispatch',
      message: 'network down',
      level: 'warning',
    });
  });
});
