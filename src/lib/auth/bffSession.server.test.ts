import { fromPartial } from '@total-typescript/shoehorn';
import fs from 'fs';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';

import {
  authorizeGoogleBridgePayload,
  type BffSessionAdapters,
  exchangeGoogleOAuthCodeServer,
  exchangeGoogleOAuthCodeWithBridge,
  extractRefreshTokenCookie,
  isBffTokenExpiringSoon,
  loginWithBffCredentials,
  REFRESH_SKEW_SECONDS,
  refreshBffTokenSingleflight,
  revokeBffSession,
} from '@/lib/auth/bffSession.server';
import {
  type CookieStore,
  OAUTH_REFRESH_BRIDGE_COOKIE,
  OAUTH_REFRESH_BRIDGE_TTL_SECONDS,
} from '@/lib/auth/oauthRefreshBridge';

function createInMemoryCookieStore(initial: Record<string, string> = {}): {
  cookieStore: CookieStore;
  jar: Map<string, { value: string; options?: Record<string, unknown> }>;
  setSpy: ReturnType<typeof vi.fn>;
  deleteSpy: ReturnType<typeof vi.fn>;
} {
  const jar = new Map<
    string,
    { value: string; options?: Record<string, unknown> }
  >();
  for (const [k, v] of Object.entries(initial)) {
    jar.set(k, { value: v });
  }

  const setSpy = vi.fn(
    (name: string, value: string, options?: Record<string, unknown>) => {
      jar.set(name, { value, options });
    }
  );
  const deleteSpy = vi.fn((name: string) => {
    jar.delete(name);
  });

  const cookieStore = fromPartial<CookieStore>({
    get: (name: string) => {
      const entry = jar.get(name);
      return entry ? { name, value: entry.value } : undefined;
    },
    set: setSpy,
    delete: deleteSpy,
  });

  return { cookieStore, jar, setSpy, deleteSpy };
}

function createJwtWithExp(exp: number): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' })
  ).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
  return `${header}.${payload}.sig`;
}

