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

import { SESSION_HINT_COOKIE } from '@/lib/auth/sessionHint';

import { middleware } from './middleware';

const mockGetToken = vi.mocked(getToken);
const mockGet = vi.mocked(get);

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

  it('returns 503 Service Unavailable for API routes under maintenance', async () => {
    process.env.EDGE_CONFIG = 'connection_string';
    mockGet.mockResolvedValue(true);

    const response = await middleware(makeRequest('/api/mentors'));

    expect(response.status).toBe(503);
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

  it('safely falls back and allows traffic when Edge Config read fails', async () => {
    process.env.EDGE_CONFIG = 'connection_string';
    mockGet.mockRejectedValue(new Error('Network Error'));
    mockGetToken.mockResolvedValue(null);

    const response = await middleware(makeRequest('/'));

    expect(response.status).toBe(200);
  });
});
