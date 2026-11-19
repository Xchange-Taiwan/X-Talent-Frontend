import { fromPartial } from '@total-typescript/shoehorn';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isAccountDeletionEnabled,
  isDualTrackV2Enabled,
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

describe('isAccountDeletionEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns true only when NEXT_PUBLIC_CAN_DELETE_ACCOUNT is explicitly "true" (trimmed, case-insensitive)', () => {
    expect(
      isAccountDeletionEnabled(
        fromPartial<NodeJS.ProcessEnv>({
          NEXT_PUBLIC_CAN_DELETE_ACCOUNT: 'true',
        })
      )
    ).toBe(true);
    expect(
      isAccountDeletionEnabled(
        fromPartial<NodeJS.ProcessEnv>({
          NEXT_PUBLIC_CAN_DELETE_ACCOUNT: '  TRUE ',
        })
      )
    ).toBe(true);
    expect(
      isAccountDeletionEnabled(
        fromPartial<NodeJS.ProcessEnv>({
          NEXT_PUBLIC_CAN_DELETE_ACCOUNT: '1',
        })
      )
    ).toBe(false);
    expect(
      isAccountDeletionEnabled(
        fromPartial<NodeJS.ProcessEnv>({
          NEXT_PUBLIC_CAN_DELETE_ACCOUNT: 'false',
        })
      )
    ).toBe(false);
  });

  it('fails closed (false) when unset or empty across development, test, staging, preview, /dev/api, and production', () => {
    const environments: NodeJS.ProcessEnv[] = [
      fromPartial<NodeJS.ProcessEnv>({ NODE_ENV: 'development' }),
      fromPartial<NodeJS.ProcessEnv>({
        NODE_ENV: 'test',
        NEXT_PUBLIC_CAN_DELETE_ACCOUNT: '',
      }),
      fromPartial<NodeJS.ProcessEnv>({
        NODE_ENV: 'production',
        NEXT_PUBLIC_SENTRY_ENV: 'staging',
      }),
      fromPartial<NodeJS.ProcessEnv>({
        NODE_ENV: 'production',
        NEXT_PUBLIC_VERCEL_ENV: 'preview',
      }),
      fromPartial<NodeJS.ProcessEnv>({
        NODE_ENV: 'production',
        NEXT_PUBLIC_API_URL:
          'https://8br2lpf3ll.execute-api.ap-northeast-1.amazonaws.com/dev/api',
      }),
      fromPartial<NodeJS.ProcessEnv>({
        NODE_ENV: 'production',
        NEXT_PUBLIC_SENTRY_ENV: 'production',
        NEXT_PUBLIC_CAN_DELETE_ACCOUNT: '   ',
      }),
    ];

    for (const env of environments) {
      expect(isAccountDeletionEnabled(env)).toBe(false);
    }
  });

  it('reads process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT dynamically when called with no arguments', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_CAN_DELETE_ACCOUNT', '');
    expect(isAccountDeletionEnabled()).toBe(false);

    vi.stubEnv('NEXT_PUBLIC_CAN_DELETE_ACCOUNT', 'true');
    expect(isAccountDeletionEnabled()).toBe(true);

    vi.stubEnv('NEXT_PUBLIC_CAN_DELETE_ACCOUNT', 'false');
    expect(isAccountDeletionEnabled()).toBe(false);
  });
});

describe('isDualTrackV2Enabled (#970)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults strictly to false across development, test, staging, preview, and production until explicitly enabled', () => {
    for (const env of [
      fromPartial<NodeJS.ProcessEnv>({ NODE_ENV: 'development' }),
      fromPartial<NodeJS.ProcessEnv>({ NODE_ENV: 'test' }),
      fromPartial<NodeJS.ProcessEnv>({
        NODE_ENV: 'production',
        NEXT_PUBLIC_SENTRY_ENV: 'staging',
      }),
      fromPartial<NodeJS.ProcessEnv>({
        NODE_ENV: 'production',
        NEXT_PUBLIC_ENABLE_DUAL_TRACK_V2: 'false',
      }),
    ]) {
      expect(isDualTrackV2Enabled(env)).toBe(false);
    }

    expect(
      isDualTrackV2Enabled(
        fromPartial<NodeJS.ProcessEnv>({
          NEXT_PUBLIC_ENABLE_DUAL_TRACK_V2: ' true ',
        })
      )
    ).toBe(true);

    vi.stubEnv('NEXT_PUBLIC_ENABLE_DUAL_TRACK_V2', '');
    expect(isDualTrackV2Enabled()).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_ENABLE_DUAL_TRACK_V2', 'true');
    expect(isDualTrackV2Enabled()).toBe(true);
  });
});
