import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CHUNK_RELOAD_STORAGE_KEY,
  isChunkLoadError,
  tryRecoverFromChunkLoadError,
} from '@/lib/chunkErrorRecovery';

describe('chunkErrorRecovery (#952)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('identifies JS and CSS chunk load errors across Webpack and Turbopack', () => {
    expect(isChunkLoadError(new Error('Loading chunk 1077 failed.'))).toBe(
      true
    );
    expect(isChunkLoadError(new Error('Loading CSS chunk 6066 failed.'))).toBe(
      true
    );
    expect(
      isChunkLoadError(
        new Error(
          'Failed to fetch dynamically imported module: https://xtalent.xchange.com.tw/_next/static/chunks/abc.js'
        )
      )
    ).toBe(true);
    const namedErr = new Error('Something failed');
    namedErr.name = 'ChunkLoadError';
    expect(isChunkLoadError(namedErr)).toBe(true);

    expect(isChunkLoadError(new Error('Normal business error'))).toBe(false);
  });

  it('reloads at most once within the cooldown window per pathname to prevent infinite reload loops', () => {
    const reloadSpy = vi.fn();
    const chunkErr = new Error('Loading CSS chunk 6066 failed.');

    expect(
      tryRecoverFromChunkLoadError(chunkErr, {
        pathname: '/mentor-pool',
        now: 100_000,
        reload: reloadSpy,
      })
    ).toBe(true);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY)).toContain(
      '/mentor-pool'
    );

    // Immediate second failure within 15s cooldown must NOT reload again
    expect(
      tryRecoverFromChunkLoadError(chunkErr, {
        pathname: '/mentor-pool',
        now: 105_000,
        reload: reloadSpy,
      })
    ).toBe(false);
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    // After cooldown expires (> 15s), a future deploy skew can reload once again
    expect(
      tryRecoverFromChunkLoadError(chunkErr, {
        pathname: '/mentor-pool',
        now: 120_000,
        reload: reloadSpy,
      })
    ).toBe(true);
    expect(reloadSpy).toHaveBeenCalledTimes(2);

    // Navigating to a different pathname within the cooldown window is allowed to recover once
    expect(
      tryRecoverFromChunkLoadError(chunkErr, {
        pathname: '/profile/101',
        now: 125_000,
        reload: reloadSpy,
      })
    ).toBe(true);
    expect(reloadSpy).toHaveBeenCalledTimes(3);
  });

  it('recovers safely when sessionStorage holds malformed JSON and aborts reload if sessionStorage throws', () => {
    const reloadSpy = vi.fn();
    const chunkErr = new Error('Loading chunk 404 failed.');

    window.sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, '{corrupt-json');
    expect(
      tryRecoverFromChunkLoadError(chunkErr, {
        pathname: '/about',
        now: 50_000,
        reload: reloadSpy,
      })
    ).toBe(true);
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    const setItemSpy = vi
      .spyOn(Object.getPrototypeOf(window.sessionStorage) as Storage, 'setItem')
      .mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });
    try {
      expect(
        tryRecoverFromChunkLoadError(chunkErr, {
          pathname: '/terms',
          now: 60_000,
          reload: reloadSpy,
        })
      ).toBe(false);
      expect(reloadSpy).toHaveBeenCalledTimes(1);
    } finally {
      setItemSpy.mockRestore();
    }
  });
});