describe('bffSession.server (#927)', () => {
  describe('deep module architectural boundaries', () => {
    it('contains zero client-layer or apiClient imports and exports no un-coalesced refresh function', () => {
      const sourcePath = path.resolve(__dirname, 'bffSession.server.ts');
      const source = fs.readFileSync(sourcePath, 'utf8');

      expect(source).not.toMatch(/from\s+['"]react['"]/);
      expect(source).not.toMatch(/from\s+['"]next\/navigation['"]/);
      expect(source).not.toMatch(/from\s+['"]next-auth\/react['"]/);
      expect(source).not.toMatch(/from\s+['"]@\/hooks\//);
      expect(source).not.toMatch(/from\s+['"]@\/components\//);
      expect(source).not.toMatch(/from\s+['"]@\/app\//);
      expect(source).not.toMatch(/from\s+['"]@\/lib\/apiClient['"]/);
      expect(source).not.toMatch(/export\s+.*function\s+refreshAccessToken\b/);
    });
  });

  describe('extractRefreshTokenCookie', () => {
    it('extracts refresh_token from Set-Cookie headers including multi-cookie responses', () => {
      const headers = new Headers();
      headers.append('set-cookie', 'csrf_token=abc; Path=/');
      headers.append(
        'set-cookie',
        'refresh_token=rt_live_999; Path=/; HttpOnly; SameSite=Lax'
      );

      expect(extractRefreshTokenCookie(headers)).toBe('rt_live_999');
    });

    it('returns null when Set-Cookie is absent, unrelated, or empty', () => {
      expect(extractRefreshTokenCookie(new Headers())).toBeNull();

      const unrelated = new Headers({ 'set-cookie': 'session_hint=1; Path=/' });
      expect(extractRefreshTokenCookie(unrelated)).toBeNull();

      const cleared = new Headers({
        'set-cookie': 'refresh_token=; Max-Age=0; Path=/',
      });
      expect(extractRefreshTokenCookie(cleared)).toBeNull();
    });
  });

  describe('loginWithBffCredentials', () => {
    it('rejects missing or schema-invalid credentials before calling fetchFn', async () => {
      const fetchFn = vi.fn<typeof fetch>();
      const adapters: BffSessionAdapters = {
        fetchFn,
        env: { SSR_API_URL: 'http://bff:8000/api' },
      };

      expect(await loginWithBffCredentials(undefined, adapters)).toBeNull();
      expect(
        await loginWithBffCredentials(
          { email: 'not-an-email', password: 'Password1!' },
          adapters
        )
      ).toBeNull();
      expect(
        await loginWithBffCredentials(
          { email: 'user@example.com', password: 'short' },
          adapters
        )
      ).toBeNull();
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('posts to SSR_API_URL /v1/auth/login, extracts refresh_token cookie, and normalizes user', async () => {
      const headers = new Headers({
        'set-cookie': 'refresh_token=rt_login_42; Path=/; HttpOnly',
      });
      const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
        fromPartial<Response>({
          ok: true,
          status: 200,
          headers,
          json: async () => ({
            code: '0',
            data: {
              auth: {
                user_id: 42,
                token: 'jwt_access_42',
                email: 'mentor@example.com',
              },
              user: {
                user_id: 42,
                name: 'Mentor Lin',
                avatar: 'https://cdn.example.com/a.png',
                avatar_updated_at: 1700000123,
                onboarding: true,
                is_mentor: true,
                job_title: 'Staff Engineer',
                company: 'X-Talent',
                experiences: [
                  {
                    category: 'LINK',
                    mentor_experiences_metadata: {
                      data: [
                        {
                          platform: 'GitHub',
                          url: 'https://github.com/mentor',
                        },
                        { platform: 'Evil', url: 'javascript:alert(1)' },
                      ],
                    },
                  },
                ],
              },
            },
          }),
        })
      );

      const user = await loginWithBffCredentials(
        { email: 'mentor@example.com', password: 'Password123!' },
        {
          fetchFn,
          env: {
            SSR_API_URL: 'http://internal-bff:8000/api',
            NEXT_PUBLIC_API_URL: 'https://public-bff.example.com/api',
          },
        }
      );

      expect(fetchFn).toHaveBeenCalledWith(
        'http://internal-bff:8000/api/v1/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'mentor@example.com',
            password: 'Password123!',
          }),
        }
      );
      expect(user).toEqual({
        id: '42',
        token: 'jwt_access_42',
        refreshToken: 'rt_login_42',
        email: 'mentor@example.com',
        name: 'Mentor Lin',
        avatar: 'https://cdn.example.com/a.png',
        avatarUpdatedAt: 1700000123,
        onBoarding: true,
        isMentor: true,
        jobTitle: 'Staff Engineer',
        company: 'X-Talent',
        personalLinks: [
          { platform: 'GitHub', url: 'https://github.com/mentor' },
        ],
      });
    });

    it('guards !res.ok before json(), handles HTML/SyntaxError bodies, non-zero envelopes, and network errors by returning null', async () => {
      const jsonSpy = vi.fn().mockRejectedValue(new SyntaxError('502 HTML'));
      const fetch502 = vi.fn<typeof fetch>().mockResolvedValue(
        fromPartial<Response>({
          ok: false,
          status: 502,
          json: jsonSpy,
        })
      );

      expect(
        await loginWithBffCredentials(
          { email: 'user@example.com', password: 'Password123!' },
          { fetchFn: fetch502, env: { SSR_API_URL: 'http://bff:8000/api' } }
        )
      ).toBeNull();
      expect(jsonSpy).not.toHaveBeenCalled();

      const fetchInvalidJson = vi.fn<typeof fetch>().mockResolvedValue(
        fromPartial<Response>({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => {
            throw new SyntaxError('Unexpected token < in JSON');
          },
        })
      );
      expect(
        await loginWithBffCredentials(
          { email: 'user@example.com', password: 'Password123!' },
          {
            fetchFn: fetchInvalidJson,
            env: { SSR_API_URL: 'http://bff:8000/api' },
          }
        )
      ).toBeNull();

      const fetchNonZero = vi.fn<typeof fetch>().mockResolvedValue(
        fromPartial<Response>({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            code: '401',
            msg: 'Invalid password',
            data: null,
          }),
        })
      );
      expect(
        await loginWithBffCredentials(
          { email: 'user@example.com', password: 'Password123!' },
          { fetchFn: fetchNonZero, env: { SSR_API_URL: 'http://bff:8000/api' } }
        )
      ).toBeNull();

      const fetchNetworkErr = vi
        .fn<typeof fetch>()
        .mockRejectedValue(new TypeError('fetch failed'));
      expect(
        await loginWithBffCredentials(
          { email: 'user@example.com', password: 'Password123!' },
          {
            fetchFn: fetchNetworkErr,
            env: { SSR_API_URL: 'http://bff:8000/api' },
          }
        )
      ).toBeNull();
    });
  });

  describe('exchangeGoogleOAuthCodeWithBridge', () => {
    it('writes g_oauth_rt bridge cookie ONLY when callback succeeds with valid LOGIN auth tokens', async () => {
      const { cookieStore, jar, setSpy } = createInMemoryCookieStore();
      const headers = new Headers({
        'set-cookie': 'refresh_token=google_rt_777; Path=/; HttpOnly',
      });
      const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
        fromPartial<Response>({
          ok: true,
          status: 200,
          headers,
          json: async () => ({
            code: '0',
            msg: 'ok',
            data: {
              auth_type: 'LOGIN',
              auth: {
                token: 'google_jwt_777',
                email: 'google@example.com',
                user_id: 777,
              },
              user: fromPartial({ user_id: 777, name: 'Google User' }),
            },
          }),
        })
      );

      const response = await exchangeGoogleOAuthCodeWithBridge(
        'oauth-code-1',
        'oauth-state-1',
        {
          fetchFn,
          cookieStore,
          env: { SSR_API_URL: 'http://internal-bff:8000/api' },
        }
      );

      expect(fetchFn).toHaveBeenCalledWith(
        'http://internal-bff:8000/api/v2/oauth/google/callback',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: 'oauth-code-1',
            state: 'oauth-state-1',
          }),
        }
      );
      expect(response.data?.auth_type).toBe('LOGIN');
      expect(response.data?.auth.token).toBe('google_jwt_777');
      expect(setSpy).toHaveBeenCalledWith(
        OAUTH_REFRESH_BRIDGE_COOKIE,
        'google_rt_777',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: OAUTH_REFRESH_BRIDGE_TTL_SECONDS,
        })
      );
      expect(jar.get(OAUTH_REFRESH_BRIDGE_COOKIE)?.value).toBe('google_rt_777');
    });

    it('guards !res.ok on 502/504 HTML gateway responses without calling res.json() or writing g_oauth_rt, and clears stale bridge cookie', async () => {
      const { cookieStore, jar, setSpy, deleteSpy } = createInMemoryCookieStore(
        {
          [OAUTH_REFRESH_BRIDGE_COOKIE]: 'stale_rt',
        }
      );
      const jsonSpy = vi
        .fn()
        .mockRejectedValue(
          new SyntaxError(
            'Unexpected token <, "<html>502"... is not valid JSON'
          )
        );
      const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
        fromPartial<Response>({
          ok: false,
          status: 502,
          headers: new Headers({
            'set-cookie': 'refresh_token=should_not_persist; Path=/',
          }),
          json: jsonSpy,
        })
      );

      const response = await exchangeGoogleOAuthCodeWithBridge(
        'code',
        'state',
        {
          fetchFn,
          cookieStore,
          env: { SSR_API_URL: 'http://internal-bff:8000/api' },
        }
      );

      expect(jsonSpy).not.toHaveBeenCalled();
      expect(setSpy).not.toHaveBeenCalled();
      expect(deleteSpy).toHaveBeenCalledWith(OAUTH_REFRESH_BRIDGE_COOKIE);
      expect(jar.has(OAUTH_REFRESH_BRIDGE_COOKIE)).toBe(false);
      expect(response.data).toBeNull();
      expect(response.code).not.toBe('0');
    });

    it('safely catches SyntaxError when HTTP 200 returns non-JSON HTML and never writes g_oauth_rt', async () => {
      const { cookieStore, setSpy, deleteSpy } = createInMemoryCookieStore({
        [OAUTH_REFRESH_BRIDGE_COOKIE]: 'stale_rt',
      });
      const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
        fromPartial<Response>({
          ok: true,
          status: 200,
          headers: new Headers({
            'set-cookie': 'refresh_token=bad_rt; Path=/',
          }),
          json: async () => {
            throw new SyntaxError('Unexpected token < in JSON at position 0');
          },
        })
      );

      const response = await exchangeGoogleOAuthCodeWithBridge(
        'code',
        'state',
        {
          fetchFn,
          cookieStore,
          env: { SSR_API_URL: 'http://internal-bff:8000/api' },
        }
      );

      expect(setSpy).not.toHaveBeenCalled();
      expect(deleteSpy).toHaveBeenCalledWith(OAUTH_REFRESH_BRIDGE_COOKIE);
      expect(response.data).toBeNull();
    });

    it('does NOT write g_oauth_rt on SIGNUP responses, non-zero envelopes, missing access token, or network errors', async () => {
      const headersWithRt = new Headers({
        'set-cookie': 'refresh_token=signup_rt_should_not_write; Path=/',
      });

      // 1. SIGNUP flow (no login session should bridge refresh token)
      const signupStore = createInMemoryCookieStore();
      const fetchSignup = vi.fn<typeof fetch>().mockResolvedValue(
        fromPartial<Response>({
          ok: true,
          status: 200,
          headers: headersWithRt,
          json: async () => ({
            code: '0',
            msg: 'ok',
            data: {
              auth_type: 'SIGNUP',
              auth: { email: 'newuser@example.com', token: null },
              user: null,
            },
          }),
        })
      );

      const signupRes = await exchangeGoogleOAuthCodeWithBridge(
        'code',
        'state',
        {
          fetchFn: fetchSignup,
          cookieStore: signupStore.cookieStore,
          env: { SSR_API_URL: 'http://bff:8000/api' },
        }
      );
      expect(signupRes.data?.auth_type).toBe('SIGNUP');
      expect(signupStore.setSpy).not.toHaveBeenCalled();

      // 2. LOGIN flow missing access token
      const missingTokStore = createInMemoryCookieStore();
      const fetchMissingTok = vi.fn<typeof fetch>().mockResolvedValue(
        fromPartial<Response>({
          ok: true,
          status: 200,
          headers: headersWithRt,
          json: async () => ({
            code: '0',
            msg: 'ok',
            data: {
              auth_type: 'LOGIN',
              auth: { email: 'u@example.com', token: '' },
              user: { user_id: 10 },
            },
          }),
        })
      );
      await exchangeGoogleOAuthCodeWithBridge('code', 'state', {
        fetchFn: fetchMissingTok,
        cookieStore: missingTokStore.cookieStore,
        env: { SSR_API_URL: 'http://bff:8000/api' },
      });
      expect(missingTokStore.setSpy).not.toHaveBeenCalled();

      // 3. HTTP 200 non-zero BFF envelope
      const nonZeroStore = createInMemoryCookieStore();
      const fetchNonZero = vi.fn<typeof fetch>().mockResolvedValue(
        fromPartial<Response>({
          ok: true,
          status: 200,
          headers: headersWithRt,
          json: async () => ({
            code: '400',
            msg: 'State mismatch',
            data: {
              auth_type: 'LOGIN',
              auth: { token: 'leaked_tok', email: 'u@example.com' },
            },
          }),
        })
      );
      const nonZeroRes = await exchangeGoogleOAuthCodeWithBridge(
        'code',
        'state',
        {
          fetchFn: fetchNonZero,
          cookieStore: nonZeroStore.cookieStore,
          env: { SSR_API_URL: 'http://bff:8000/api' },
        }
      );
      expect(nonZeroRes.data).toBeNull();
      expect(nonZeroStore.setSpy).not.toHaveBeenCalled();

      // 4. Network error
      const netErrStore = createInMemoryCookieStore();
      const fetchNetErr = vi
        .fn<typeof fetch>()
        .mockRejectedValue(new Error('ECONNRESET'));
      const netErrRes = await exchangeGoogleOAuthCodeWithBridge(
        'code',
        'state',
        {
          fetchFn: fetchNetErr,
          cookieStore: netErrStore.cookieStore,
          env: { SSR_API_URL: 'http://bff:8000/api' },
        }
      );
      expect(netErrRes.data).toBeNull();
      expect(netErrStore.setSpy).not.toHaveBeenCalled();
    });
  });

  describe('authorizeGoogleBridgePayload', () => {
    it('validates credentials.user structure, consumes g_oauth_rt single-use cookie once, and normalizes ProfileVO nullable fields', async () => {
      const { cookieStore, jar } = createInMemoryCookieStore({
        [OAUTH_REFRESH_BRIDGE_COOKIE]: 'bridge_rt_once',
      });

      const validPayload = {
        token: 'google_access_jwt',
        email: 'oauth@example.com',
        user: JSON.stringify({
          user_id: 888,
          name: 'OAuth User',
          avatar: null,
          onboarding: null,
          is_mentor: false,
          job_title: null,
          company: 'XChange',
          experiences: [
            {
              category: 'LINK',
              mentor_experiences_metadata: {
                data: [
                  {
                    platform: 'LinkedIn',
                    url: 'https://linkedin.com/in/oauth',
                  },
                ],
              },
            },
          ],
        }),
      };

      const first = await authorizeGoogleBridgePayload(validPayload, {
        cookieStore,
      });
      expect(first).toEqual({
        id: '888',
        token: 'google_access_jwt',
        refreshToken: 'bridge_rt_once',
        email: 'oauth@example.com',
        name: 'OAuth User',
        avatar: undefined,
        avatarUpdatedAt: undefined,
        onBoarding: undefined,
        isMentor: false,
        jobTitle: '',
        company: 'XChange',
        personalLinks: [
          { platform: 'LinkedIn', url: 'https://linkedin.com/in/oauth' },
        ],
      });
      expect(jar.has(OAUTH_REFRESH_BRIDGE_COOKIE)).toBe(false);

      // Second call gets undefined refreshToken (single-use invariant)
      const second = await authorizeGoogleBridgePayload(validPayload, {
        cookieStore,
      });
      expect(second?.refreshToken).toBeUndefined();
    });

    it('rejects malformed or structurally invalid credentials.user JSON BEFORE consuming the bridge cookie', async () => {
      const { cookieStore, jar, deleteSpy } = createInMemoryCookieStore({
        [OAUTH_REFRESH_BRIDGE_COOKIE]: 'protected_rt',
      });

      const invalidPayloads: Array<Record<string, unknown> | undefined> = [
        undefined,
        { token: '', user: '{"user_id":1}' },
        { token: 'tok', user: '' },
        { token: 'tok', user: '{not-json' },
        { token: 'tok', user: 'null' },
        { token: 'tok', user: '123' },
        { token: 'tok', user: '[]' },
        { token: 'tok', user: '{}' }, // missing user_id
        { token: 'tok', user: JSON.stringify({ user_id: '' }) },
        {
          token: 'tok',
          user: JSON.stringify({ user_id: 1, onboarding: 'yes' }),
        },
        {
          token: 'tok',
          user: JSON.stringify({ user_id: 1, experiences: 'not-array' }),
        },
        {
          token: 'tok',
          user: JSON.stringify({ user_id: 1, experiences: [42] }),
        },
      ];

      for (const payload of invalidPayloads) {
        expect(
          await authorizeGoogleBridgePayload(payload, { cookieStore })
        ).toBeNull();
      }

      // Bridge cookie was never consumed or deleted by invalid payloads
      expect(deleteSpy).not.toHaveBeenCalled();
      expect(jar.get(OAUTH_REFRESH_BRIDGE_COOKIE)?.value).toBe('protected_rt');
    });
  });

  describe('refreshBffTokenSingleflight & isBffTokenExpiringSoon', () => {
    it('evaluates token expiry skew deterministically using injected now adapter', () => {
      const fixedNowMs = 1_700_000_000_000;
      const fixedNowSec = fixedNowMs / 1000;

      const expiringJwt = createJwtWithExp(
        fixedNowSec + REFRESH_SKEW_SECONDS - 1
      );
      const healthyJwt = createJwtWithExp(
        fixedNowSec + REFRESH_SKEW_SECONDS + 10
      );

      expect(
        isBffTokenExpiringSoon(expiringJwt, { now: () => fixedNowMs })
      ).toBe(true);
      expect(
        isBffTokenExpiringSoon(healthyJwt, { now: () => fixedNowMs })
      ).toBe(false);
      expect(
        isBffTokenExpiringSoon('malformed.jwt', { now: () => fixedNowMs })
      ).toBe(false);
    });

    it('coalesces concurrent /v1/auth/token refresh rotations by refreshToken and evicts settled entries', async () => {
      let resolveFetch!: (value: Response) => void;
      const fetchFn = vi.fn<typeof fetch>(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          })
      );

      const env = {
        SSR_API_URL: 'http://internal-bff:8000/api',
        NEXT_PUBLIC_API_URL: 'https://public.example.com/api',
      };

      const p1 = refreshBffTokenSingleflight('rt_concurrent_1', {
        fetchFn,
        env,
      });
      const p2 = refreshBffTokenSingleflight('rt_concurrent_1', {
        fetchFn,
        env,
      });

      expect(fetchFn).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = fetchFn.mock.calls[0];
      expect(calledUrl).toBe('http://internal-bff:8000/api/v1/auth/token');
      expect(calledInit?.method).toBe('POST');
      expect(calledInit?.headers).toEqual({
        'Content-Type': 'application/x-www-form-urlencoded',
      });
      const params = new URLSearchParams(String(calledInit?.body));
      expect(params.get('grant_type')).toBe('refresh_token');
      expect(params.get('refresh_token')).toBe('rt_concurrent_1');

      resolveFetch(
        fromPartial<Response>({
          ok: true,
          status: 200,
          headers: new Headers({
            'set-cookie': 'refresh_token=rt_rotated_2; Path=/; HttpOnly',
          }),
          json: async () => ({
            code: '0',
            data: { auth: { token: 'jwt_rotated_2' } },
          }),
        })
      );

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toEqual({
        token: 'jwt_rotated_2',
        refreshToken: 'rt_rotated_2',
      });
      expect(r2).toEqual(r1);
    });

    it('throws clean errors on !res.ok (without calling res.json()), non-JSON bodies, missing token, and allows retry after failure', async () => {
      const jsonSpy = vi.fn().mockRejectedValue(new SyntaxError('504 HTML'));
      const fetch504 = vi.fn<typeof fetch>().mockResolvedValueOnce(
        fromPartial<Response>({
          ok: false,
          status: 504,
          json: jsonSpy,
        })
      );

      await expect(
        refreshBffTokenSingleflight('rt_retryable', {
          fetchFn: fetch504,
          env: { SSR_API_URL: 'http://bff:8000/api' },
        })
      ).rejects.toThrow('Token refresh failed with status 504');
      expect(jsonSpy).not.toHaveBeenCalled();

      // Subsequent call with same key is not stuck on rejected promise
      const fetchSuccess = vi.fn<typeof fetch>().mockResolvedValueOnce(
        fromPartial<Response>({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            data: { auth: { token: 'recovered_jwt' } },
          }),
        })
      );
      await expect(
        refreshBffTokenSingleflight('rt_retryable', {
          fetchFn: fetchSuccess,
          env: { SSR_API_URL: 'http://bff:8000/api' },
        })
      ).resolves.toEqual({ token: 'recovered_jwt', refreshToken: null });

      const fetchMissingTok = vi.fn<typeof fetch>().mockResolvedValueOnce(
        fromPartial<Response>({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ data: { auth: {} } }),
        })
      );
      await expect(
        refreshBffTokenSingleflight('rt_missing_tok', {
          fetchFn: fetchMissingTok,
          env: { SSR_API_URL: 'http://bff:8000/api' },
        })
      ).rejects.toThrow('Token refresh response missing token');
    });
  });

  describe('revokeBffSession', () => {
    it('posts to /v1/auth/logout via direct fetchFn with refresh_token cookie and numeric user_id when valid', async () => {
      const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
        fromPartial<Response>({
          ok: true,
          status: 200,
        })
      );

      await revokeBffSession('rt_logout_55', '55', {
        fetchFn,
        env: { SSR_API_URL: 'http://internal-bff:8000/api' },
      });

      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(fetchFn).toHaveBeenCalledWith(
        'http://internal-bff:8000/api/v1/auth/logout',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: 'refresh_token=rt_logout_55',
          },
          body: JSON.stringify({ user_id: 55 }),
          cache: 'no-store',
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('no-ops without calling fetchFn when baseUrl is missing, refreshToken is empty, or userId fails isValidUserId', async () => {
      const fetchFn = vi.fn<typeof fetch>();

      await revokeBffSession('rt_1', '123', { fetchFn, env: {} });
      await revokeBffSession('', '123', {
        fetchFn,
        env: { SSR_API_URL: 'http://bff:8000/api' },
      });
      await revokeBffSession(undefined, '123', {
        fetchFn,
        env: { SSR_API_URL: 'http://bff:8000/api' },
      });
      await revokeBffSession('rt_1', 'not-numeric', {
        fetchFn,
        env: { SSR_API_URL: 'http://bff:8000/api' },
      });
      await revokeBffSession('rt_1', '../admin', {
        fetchFn,
        env: { SSR_API_URL: 'http://bff:8000/api' },
      });
      await revokeBffSession('rt_1', undefined, {
        fetchFn,
        env: { SSR_API_URL: 'http://bff:8000/api' },
      });

      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('throws when upstream BFF logout responds with !res.ok', async () => {
      const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
        fromPartial<Response>({
          ok: false,
          status: 503,
        })
      );

      await expect(
        revokeBffSession('rt_1', '123', {
          fetchFn,
          env: { SSR_API_URL: 'http://bff:8000/api' },
        })
      ).rejects.toThrow('BFF logout failed with status 503');
    });
  });

  describe('exchangeGoogleOAuthCodeServer & encrypted refreshBridge (#954)', () => {
    const TEST_SECRET = 'super-secret-nextauth-key-for-954-tests';

    it('exchanges Google OAuth code on the server without writing cookies, seals refresh_token into an encrypted JWE bound to accessToken, and decrypts it in authorizeGoogleBridgePayload', async () => {
      const { cookieStore, setSpy } = createInMemoryCookieStore();
      const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: '0',
            msg: 'ok',
            data: {
              auth_type: 'LOGIN',
              auth: {
                token: 'server_access_jwt_954',
                email: 'fast@example.com',
              },
              user: {
                user_id: 954,
                name: 'Fast User',
                onboarding: true,
                is_mentor: false,
              },
            },
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
              'set-cookie':
                'refresh_token=sealed_rt_value_954; HttpOnly; Path=/; SameSite=Lax',
            },
          }
        )
      );

      const preExchanged = await exchangeGoogleOAuthCodeServer(
        'code_abc',
        'state_xyz',
        {
          fetchFn,
          env: {
            SSR_API_URL: 'http://bff:8000/api',
            NEXTAUTH_SECRET: TEST_SECRET,
          },
        }
      );

      expect(setSpy).not.toHaveBeenCalled();
      expect(preExchanged.response.data?.auth_type).toBe('LOGIN');
      expect(preExchanged.refreshBridgeToken).toEqual(expect.any(String));
      expect(preExchanged.refreshBridgeToken).not.toContain(
        'sealed_rt_value_954'
      );

      const authorized = await authorizeGoogleBridgePayload(
        {
          token: 'server_access_jwt_954',
          email: 'fast@example.com',
          user: JSON.stringify(preExchanged.response.data?.user),
          refreshBridge: preExchanged.refreshBridgeToken,
        },
        {
          cookieStore,
          env: { NEXTAUTH_SECRET: TEST_SECRET },
        }
      );

      expect(authorized?.refreshToken).toBe('sealed_rt_value_954');
      expect(authorized?.id).toBe('954');

      // Single-use JTI replay on the same worker must be rejected
      const replayed = await authorizeGoogleBridgePayload(
        {
          token: 'server_access_jwt_954',
          email: 'fast@example.com',
          user: JSON.stringify(preExchanged.response.data?.user),
          refreshBridge: preExchanged.refreshBridgeToken,
        },
        {
          cookieStore,
          env: { NEXTAUTH_SECRET: TEST_SECRET },
        }
      );
      expect(replayed?.refreshToken).toBeUndefined();

      // Mismatched access token must NOT unlock a fresh sealed refresh token
      const preExchanged2 = await exchangeGoogleOAuthCodeServer(
        'code_abc2',
        'state_xyz2',
        {
          fetchFn,
          env: {
            SSR_API_URL: 'http://bff:8000/api',
            NEXTAUTH_SECRET: TEST_SECRET,
          },
        }
      );
      const mismatched = await authorizeGoogleBridgePayload(
        {
          token: 'different_access_token',
          email: 'fast@example.com',
          user: JSON.stringify(preExchanged2.response.data?.user),
          refreshBridge: preExchanged2.refreshBridgeToken,
        },
        {
          cookieStore,
          env: { NEXTAUTH_SECRET: TEST_SECRET },
        }
      );

      expect(mismatched?.refreshToken).toBeUndefined();
    });

    it('returns null data and null refreshBridgeToken safely on BFF failure without throwing', async () => {
      const fetchFn = vi
        .fn<typeof fetch>()
        .mockRejectedValue(new Error('network down'));

      const preExchanged = await exchangeGoogleOAuthCodeServer(
        'code_err',
        'state_err',
        {
          fetchFn,
          env: {
            SSR_API_URL: 'http://bff:8000/api',
            NEXTAUTH_SECRET: TEST_SECRET,
          },
        }
      );

      expect(preExchanged.response.data).toBeNull();
      expect(preExchanged.refreshBridgeToken).toBeNull();
    });

    it('rejects expired (> TTL), tampered, or wrong-secret refreshBridgeToken values safely without throwing (#954)', async () => {
      const { cookieStore } = createInMemoryCookieStore();
      const baseNow = 1_700_000_000_000;
      const makeLoginResponse = () =>
        new Response(
          JSON.stringify({
            code: '0',
            msg: 'ok',
            data: {
              auth_type: 'LOGIN',
              auth: {
                token: 'ttl_access_jwt',
                email: 'ttl@example.com',
              },
              user: {
                user_id: 955,
                name: 'TTL User',
                onboarding: true,
                is_mentor: false,
              },
            },
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
              'set-cookie': 'refresh_token=ttl_rt_val; HttpOnly; Path=/',
            },
          }
        );

      const fetchFn = vi
        .fn<typeof fetch>()
        .mockImplementation(async () => makeLoginResponse());

      const expiredBridge = await exchangeGoogleOAuthCodeServer('c1', 's1', {
        fetchFn,
        now: () => baseNow,
        env: {
          SSR_API_URL: 'http://bff:8000/api',
          NEXTAUTH_SECRET: TEST_SECRET,
        },
      });

      const afterTtl = await authorizeGoogleBridgePayload(
        {
          token: 'ttl_access_jwt',
          email: 'ttl@example.com',
          user: JSON.stringify(expiredBridge.response.data?.user),
          refreshBridge: expiredBridge.refreshBridgeToken,
        },
        {
          cookieStore,
          now: () => baseNow + 61_000,
          env: { NEXTAUTH_SECRET: TEST_SECRET },
        }
      );
      expect(afterTtl?.refreshToken).toBeUndefined();

      const freshBridge = await exchangeGoogleOAuthCodeServer('c2', 's2', {
        fetchFn,
        now: () => baseNow,
        env: {
          SSR_API_URL: 'http://bff:8000/api',
          NEXTAUTH_SECRET: TEST_SECRET,
        },
      });
      const parts = String(freshBridge.refreshBridgeToken).split('.');
      const tampered = `${parts[0]}.${parts[1]}.AAAA${parts[2].slice(4)}`;

      const tamperedResult = await authorizeGoogleBridgePayload(
        {
          token: 'ttl_access_jwt',
          email: 'ttl@example.com',
          user: JSON.stringify(freshBridge.response.data?.user),
          refreshBridge: tampered,
        },
        {
          cookieStore,
          now: () => baseNow + 5_000,
          env: { NEXTAUTH_SECRET: TEST_SECRET },
        }
      );
      expect(tamperedResult?.refreshToken).toBeUndefined();

      const wrongSecretResult = await authorizeGoogleBridgePayload(
        {
          token: 'ttl_access_jwt',
          email: 'ttl@example.com',
          user: JSON.stringify(freshBridge.response.data?.user),
          refreshBridge: freshBridge.refreshBridgeToken,
        },
        {
          cookieStore,
          now: () => baseNow + 5_000,
          env: { NEXTAUTH_SECRET: 'completely-different-secret-key-999' },
        }
      );
      expect(wrongSecretResult?.refreshToken).toBeUndefined();
    });

    it('honors signed __e2e_google_oauth JWE cookie in non-production and ignores it in live production (#954)', async () => {
      const { encode } = await import('next-auth/jwt');
      const signedOverride = await encode({
        token: {
          oauthResponse: {
            code: '0',
            msg: 'ok',
            data: {
              auth_type: 'LOGIN',
              auth: { token: 'e2e_jwt_888', email: 'e2e@example.com' },
              user: {
                user_id: 888,
                name: 'E2E User',
                onboarding: true,
                is_mentor: false,
              },
            },
          },
          refreshToken: 'e2e_rt_888',
        },
        secret: TEST_SECRET,
      });

      const { cookieStore } = createInMemoryCookieStore({
        __e2e_google_oauth: signedOverride,
      });
      const fetchFn = vi
        .fn<typeof fetch>()
        .mockRejectedValue(new Error('should not hit upstream BFF in E2E'));

      const nonProdResult = await exchangeGoogleOAuthCodeServer(
        'mock_code',
        'mock_state',
        {
          fetchFn,
          cookieStore,
          env: {
            SSR_API_URL: 'http://bff:8000/api',
            NEXTAUTH_SECRET: TEST_SECRET,
            NEXT_PUBLIC_SENTRY_ENV: 'staging',
          },
        }
      );

      expect(fetchFn).not.toHaveBeenCalled();
      expect(nonProdResult.response.data?.auth.token).toBe('e2e_jwt_888');
      expect(nonProdResult.refreshBridgeToken).toEqual(expect.any(String));

      // In live production, __e2e_google_oauth must be strictly ignored
      const prodResult = await exchangeGoogleOAuthCodeServer(
        'mock_code',
        'mock_state',
        {
          fetchFn,
          cookieStore,
          env: {
            SSR_API_URL: 'http://bff:8000/api',
            NEXTAUTH_SECRET: TEST_SECRET,
            NODE_ENV: 'production',
            NEXT_PUBLIC_SENTRY_ENV: 'production',
            VERCEL_ENV: 'production',
          },
        }
      );
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(prodResult.response.data).toBeNull();
    });
  });
});
