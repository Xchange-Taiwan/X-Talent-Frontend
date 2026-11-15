import { fromPartial } from '@total-typescript/shoehorn';
import { NextRequest } from 'next/server';
import { getToken, type JWT } from 'next-auth/jwt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(),
}));

vi.mock('@/services/auth/backendLogout.server', () => ({
  revokeBffSession: vi.fn(),
}));

import { revokeBffSession } from '@/services/auth/backendLogout.server';

import { POST } from './route';

const mockGetToken = vi.mocked(getToken);
const mockRevokeBffSession = vi.mocked(revokeBffSession);

function makeRequest(): NextRequest {
  return new NextRequest('https://example.com/api/auth/backend-logout', {
    method: 'POST',
  });
}

describe('POST /api/auth/backend-logout', () => {
  const originalSsrUrl = process.env.SSR_API_URL;
  const originalPublicUrl = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SSR_API_URL = 'https://api.example.com';
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  afterEach(() => {
    if (originalSsrUrl === undefined) {
      delete process.env.SSR_API_URL;
    } else {
      process.env.SSR_API_URL = originalSsrUrl;
    }
    if (originalPublicUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = originalPublicUrl;
    }
  });

  it('revokes the BFF session when the token carries a refresh token and numeric userId', async () => {
    mockGetToken.mockResolvedValue(
      fromPartial<JWT>({
        refreshToken: 'refresh-abc',
        id: '123',
      })
    );
    mockRevokeBffSession.mockResolvedValue(undefined);

    const response = await POST(makeRequest());

    expect(response.status).toBe(204);
    expect(mockRevokeBffSession).toHaveBeenCalledWith('refresh-abc', 123);
  });

  it('returns 204 without calling the BFF when there is no refresh token', async () => {
    mockGetToken.mockResolvedValue(fromPartial<JWT>({ id: '123' }));

    const response = await POST(makeRequest());

    expect(response.status).toBe(204);
    expect(mockRevokeBffSession).not.toHaveBeenCalled();
  });

  it('returns 204 without calling the BFF when userId is not numeric', async () => {
    mockGetToken.mockResolvedValue(
      fromPartial<JWT>({
        refreshToken: 'refresh-abc',
        id: 'not-a-number',
      })
    );

    const response = await POST(makeRequest());

    expect(response.status).toBe(204);
    expect(mockRevokeBffSession).not.toHaveBeenCalled();
  });

  it('returns 204 without calling the BFF when neither SSR_API_URL nor NEXT_PUBLIC_API_URL is configured', async () => {
    delete process.env.SSR_API_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
    mockGetToken.mockResolvedValue(
      fromPartial<JWT>({
        refreshToken: 'refresh-abc',
        id: '123',
      })
    );

    const response = await POST(makeRequest());

    expect(response.status).toBe(204);
    expect(mockRevokeBffSession).not.toHaveBeenCalled();
  });

  it('still returns 204 and completes when the BFF call throws', async () => {
    mockGetToken.mockResolvedValue(
      fromPartial<JWT>({
        refreshToken: 'refresh-abc',
        id: '123',
      })
    );
    mockRevokeBffSession.mockRejectedValue(new Error('BFF unavailable'));

    const response = await POST(makeRequest());

    expect(response.status).toBe(204);
    expect(mockRevokeBffSession).toHaveBeenCalledOnce();
  });
});
