import { getSession } from 'next-auth/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  apiClient,
  ApiError,
  FetchApiError,
  FetchHttpError,
  fetchServerJson,
} from '@/lib/apiClient';
import { captureApiFailure } from '@/lib/monitoring';

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

    it('isLocal: true → path is used as-is, without prefixing BASE_URL', async () => {
      await apiClient.get('/api/announcement', {
        auth: false,
        isLocal: true,
      });

      expect(mockFetch.mock.calls[0][0]).toBe('/api/announcement');
    });

    it('absolute http(s) URL → path is used as-is, even without isLocal', async () => {
      await apiClient.get(
        'https://edge-config.vercel.com/ecfg_test?token=test',
        { auth: false }
      );

      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://edge-config.vercel.com/ecfg_test?token=test'
      );
    });

    it('absolute http(s) URL → never attaches the session Authorization header, even with auth: true (default)', async () => {
      vi.mocked(getSession).mockResolvedValueOnce({
        accessToken: 'super-secret-token',
        expires: '2099-01-01T00:00:00Z',
      } as Awaited<ReturnType<typeof getSession>>);

      await apiClient.get('https://external.example.com/data');

      expect(getSession).not.toHaveBeenCalled();
      const [, requestInit] = mockFetch.mock.calls[0];
      expect(requestInit.headers.Authorization).toBeUndefined();
    });

    it('protocol-relative URL (//host/path) → also treated as external, no Authorization header attached', async () => {
      vi.mocked(getSession).mockResolvedValueOnce({
        accessToken: 'super-secret-token',
        expires: '2099-01-01T00:00:00Z',
      } as Awaited<ReturnType<typeof getSession>>);

      await apiClient.get('//external.example.com/data');

      expect(getSession).not.toHaveBeenCalled();
      const [, requestInit] = mockFetch.mock.calls[0];
      expect(requestInit.headers.Authorization).toBeUndefined();
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

    it('503 response with X-Maintenance-Mode header on client-side → redirects to /maintenance and does not throw', async () => {
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        writable: true,
        configurable: true,
        value: {
          ...originalLocation,
          href: '',
        },
      });

      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ message: 'Service Unavailable' }), {
          status: 503,
          headers: new Headers({ 'X-Maintenance-Mode': '1' }),
        })
      );

      let hasResolvedOrRejected = false;
      void apiClient
        .get('/v1/test', { auth: false })
        .then(() => {
          hasResolvedOrRejected = true;
        })
        .catch(() => {
          hasResolvedOrRejected = true;
        });

      // Allow microtasks to run
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(window.location.href).toBe('/maintenance');
      expect(hasResolvedOrRejected).toBe(false);

      Object.defineProperty(window, 'location', {
        writable: true,
        configurable: true,
        value: originalLocation,
      });
    });

    it('503 response without X-Maintenance-Mode header on client-side → does not redirect and throws ApiError normally', async () => {
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        writable: true,
        configurable: true,
        value: {
          ...originalLocation,
          href: '',
        },
      });

      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ message: 'Service Unavailable' }), {
          status: 503,
        })
      );

      try {
        await apiClient.get('/v1/test', { auth: false });
        expect.fail('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(503);
        expect(window.location.href).toBe('');
      } finally {
        Object.defineProperty(window, 'location', {
          writable: true,
          configurable: true,
          value: originalLocation,
        });
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

  /* ================================
   * AbortSignal handling
   * ================================ */

  describe('AbortSignal handling', () => {
    beforeEach(() => {
      vi.mocked(captureApiFailure).mockClear();
    });

    it('signal is forwarded to fetch options', async () => {
      mockFetch.mockResolvedValue(new Response('"ok"', { status: 200 }));
      const controller = new AbortController();

      await apiClient.get('/v1/test', {
        auth: false,
        signal: controller.signal,
      });

      expect(mockFetch.mock.calls[0][1]).toMatchObject({
        signal: controller.signal,
      });
    });

    it('AbortError → re-thrown without calling captureApiFailure', async () => {
      const abortError = new DOMException('aborted', 'AbortError');
      mockFetch.mockRejectedValue(abortError);
      const controller = new AbortController();
      controller.abort();

      await expect(
        apiClient.get('/v1/test', { auth: false, signal: controller.signal })
      ).rejects.toBe(abortError);

      expect(captureApiFailure).not.toHaveBeenCalled();
    });

    it('non-abort network failure → still calls captureApiFailure', async () => {
      const realFailure = new TypeError('Failed to fetch');
      mockFetch.mockRejectedValue(realFailure);

      await expect(apiClient.get('/v1/test', { auth: false })).rejects.toBe(
        realFailure
      );

      expect(captureApiFailure).toHaveBeenCalled();
    });
  });

  /* ================================
   * getUnwrapped
   * ================================ */

  describe('getUnwrapped', () => {
    it('unwraps data successfully when code is "0"', async () => {
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            code: '0',
            msg: 'success',
            data: { key: 'value' },
          }),
          { status: 200 }
        )
      );

      const result = await apiClient.getUnwrapped<{ key: string }>('/v1/test', {
        auth: false,
      });

      expect(result).toEqual({ key: 'value' });
    });

    it('throws FetchApiError when code is not "0"', async () => {
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 'ERR_123',
            msg: 'error msg',
            data: null,
          }),
          { status: 200 }
        )
      );

      await expect(
        apiClient.getUnwrapped('/v1/test', { auth: false })
      ).rejects.toThrow(FetchApiError);
    });
  });

  /* ================================
   * fetchServerJson
   * ================================ */

  describe('fetchServerJson', () => {
    it('unwraps data successfully when status is ok and code is "0"', async () => {
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            code: '0',
            msg: 'success',
            data: { items: [1, 2] },
          }),
          { status: 200 }
        )
      );

      const result = await fetchServerJson<{ items: number[] }>('/v1/test');

      expect(result).toEqual({ items: [1, 2] });
    });

    it('throws FetchHttpError when status is not ok', async () => {
      mockFetch.mockResolvedValue(new Response('', { status: 500 }));

      await expect(fetchServerJson('/v1/test')).rejects.toThrow(FetchHttpError);
    });

    it('throws FetchApiError when status is ok but code is not "0"', async () => {
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            code: '999',
            msg: 'invalid request',
            data: null,
          }),
          { status: 200 }
        )
      );

      await expect(fetchServerJson('/v1/test')).rejects.toThrow(FetchApiError);
    });

    it('forwards custom caching and ISR options (cache, next) to raw fetch', async () => {
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            code: '0',
            msg: 'success',
            data: 'test',
          }),
          { status: 200 }
        )
      );

      await fetchServerJson('/v1/test', {
        cache: 'no-store',
        next: { revalidate: 60 },
      });

      expect(mockFetch.mock.calls[0][1]).toMatchObject({
        cache: 'no-store',
        next: { revalidate: 60 },
      });
    });
  });

  /* ================================
   * Server-side Environment (window is undefined)
   * ================================ */

  describe('Server-side Environment (window is undefined)', () => {
    beforeEach(() => {
      vi.stubGlobal('window', undefined);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('throws an error if an authenticated request is made on the server', async () => {
      await expect(apiClient.get('/v1/test', { auth: true })).rejects.toThrow(
        'Server-side authenticated requests are not supported'
      );
    });

    it('allows fetchServerJson (auth: false) to succeed on the server side', async () => {
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            code: '0',
            msg: 'success',
            data: 'ssr-data',
          }),
          { status: 200 }
        )
      );

      const result = await fetchServerJson<string>('/v1/test');
      expect(result).toBe('ssr-data');
    });
  });

  /* ================================
   * 401 Refresh Deduplication
   * ================================ */

  describe('401 Refresh Deduplication', () => {
    beforeEach(() => {
      vi.mocked(getSession).mockClear();
    });

    it('coalesces concurrent 401 response refresh attempts and triggers getSession exactly once', async () => {
      // Setup mock getSession to delay so we can trigger multiple calls concurrently
      let resolveSession: (val: any) => void = () => {};
      const sessionPromise = new Promise((resolve) => {
        resolveSession = resolve;
      });
      vi.mocked(getSession).mockImplementation(() => sessionPromise as any);

      // Setup mock fetch to return 401 status and clear initial auth header getSession calls
      mockFetch.mockImplementation(async () => {
        vi.mocked(getSession).mockClear();
        return new Response('Unauthorized', { status: 401 });
      });

      // Fire off two concurrent requests with auth: true
      const p1 = apiClient.get('/v1/req1');
      const p2 = apiClient.get('/v1/req2');

      // Dynamically wait for the coalesced refresh call to trigger getSession exactly once (prevents flaky timing)
      await vi.waitFor(() => {
        expect(getSession).toHaveBeenCalledTimes(1);
      });

      // Now resolve the getSession refresh with a fresh valid session so it retries
      const freshSession = {
        accessToken: 'fresh-token',
        expires: '2099-01-01T00:00:00Z',
      };

      // Setup mock fetch for the retries to return 200 OK
      mockFetch.mockImplementation(
        async () => new Response('"success"', { status: 200 })
      );
      resolveSession(freshSession);

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toBe('success');
      expect(r2).toBe('success');

      // Ensure fetch was called for req1 first try, req2 first try, then retries with Authorization header
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  /* ================================
   * getExternalBlob
   * ================================ */

  describe('getExternalBlob', () => {
    it('handles successful response and returns a Blob', async () => {
      const mockBlob = new Blob(['blob-bytes'], { type: 'image/png' });
      mockFetch.mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      });

      const result = await apiClient.getExternalBlob(
        'https://example.com/image.png'
      );
      expect(result).toBe(mockBlob);
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/image.png', {
        method: 'GET',
      });
    });

    it('throws an error if the response is not ok', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(
        apiClient.getExternalBlob('https://example.com/image.png')
      ).rejects.toThrow('fetch external blob failed: 500');
    });
  });
});
