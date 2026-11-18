import { describe, expect, it, vi } from 'vitest';

import {
  attachLazyReplayIntegration,
  resolveSentryRuntimeConfig,
  SENTRY_CLIENT_IGNORE_ERRORS,
} from '@/lib/sentryEnv';

describe('sentryEnv & client replay helper (#952)', () => {
  it('quarantines Vercel preview deployments from polluting production even when NEXT_PUBLIC_SENTRY_ENV is production', () => {
    expect(
      resolveSentryRuntimeConfig({
        NEXT_PUBLIC_SENTRY_ENV: 'production',
        NEXT_PUBLIC_VERCEL_ENV: 'preview',
      })
    ).toEqual({
      environment: 'preview',
      enabled: true,
    });

    expect(
      resolveSentryRuntimeConfig({
        NEXT_PUBLIC_SENTRY_ENV: 'staging',
        NEXT_PUBLIC_VERCEL_ENV: 'preview',
      })
    ).toEqual({
      environment: 'staging',
      enabled: true,
    });

    expect(
      resolveSentryRuntimeConfig({
        NEXT_PUBLIC_SENTRY_ENV: 'production',
        VERCEL_ENV: 'development',
      })
    ).toEqual({
      environment: 'local',
      enabled: false,
    });
  });

  it('enables production when NEXT_PUBLIC_VERCEL_ENV is production or unset', () => {
    expect(
      resolveSentryRuntimeConfig({
        NEXT_PUBLIC_SENTRY_ENV: 'production',
        NEXT_PUBLIC_VERCEL_ENV: 'production',
      })
    ).toEqual({
      environment: 'production',
      enabled: true,
    });

    expect(resolveSentryRuntimeConfig({})).toEqual({
      environment: 'local',
      enabled: false,
    });
  });

  it('matches known browser-extension and DOM translation noise without matching real app errors', () => {
    const matchesAny = (msg: string) =>
      SENTRY_CLIENT_IGNORE_ERRORS.some((pattern) =>
        typeof pattern === 'string' ? msg.includes(pattern) : pattern.test(msg)
      );

    expect(
      matchesAny('Invalid call to runtime.sendMessage(). Tab not found.')
    ).toBe(true);
    expect(
      matchesAny(
        "Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node."
      )
    ).toBe(true);
    expect(matchesAny('TypeError: Cannot read properties of undefined')).toBe(
      false
    );
  });

  it('swallows lazyLoadIntegration rejections cleanly so blocked CDN scripts never emit unhandled rejections', async () => {
    const lazyLoad = vi
      .fn()
      .mockRejectedValueOnce(
        new Error('Error when loading integration: replayIntegration')
      );
    const addIntegration = vi.fn();

    await expect(
      attachLazyReplayIntegration({
        lazyLoadIntegration: lazyLoad,
        addIntegration,
      })
    ).resolves.toBe(false);

    expect(addIntegration).not.toHaveBeenCalled();
  });
});
