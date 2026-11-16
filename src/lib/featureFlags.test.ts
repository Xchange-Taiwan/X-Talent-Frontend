import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isFavoritesEnabled,
  isFeedbackEnabled,
  resolveFeatureFlag,
} from './featureFlags';

describe('resolveFeatureFlag', () => {
  it('prioritizes explicit truthy and falsy string overrides (trimmed and case-insensitive)', () => {
    expect(
      resolveFeatureFlag('true', {
        sentryEnv: 'production',
        nodeEnv: 'production',
      })
    ).toBe(true);
    expect(
      resolveFeatureFlag('  TRUE ', {
        sentryEnv: 'production',
        nodeEnv: 'production',
      })
    ).toBe(true);
    expect(
      resolveFeatureFlag('1', {
        sentryEnv: 'production',
        nodeEnv: 'production',
      })
    ).toBe(true);

    expect(
      resolveFeatureFlag('false', {
        sentryEnv: 'staging',
        nodeEnv: 'development',
      })
    ).toBe(false);
    expect(
      resolveFeatureFlag(' FALSE ', {
        vercelEnv: 'preview',
        apiUrl:
          'https://example.execute-api.ap-northeast-1.amazonaws.com/dev/api',
        nodeEnv: 'test',
      })
    ).toBe(false);
    expect(resolveFeatureFlag('0', { nodeEnv: 'development' })).toBe(false);
  });

  it('fails closed on production sentryEnv when rawValue is unset or empty', () => {
    expect(
      resolveFeatureFlag(undefined, {
        sentryEnv: 'production',
        apiUrl:
          'https://i2hggyv2eh.execute-api.ap-northeast-1.amazonaws.com/prod/api',
        nodeEnv: 'production',
      })
    ).toBe(false);
    expect(
      resolveFeatureFlag('   ', {
        sentryEnv: 'production',
        nodeEnv: 'development',
      })
    ).toBe(false);
  });

  it('defaults to true in local dev, test, staging, preview, and /dev(/api) environments when unset', () => {
    expect(resolveFeatureFlag(undefined, { nodeEnv: 'development' })).toBe(
      true
    );
    expect(resolveFeatureFlag('', { nodeEnv: 'test' })).toBe(true);
    expect(
      resolveFeatureFlag(undefined, {
        sentryEnv: 'staging',
        nodeEnv: 'production',
      })
    ).toBe(true);
    expect(
      resolveFeatureFlag(undefined, {
        vercelEnv: 'preview',
        nodeEnv: 'production',
      })
    ).toBe(true);
    expect(
      resolveFeatureFlag(undefined, {
        apiUrl:
          'https://8br2lpf3ll.execute-api.ap-northeast-1.amazonaws.com/dev/api',
        nodeEnv: 'production',
      })
    ).toBe(true);
    expect(
      resolveFeatureFlag(undefined, {
        apiUrl:
          'https://8br2lpf3ll.execute-api.ap-northeast-1.amazonaws.com/dev/',
        nodeEnv: 'production',
      })
    ).toBe(true);
  });

  it('defaults to false on production builds without staging/preview/dev-api markers', () => {
    expect(
      resolveFeatureFlag(undefined, {
        apiUrl:
          'https://i2hggyv2eh.execute-api.ap-northeast-1.amazonaws.com/prod/api',
        nodeEnv: 'production',
      })
    ).toBe(false);
    expect(
      resolveFeatureFlag(undefined, {
        apiUrl:
          'https://i2hggyv2eh.execute-api.ap-northeast-1.amazonaws.com/prod',
        nodeEnv: 'production',
      })
    ).toBe(false);
    expect(resolveFeatureFlag(undefined, { nodeEnv: 'production' })).toBe(
      false
    );
    expect(resolveFeatureFlag('', {})).toBe(false);
  });
});

describe('isFavoritesEnabled & isFeedbackEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('supports independent dynamic toggling via process.env without module-level caching', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_FAVORITES', 'false');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_FEEDBACK', 'true');
    expect(isFavoritesEnabled()).toBe(false);
    expect(isFeedbackEnabled()).toBe(true);

    vi.stubEnv('NEXT_PUBLIC_ENABLE_FAVORITES', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_FEEDBACK', 'false');
    expect(isFavoritesEnabled()).toBe(true);
    expect(isFeedbackEnabled()).toBe(false);
  });

  it('evaluates live production vs dev-api environment defaults accurately', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_FAVORITES', '');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_FEEDBACK', '');
    vi.stubEnv('NEXT_PUBLIC_SENTRY_ENV', 'production');
    vi.stubEnv(
      'NEXT_PUBLIC_API_URL',
      'https://i2hggyv2eh.execute-api.ap-northeast-1.amazonaws.com/prod/api'
    );
    expect(isFavoritesEnabled()).toBe(false);
    expect(isFeedbackEnabled()).toBe(false);

    vi.stubEnv('NEXT_PUBLIC_SENTRY_ENV', '');
    vi.stubEnv(
      'NEXT_PUBLIC_API_URL',
      'https://8br2lpf3ll.execute-api.ap-northeast-1.amazonaws.com/dev/api'
    );
    expect(isFavoritesEnabled()).toBe(true);
    expect(isFeedbackEnabled()).toBe(true);
  });
});
