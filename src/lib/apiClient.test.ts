import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient,ApiError } from '@/lib/apiClient';

vi.mock('next-auth/react', () => ({
  getSession: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/monitoring', () => ({
  captureApiFailure: vi.fn(),
}));

describe('apiClient', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  /* ================================
   * URL / query string building
   * ================================ */

  describe('URL / query string building', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue(new Response('"ok"', { status: 200 }));
    });

    it('params with undefined or null values → those keys are omitted from query string', async () => {
      await apiClient.get('/v1/test', {
        auth: false,
        params: { keep: 'yes', skip1: undefined, skip2: null },
      });

      expect(mockFetch.mock.calls[0][0]).toBe('/v1/test?keep=yes');
    });

    it('params with valid values → query string is correctly appended', async () => {
      await apiClient.get('/v1/test', {
        auth: false,
        params: { limit: 10, active: true, q: 'hello' },
      });

      expect(mockFetch.mock.calls[0][0]).toBe(
        '/v1/test?limit=10&active=true&q=hello'
      );
    });

    it('no params provided → URL has no ?', async () => {
      await apiClient.get('/v1/test', { auth: false });

      expect(mockFetch.mock.calls[0][0]).toBe('/v1/test');
    });
  });

  /* ================================
   * HTTP response handling
   * ================================ */

  describe('HTTP response handling', () => {
    it('non-2xx response → throws ApiError with correct status code', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ message: 'Not found' }), { status: 404 })
      );

      try {
        await apiClient.get('/v1/test', { auth: false });
        expect.fail('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(404);
      }
    });

    it('204 No Content (empty body) → resolves to undefined without throwing', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
        text: vi.fn().mockResolvedValue(''),
      });

      const result = await apiClient.get('/v1/test', { auth: false });

      expect(result).toBeUndefined();
    });

    it('network-level failure (fetch throws) → error is re-thrown', async () => {
      const networkError = new Error('Failed to fetch');
      mockFetch.mockRejectedValue(networkError);

      await expect(apiClient.get('/v1/test', { auth: false })).rejects.toThrow(
        'Failed to fetch'
      );
    });
  });
});
