import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { revalidatePath } from 'next/cache';

import { revalidateProfilePath } from './actions';

const mockRevalidatePath = vi.mocked(revalidatePath);

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
