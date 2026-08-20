import type { Session } from 'next-auth';
import { getSession } from 'next-auth/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  apiClient,
  ApiError,
  FetchApiError,
  FetchHttpError,
  fetchServerJson,
  setSessionGetter,
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
    setSessionGetter(getSession);
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
      // Deliberately no getSession mock queued here: the assertion below is
      // that getAuthHeader() must never even call getSession() for an
      // external URL, so there is nothing for it to consume.
      await apiClient.get('https://external.example.com/data');

      expect(getSession).not.toHaveBeenCalled();
      const [, requestInit] = mockFetch.mock.calls[0];
      expect(requestInit.headers.Authorization).toBeUndefined();
    });

    it('protocol-relative URL (//host/path) → also treated as external, no Authorization header attached', async () => {
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

    it('coalesces concurrent getAuthHeader lookups into a single getSession call', async () => {
      // sessionGetter (next-auth's imperative getSession()) issues a fresh
      // network request on every call, unlike the useSession() hook - so
      // several authenticated requests firing at once must share one
      // in-flight lookup instead of each triggering their own.
      let resolveSession: (val: Session | null) => void = () => {};
      const sessionPromise = new Promise<Session | null>((resolve) => {
        resolveSession = resolve;
      });
      vi.mocked(getSession).mockImplementation(() => sessionPromise);
      // A fresh Response per call - a shared instance's body can only be
      // read once, and both concurrent requests read it here.
      mockFetch.mockImplementation(
        async () => new Response('"success"', { status: 200 })
      );

      // Fire off two concurrent authenticated requests.
      const p1 = apiClient.get('/v1/req1');
      const p2 = apiClient.get('/v1/req2');

      // Both requests' getAuthHeader() lookups should share the same
      // in-flight getSession() call rather than each triggering their own.
      await vi.waitFor(() => {
        expect(getSession).toHaveBeenCalledTimes(1);
      });

      const session: Session = {
        accessToken: 'shared-token',
        expires: '2099-01-01T00:00:00Z',
        user: {
          id: 'test-user',
          name: 'Test User',
          email: 'test@example.com',
        },
      };
      resolveSession(session);

      await Promise.all([p1, p2]);

      // Both requests actually used the one resolved session's token.
      const [, req1Init] = mockFetch.mock.calls[0];
      const [, req2Init] = mockFetch.mock.calls[1];
      expect(req1Init.headers.Authorization).toBe('Bearer shared-token');
      expect(req2Init.headers.Authorization).toBe('Bearer shared-token');

      // getSession was never called more than once for this burst.
      expect(vi.mocked(getSession)).toHaveBeenCalledTimes(1);
    });

    it('coalesces concurrent 401 response refresh attempts and triggers getSession exactly once', async () => {
      // singleFlight's map only coalesces calls that are truly concurrent -
      // once a lookup resolves, the next call starts a fresh one. So across
      // this whole flow there are three *distinct* lookup bursts, each
      // shared by both requests: the initial getAuthHeader() call (routine
      // map), the 401 handler's refresh (separate refresh map, so it can't
      // join the routine lookup above even if one were still in flight),
      // and the retried request's own fresh getAuthHeader() call (it
      // doesn't reuse the session the 401 handler just fetched - a further
      // optimization, but out of scope here; the point under test is that
      // concurrent callers within each burst still only pay for one).
      // Keying the mock off call count - rather than swapping its
      // implementation mid-test via vi.waitFor - avoids racing against
      // exactly when the 401 handlers happen to fire.
      const staleSession: Session = {
        accessToken: 'stale-token',
        expires: '2099-01-01T00:00:00Z',
        user: { id: 'test-user', name: 'Test User', email: 'test@example.com' },
      };
      const freshSession: Session = {
        accessToken: 'fresh-token',
        expires: '2099-01-01T00:00:00Z',
        user: { id: 'test-user', name: 'Test User', email: 'test@example.com' },
      };
      let resolveRefresh: (val: Session | null) => void = () => {};
      const refreshPromise = new Promise<Session | null>((resolve) => {
        resolveRefresh = resolve;
      });
      let sessionCallCount = 0;
      vi.mocked(getSession).mockImplementation(() => {
        sessionCallCount += 1;
        return sessionCallCount === 1
          ? Promise.resolve(staleSession)
          : refreshPromise;
      });

      // A fresh Response per call - a shared instance's body can only be
      // read once, and both concurrent requests (then their retries) read
      // it here.
      mockFetch.mockImplementation(
        async () => new Response('Unauthorized', { status: 401 })
      );

      const p1 = apiClient.get('/v1/req1');
      const p2 = apiClient.get('/v1/req2');

      // Both requests' initial getAuthHeader() lookups share call #1; both
      // 401 handlers' refresh attempts share call #2 (kept pending above).
      await vi.waitFor(() => {
        expect(getSession).toHaveBeenCalledTimes(2);
      });

      mockFetch.mockImplementation(
        async () => new Response('"success"', { status: 200 })
      );
      resolveRefresh(freshSession);

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toBe('success');
      expect(r2).toBe('success');

      // req1 initial (401), req2 initial (401), req1 retry, req2 retry
      expect(mockFetch).toHaveBeenCalledTimes(4);

      // Exactly 3 distinct getSession calls for the whole flow - one per
      // burst (initial lookup, 401 refresh, retry's own lookup) - not 6
      // (one per request per burst), proving concurrent callers within
      // each burst share a single call.
      expect(vi.mocked(getSession)).toHaveBeenCalledTimes(3);
    });

    it('401 refresh and its retry do not join a routine lookup that was already in flight before the 401', async () => {
      // Regression test for two races the shared-map version, then the
      // two-map version, each had in turn: (1) if a routine getAuthHeader()
      // lookup for one request is still in flight when a *different*
      // request's 401 handler fires, the refresh must not join that pending
      // lookup - it started before the 401 was known, so it could still
      // resolve to the same stale token that just failed. (2) once the
      // refresh has produced a fresh token, the *retry*'s own routine
      // getAuthHeader() call must not join that same still-pending routine
      // lookup either, or it would retry with the stale token anyway.
      const staleSession: Session = {
        accessToken: 'stale-token',
        expires: '2099-01-01T00:00:00Z',
        user: { id: 'test-user', name: 'Test User', email: 'test@example.com' },
      };
      const freshSession: Session = {
        accessToken: 'fresh-token',
        expires: '2099-01-01T00:00:00Z',
        user: { id: 'test-user', name: 'Test User', email: 'test@example.com' },
      };

      let resolveRoutineLookup: (val: Session | null) => void = () => {};
      const routineLookupPromise = new Promise<Session | null>((resolve) => {
        resolveRoutineLookup = resolve;
      });
      let sessionCallCount = 0;
      vi.mocked(getSession).mockImplementation(() => {
        sessionCallCount += 1;
        // Call #1: reqZ's own initial auth header lookup, resolves right away.
        // Call #2: reqY's routine lookup, kept pending to simulate it still
        // being in flight when reqZ's 401 arrives - and still pending even
        // after the refresh (call #3) resolves.
        // Call #3+: the 401 refresh and the retry's own lookup - both must
        // be fresh calls, never a join of #2.
        if (sessionCallCount === 1) return Promise.resolve(staleSession);
        if (sessionCallCount === 2) return routineLookupPromise;
        return Promise.resolve(freshSession);
      });

      // Base fallback for every fetch call except reqZ's first (below):
      // reqZ's retry and reqY's own fetch both just need to succeed.
      mockFetch.mockImplementation(
        async () => new Response('"success"', { status: 200 })
      );
      let resolveZFetch: (res: Response) => void = () => {};
      mockFetch.mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveZFetch = resolve;
          })
      );

      const pZ = apiClient.get('/v1/reqZ');

      // reqZ's initial lookup (call #1) resolved and its fetch is now
      // pending, waiting on resolveZFetch.
      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      // Start reqY's routine lookup so it's genuinely in flight (call #2,
      // pending) at the moment reqZ's 401 arrives below.
      const pY = apiClient.get('/v1/reqY');
      await vi.waitFor(() => {
        expect(getSession).toHaveBeenCalledTimes(2);
      });

      // Now let reqZ's request come back as 401, triggering its refresh,
      // then its retry - both while reqY's routine lookup (call #2) is
      // still pending. Both the refresh and the retry's own getAuthHeader()
      // must issue fresh getSession calls (#3 and #4) rather than joining
      // that pending call #2 - the two invariants under test. Without the
      // separate refreshMap, the refresh would join #2 and this would stay
      // at 2; without clearing sessionLookupMap once the refresh completes,
      // the retry would join #2 and this would stay at 3.
      resolveZFetch(new Response('Unauthorized', { status: 401 }));

      await vi.waitFor(() => {
        expect(getSession).toHaveBeenCalledTimes(4);
      });

      const z = await pZ;
      expect(z).toBe('success');

      // reqZ's retry used the fresh token its own lookup got, not whatever
      // reqY's still-pending routine lookup eventually resolves to.
      const retryCall = mockFetch.mock.calls[1];
      expect(retryCall[1].headers.Authorization).toBe('Bearer fresh-token');

      // Unblock reqY's routine lookup so the test doesn't leave a dangling
      // unresolved promise.
      resolveRoutineLookup(staleSession);
      const y = await pY;
      expect(y).toBe('success');
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
