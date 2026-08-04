import { get } from '@vercel/edge-config';
import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(),
}));

vi.mock('@vercel/edge-config', () => ({
  get: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

import * as Sentry from '@sentry/nextjs';

import { SESSION_HINT_COOKIE } from '@/lib/auth/sessionHint';

import { middleware } from './middleware';

const mockGetToken = vi.mocked(getToken);
const mockGet = vi.mocked(get);
const mockCaptureException = vi.mocked(Sentry.captureException);

function makeRequest(pathname: string, existingHint?: string): NextRequest {
  return new NextRequest(`https://example.com${pathname}`, {
    headers: existingHint
      ? { cookie: `${SESSION_HINT_COOKIE}=${existingHint}` }
      : undefined,
  });
}

describe('middleware session hint cookie', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets isMentor=1 for a logged-in mentor with no existing hint cookie', async () => {
    mockGetToken.mockResolvedValue({ isMentor: true } as never);

    const response = await middleware(makeRequest('/'));

    expect(response.cookies.get(SESSION_HINT_COOKIE)?.value).toBe('1');
  });

  it('sets isMentor=0 for a logged-in mentee with no existing hint cookie', async () => {
    mockGetToken.mockResolvedValue({ isMentor: false } as never);

    const response = await middleware(makeRequest('/'));

    expect(response.cookies.get(SESSION_HINT_COOKIE)?.value).toBe('0');
  });

  it('does not re-emit Set-Cookie when the stored hint already matches the verified token', async () => {
    mockGetToken.mockResolvedValue({ isMentor: true } as never);

    const response = await middleware(makeRequest('/', '1'));

    expect(response.cookies.get(SESSION_HINT_COOKIE)).toBeUndefined();
  });

  it('updates the hint cookie when the stored value no longer matches the verified token', async () => {
    mockGetToken.mockResolvedValue({ isMentor: true } as never);

    const response = await middleware(makeRequest('/', '0'));

    expect(response.cookies.get(SESSION_HINT_COOKIE)?.value).toBe('1');
  });

  it('includes the userId in the hint cookie when present in the token', async () => {
    mockGetToken.mockResolvedValue({ isMentor: true, id: 'user-123' } as never);

    const response = await middleware(makeRequest('/'));

    expect(response.cookies.get(SESSION_HINT_COOKIE)?.value).toBe('1|user-123');
  });

  it('does not re-emit Set-Cookie when the stored hint is the encoded form actually written by .cookies.set()', async () => {
    mockGetToken.mockResolvedValue({ isMentor: true, id: 'user-123' } as never);
    // `.cookies.set()` encodeURIComponent's the whole value on write
    // (including our own `|` separator) - this is what the browser really
    // sends back on the next request, not the raw `1|user-123` form.
    const response = await middleware(
      makeRequest('/', encodeURIComponent('1|user-123'))
    );

    expect(response.cookies.get(SESSION_HINT_COOKIE)).toBeUndefined();
  });

  it('includes the avatar URL in the hint cookie when present in the token', async () => {
    mockGetToken.mockResolvedValue({
      isMentor: true,
      avatar: 'https://example.com/avatar.png',
    } as never);

    const response = await middleware(makeRequest('/'));

    expect(response.cookies.get(SESSION_HINT_COOKIE)?.value).toBe(
      '1||https%3A%2F%2Fexample.com%2Favatar.png'
    );
  });

  it('falls back to picture URL in the hint cookie when avatar is not present in the token', async () => {
    mockGetToken.mockResolvedValue({
      isMentor: true,
      picture: 'https://example.com/picture.png',
    } as never);

    const response = await middleware(makeRequest('/'));

    expect(response.cookies.get(SESSION_HINT_COOKIE)?.value).toBe(
      '1||https%3A%2F%2Fexample.com%2Fpicture.png'
    );
  });

  it('caps the session-hint cookie to avoid large cookies when the avatar URL is extremely long', async () => {
    const longAvatar = 'https://example.com/avatar.png?' + 'a'.repeat(1200);
    mockGetToken.mockResolvedValue({
      isMentor: true,
      avatar: longAvatar,
    } as never);

    const response = await middleware(makeRequest('/'));

    // Encoded URL would exceed 1000 characters, so it should fall back to '1'
    expect(response.cookies.get(SESSION_HINT_COOKIE)?.value).toBe('1');
  });

  it('does not emit a Set-Cookie for a guest with no existing hint cookie — keeps public routes cacheable', async () => {
    mockGetToken.mockResolvedValue(null);

    const response = await middleware(makeRequest('/'));

    expect(response.cookies.get(SESSION_HINT_COOKIE)).toBeUndefined();
  });

  it('clears a stale hint cookie for a guest who previously had one', async () => {
    mockGetToken.mockResolvedValue(null);

    const response = await middleware(makeRequest('/', '1'));

    expect(response.cookies.get(SESSION_HINT_COOKIE)?.value).toBe('');
  });

  it('does not emit a Set-Cookie when redirecting an unauthenticated user with no existing hint cookie', async () => {
    mockGetToken.mockResolvedValue(null);

    const response = await middleware(makeRequest('/reservation/mentee'));

    expect(response.status).toBe(307);
    expect(response.cookies.get(SESSION_HINT_COOKIE)).toBeUndefined();
  });

  it('clears a stale hint cookie when redirecting an unauthenticated user off a protected route', async () => {
    mockGetToken.mockResolvedValue(null);

    const response = await middleware(makeRequest('/reservation/mentee', '1'));

    expect(response.status).toBe(307);
    expect(response.cookies.get(SESSION_HINT_COOKIE)?.value).toBe('');
  });

  it('clears a stale hint cookie when the token has a RefreshTokenError', async () => {
    mockGetToken.mockResolvedValue({ error: 'RefreshTokenError' } as never);

    const response = await middleware(makeRequest('/reservation/mentee', '1'));

    expect(response.status).toBe(307);
    expect(response.cookies.get(SESSION_HINT_COOKIE)?.value).toBe('');
  });

  it('does not set the hint cookie for NextAuth API routes', async () => {
    mockGetToken.mockResolvedValue({ isMentor: true } as never);

    const response = await middleware(makeRequest('/api/auth/session'));

    expect(response.cookies.get(SESSION_HINT_COOKIE)).toBeUndefined();
  });
});

