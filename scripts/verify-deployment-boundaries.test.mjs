// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { verifyDeploymentBoundaries } from './verify-deployment-boundaries.mjs';

describe('scripts/verify-deployment-boundaries', () => {
  it('fails when browser source map (.map) files remain inside static output directory', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sourcemap-leak-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'chunk.js.map'), '{"version":3}');
      const result = await verifyDeploymentBoundaries({
        siteUrl: 'https://xtalent.xchange.com.tw',
        staticDirs: [tmpDir],
        routes: [],
      });
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.includes('.map'))).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('rejects 307 redirects to /maintenance that curl -L previously mistook for 200 OK', async () => {
    const fetchImpl = vi.fn(async () => ({
      status: 307,
      headers: new Headers({ location: '/maintenance' }),
    }));

    const result = await verifyDeploymentBoundaries({
      siteUrl: 'https://xtalent.xchange.com.tw',
      routes: ['/'],
      maxRetries: 1,
      retryDelayMs: 1,
      fetchImpl,
    });

    expect(result.passed).toBe(false);
    expect(result.errors[0]).toContain('307');
    expect(result.errors[0]).toContain('/maintenance');
  });

  it('detects Google OAuth redirect_uri domain mismatch and passes when domain and routes align', async () => {
    const badFetch = vi.fn(async (url) => {
      if (String(url).includes('/v2/oauth/google/authorize/login')) {
        return {
          status: 200,
          ok: true,
          json: async () => ({
            data: {
              authorization_url:
                'https://accounts.google.com/o/oauth2/v2/auth?client_id=abc&redirect_uri=' +
                encodeURIComponent(
                  'https://xtalentdev.vercel.app/auth/google/callback/redirect'
                ),
            },
          }),
        };
      }
      return { status: 200, headers: new Headers() };
    });

    const mismatch = await verifyDeploymentBoundaries({
      siteUrl: 'https://xtalent.xchange.com.tw',
      apiUrl:
        'https://i2hggyv2eh.execute-api.ap-northeast-1.amazonaws.com/prod/api',
      routes: ['/', '/auth/signin'],
      maxRetries: 1,
      retryDelayMs: 1,
      fetchImpl: badFetch,
    });
    expect(mismatch.passed).toBe(false);
    expect(mismatch.errors.some((e) => e.includes('redirect_uri'))).toBe(true);

    const goodFetch = vi.fn(async (url) => {
      if (String(url).includes('/v2/oauth/google/authorize/login')) {
        return {
          status: 200,
          ok: true,
          json: async () => ({
            data: {
              authorization_url:
                'https://accounts.google.com/o/oauth2/v2/auth?client_id=abc&redirect_uri=' +
                encodeURIComponent(
                  'https://xtalent.xchange.com.tw/auth/google/callback/redirect'
                ),
            },
          }),
        };
      }
      return { status: 200, headers: new Headers() };
    });

    const okResult = await verifyDeploymentBoundaries({
      siteUrl: 'https://xtalent.xchange.com.tw',
      apiUrl:
        'https://i2hggyv2eh.execute-api.ap-northeast-1.amazonaws.com/prod/api',
      routes: ['/', '/auth/signin'],
      maxRetries: 1,
      retryDelayMs: 1,
      fetchImpl: goodFetch,
    });
    expect(okResult.passed).toBe(true);
    expect(okResult.errors).toHaveLength(0);
  });
});
