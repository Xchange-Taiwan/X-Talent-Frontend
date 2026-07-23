import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(),
}));

import { SESSION_HINT_COOKIE } from '@/lib/auth/sessionHint';

import { middleware } from './middleware';

const mockGetToken = vi.mocked(getToken);

function makeRequest(pathname: string): NextRequest {
  return new NextRequest(`https://example.com${pathname}`);
}

describe('middleware session hint cookie', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets isMentor=1 for a logged-in mentor on a public route', async () => {
    mockGetToken.mockResolvedValue({ isMentor: true } as never);

    const response = await middleware(makeRequest('/'));

    expect(response.cookies.get(SESSION_HINT_COOKIE)?.value).toBe('1');
  });

  it('sets isMentor=0 for a logged-in mentee on a public route', async () => {
    mockGetToken.mockResolvedValue({ isMentor: false } as never);

    const response = await middleware(makeRequest('/'));

    expect(response.cookies.get(SESSION_HINT_COOKIE)?.value).toBe('0');
  });

  it('clears the hint cookie for a logged-out visitor on a public route', async () => {
    mockGetToken.mockResolvedValue(null);

    const response = await middleware(makeRequest('/'));

    expect(response.cookies.get(SESSION_HINT_COOKIE)?.value).toBe('');
  });

  it('clears the hint cookie when redirecting an unauthenticated user off a protected route', async () => {
    mockGetToken.mockResolvedValue(null);

    const response = await middleware(makeRequest('/reservation/mentee'));

    expect(response.status).toBe(307);
    expect(response.cookies.get(SESSION_HINT_COOKIE)?.value).toBe('');
  });

  it('clears the hint cookie when the token has a RefreshTokenError', async () => {
    mockGetToken.mockResolvedValue({ error: 'RefreshTokenError' } as never);

    const response = await middleware(makeRequest('/reservation/mentee'));

    expect(response.status).toBe(307);
    expect(response.cookies.get(SESSION_HINT_COOKIE)?.value).toBe('');
  });

  it('does not set the hint cookie for NextAuth API routes', async () => {
    mockGetToken.mockResolvedValue({ isMentor: true } as never);

    const response = await middleware(makeRequest('/api/auth/session'));

    expect(response.cookies.get(SESSION_HINT_COOKIE)).toBeUndefined();
  });
});