describe('middleware maintenance mode', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  it('redirects to /maintenance when Edge Config is enabled', async () => {
    process.env.EDGE_CONFIG = 'connection_string';
    mockGet.mockResolvedValue(true);

    const response = await middleware(makeRequest('/'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/maintenance');
  });

  it('redirects to /maintenance when Edge Config is a string "true"', async () => {
    process.env.EDGE_CONFIG = 'connection_string';
    mockGet.mockResolvedValue('true');

    const response = await middleware(makeRequest('/'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/maintenance');
  });

  it('does not redirect to /maintenance when Edge Config is a string "false"', async () => {
    process.env.EDGE_CONFIG = 'connection_string';
    mockGet.mockResolvedValue('false');
    mockGetToken.mockResolvedValue(null);

    const response = await middleware(makeRequest('/'));

    expect(response.status).not.toBe(307);
  });

  it('does not redirect and lets /maintenance pass through under maintenance', async () => {
    process.env.EDGE_CONFIG = 'connection_string';
    mockGet.mockResolvedValue(true);

    const response = await middleware(makeRequest('/maintenance'));

    expect(response.status).toBe(200);
  });

  it('does not redirect static assets under maintenance', async () => {
    process.env.EDGE_CONFIG = 'connection_string';
    mockGet.mockResolvedValue(true);

    const response = await middleware(
      makeRequest('/_next/static/css/main.css')
    );

    expect(response.status).toBe(200);
  });

  it('returns 503 Service Unavailable for API routes under maintenance and includes X-Maintenance-Mode header', async () => {
    process.env.EDGE_CONFIG = 'connection_string';
    mockGet.mockResolvedValue(true);

    const response = await middleware(makeRequest('/api/mentors'));

    expect(response.status).toBe(503);
    expect(response.headers.get('X-Maintenance-Mode')).toBe('1');
    const body = await response.json();
    expect(body.error).toContain('Service Unavailable');
  });

  it('redirects /maintenance to / when maintenance mode is disabled', async () => {
    process.env.EDGE_CONFIG = 'connection_string';
    mockGet.mockResolvedValue(false);

    const response = await middleware(makeRequest('/maintenance'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://example.com/');
  });

  it('redirects to /maintenance when local MAINTENANCE_MODE environment variable is set to true', async () => {
    delete process.env.EDGE_CONFIG;
    process.env.MAINTENANCE_MODE = 'true';

    const response = await middleware(makeRequest('/'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/maintenance');
  });

  it('redirects to /maintenance when local NEXT_PUBLIC_MAINTENANCE_MODE environment variable is set to true', async () => {
    delete process.env.EDGE_CONFIG;
    process.env.NEXT_PUBLIC_MAINTENANCE_MODE = 'true';

    const response = await middleware(makeRequest('/'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/maintenance');
  });

  it('does not redirect and lets Sentry tunnel pass through under maintenance', async () => {
    process.env.EDGE_CONFIG = 'connection_string';
    mockGet.mockResolvedValue(true);

    const response = await middleware(makeRequest('/monitoring'));

    expect(response.status).toBe(200);
  });

  it('safely falls back and allows traffic when Edge Config read fails without calling Sentry', async () => {
    process.env.EDGE_CONFIG = 'connection_string';
    const error = new Error('Network Error');
    mockGet.mockRejectedValue(error);
    mockGetToken.mockResolvedValue(null);

    const response = await middleware(makeRequest('/'));

    expect(response.status).toBe(200);
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('safely falls back and allows traffic when Edge Config read times out', async () => {
    process.env.EDGE_CONFIG = 'connection_string';
    // mockGet resolves after 1000ms, which exceeds our 500ms timeout
    mockGet.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(true), 1000))
    );
    mockGetToken.mockResolvedValue(null);

    const response = await middleware(makeRequest('/'));

    expect(response.status).toBe(200); // Should fall back to false (allows traffic)
  });

  it('redirects dynamic routes containing dots (like usernames) under maintenance', async () => {
    process.env.EDGE_CONFIG = 'connection_string';
    mockGet.mockResolvedValue(true);

    const response = await middleware(makeRequest('/profile/john.doe'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/maintenance');
  });

  it('allows local environment variable MAINTENANCE_MODE to override Edge Config (when Edge Config is false)', async () => {
    process.env.EDGE_CONFIG = 'connection_string';
    mockGet.mockResolvedValue(false);
    process.env.MAINTENANCE_MODE = 'true';

    const response = await middleware(makeRequest('/'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/maintenance');
  });

  it('allows local environment variable NEXT_PUBLIC_MAINTENANCE_MODE to override Edge Config (when Edge Config is false)', async () => {
    process.env.EDGE_CONFIG = 'connection_string';
    mockGet.mockResolvedValue(false);
    process.env.NEXT_PUBLIC_MAINTENANCE_MODE = 'true';

    const response = await middleware(makeRequest('/'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/maintenance');
  });

  it('does not redirect static assets in public root directory (e.g. /favicon.ico, /assets/logo.svg)', async () => {
    process.env.EDGE_CONFIG = 'connection_string';
    mockGet.mockResolvedValue(true);

    const responseFavicon = await middleware(makeRequest('/favicon.ico'));
    expect(responseFavicon.status).toBe(200);

    const responseLogo = await middleware(makeRequest('/assets/logo.svg'));
    expect(responseLogo.status).toBe(200);
  });

  it('does not bypass maintenance or authentication checks for API endpoints with static file extensions (e.g., /api/users/avatar.jpg)', async () => {
    process.env.EDGE_CONFIG = 'connection_string';
    mockGet.mockResolvedValue(true);

    const response = await middleware(makeRequest('/api/users/avatar.jpg'));

    // Should return 503 since it is an API route under maintenance, and NOT bypassed as an asset
    expect(response.status).toBe(503);
    expect(response.headers.get('X-Maintenance-Mode')).toBe('1');
    const body = await response.json();
    expect(body.error).toContain('Service Unavailable');
  });

  it('does not bypass maintenance or authentication checks for dynamic routes with static file extensions (e.g., /profile/john.js)', async () => {
    process.env.EDGE_CONFIG = 'connection_string';
    mockGet.mockResolvedValue(true);

    const response = await middleware(makeRequest('/profile/john.js'));

    // Should redirect to /maintenance since it is a dynamic route under maintenance, and NOT bypassed as an asset
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/maintenance');
  });

  it('redirects and sets bypass cookie when correct bypass query param is provided', async () => {
    process.env.MAINTENANCE_BYPASS_TOKEN = 'test-secret-bypass';
    process.env.MAINTENANCE_MODE = 'true';

    const req = new NextRequest(
      'https://example.com/some-page?bypass=test-secret-bypass'
    );
    const response = await middleware(req);

    // Should redirect to clean URL without the query param
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://example.com/some-page'
    );

    // Cookie should be set with correct value and options
    const cookie = response.cookies.get('maintenance_bypass');
    expect(cookie).toBeDefined();
    expect(cookie?.value).toBe('test-secret-bypass');

    // Verify detailed cookie properties
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('lax');
    expect(cookie?.path).toBe('/');
    expect(cookie?.maxAge).toBe(7200);
  });

  it('redirects and correctly preserves other query parameters (including multi-value/array params) when cleaning up bypass parameter', async () => {
    process.env.MAINTENANCE_BYPASS_TOKEN = 'test-secret-bypass';
    process.env.MAINTENANCE_MODE = 'true';

    const req = new NextRequest(
      'https://example.com/some-page?bypass=test-secret-bypass&foo=bar&category=A&category=B'
    );
    const response = await middleware(req);

    // Should redirect to clean URL, preserving other parameters (including duplicate/array parameters)
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://example.com/some-page?foo=bar&category=A&category=B'
    );
  });

  it('does not bypass maintenance when bypass token is empty/not configured', async () => {
    delete process.env.MAINTENANCE_BYPASS_TOKEN;
    process.env.MAINTENANCE_MODE = 'true';

    const req = new NextRequest(
      'https://example.com/some-page?bypass=something'
    );
    const response = await middleware(req);

    // Should redirect to /maintenance since token is not configured
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/maintenance');
  });

  it('does not bypass maintenance when incorrect query token is provided', async () => {
    process.env.MAINTENANCE_BYPASS_TOKEN = 'test-secret-bypass';
    process.env.MAINTENANCE_MODE = 'true';

    const req = new NextRequest(
      'https://example.com/some-page?bypass=wrong-token'
    );
    const response = await middleware(req);

    // Should redirect to /maintenance since token is incorrect
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/maintenance');
  });

  it('bypasses maintenance check and proceeds to session/auth checks when a valid bypass cookie is present', async () => {
    process.env.MAINTENANCE_BYPASS_TOKEN = 'test-secret-bypass';
    process.env.MAINTENANCE_MODE = 'true';
    mockGetToken.mockResolvedValue(null); // Not logged in

    const req = new NextRequest('https://example.com/reservation/mentee', {
      headers: {
        cookie: 'maintenance_bypass=test-secret-bypass',
      },
    });
    const response = await middleware(req);

    // Should bypass maintenance check, but still run session/auth checks
    // Since /reservation/mentee is a protected route and user is not logged in, it should redirect to signin
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/auth/signin');
  });

  it('bypasses maintenance check and allows API routes when a valid bypass cookie is present', async () => {
    process.env.MAINTENANCE_BYPASS_TOKEN = 'test-secret-bypass';
    process.env.MAINTENANCE_MODE = 'true';
    mockGetToken.mockResolvedValue({} as never); // Logged in

    const req = new NextRequest('https://example.com/api/mentors', {
      headers: {
        cookie: 'maintenance_bypass=test-secret-bypass',
      },
    });
    const response = await middleware(req);

    // Should bypass maintenance check and proceed to normal API handler (returns 200/next)
    expect(response.status).toBe(200);
  });

  it('does not bypass maintenance check when bypass cookie is incorrect', async () => {
    process.env.MAINTENANCE_BYPASS_TOKEN = 'test-secret-bypass';
    process.env.MAINTENANCE_MODE = 'true';

    const req = new NextRequest('https://example.com/some-page', {
      headers: {
        cookie: 'maintenance_bypass=wrong-cookie-value',
      },
    });
    const response = await middleware(req);

    // Should redirect to /maintenance
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/maintenance');
  });
});

describe('middleware public routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(false);
    delete process.env.EDGE_CONFIG;
    delete process.env.MAINTENANCE_MODE;
    delete process.env.NEXT_PUBLIC_MAINTENANCE_MODE;
  });

  it('allows unauthenticated access to /api/announcement without redirecting', async () => {
    mockGetToken.mockResolvedValue(null);

    const response = await middleware(makeRequest('/api/announcement'));

    // Should not redirect to sign-in page (NextResponse.next() returns a 200)
    expect(response.status).toBe(200);
  });

  it('redirects unauthenticated users to signin for protected api routes', async () => {
    mockGetToken.mockResolvedValue(null);

    const response = await middleware(
      makeRequest('/api/protected-route-example')
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/auth/signin');
  });
});
