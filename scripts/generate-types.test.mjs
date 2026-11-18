// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { fetchOpenApiSpecWithRetry } from './generate-types.mjs';

describe('scripts/generate-types', () => {
  it('retries transient 5xx or timeout failures and parses valid OpenAPI JSON', async () => {
    const noopSleep = vi.fn().mockResolvedValue(undefined);
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('Timed out', 'TimeoutError'))
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '{"openapi":"3.1.0","paths":{}}',
      });

    const spec = await fetchOpenApiSpecWithRetry(
      'https://api.example.com/openapi.json',
      {
        fetchImpl: fetchMock,
        sleepFn: noopSleep,
      }
    );

    expect(spec).toEqual({ openapi: '3.1.0', paths: {} });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-retryable 404 responses', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    await expect(
      fetchOpenApiSpecWithRetry('https://api.example.com/missing.json', {
        fetchImpl: fetchMock,
      })
    ).rejects.toThrow(/404/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
