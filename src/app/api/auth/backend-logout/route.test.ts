import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockBaseUrl } = vi.hoisted(() => ({
  mockBaseUrl: { value: 'https://api.example.com' },
}));

vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(),
}));

vi.mock('@/lib/apiClient', () => ({
  get BASE_URL() {
    return mockBaseUrl.value;
  },
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
  beforeEach(() => {
    vi.clearAllMocks();
    mockBaseUrl.value = 'https://api.example.com';
  });

  it('revokes the BFF session when the token carries a refresh token and numeric userId', async () => {
    mockGetToken.mockResolvedValue({
      refreshToken: 'refresh-abc',
      id: '123',
    } as never);
    mockRevokeBffSession.mockResolvedValue(undefined);

    const response = await POST(makeRequest());

    expect(response.status).toBe(204);
    expect(mockRevokeBffSession).toHaveBeenCalledWith('refresh-abc', 123);
  });

  it('returns 204 without calling the BFF when there is no refresh token', async () => {
    mockGetToken.mockResolvedValue({ id: '123' } as never);

    const response = await POST(makeRequest());

    expect(response.status).toBe(204);
    expect(mockRevokeBffSession).not.toHaveBeenCalled();
  });

  it('returns 204 without calling the BFF when userId is not numeric', async () => {
    mockGetToken.mockResolvedValue({
      refreshToken: 'refresh-abc',
      id: 'not-a-number',
    } as never);

    const response = await POST(makeRequest());

    expect(response.status).toBe(204);
    expect(mockRevokeBffSession).not.toHaveBeenCalled();
  });

  it('returns 204 without calling the BFF when BASE_URL is not configured', async () => {
    mockBaseUrl.value = '';
    mockGetToken.mockResolvedValue({
      refreshToken: 'refresh-abc',
      id: '123',
    } as never);

    const response = await POST(makeRequest());

    expect(response.status).toBe(204);
    expect(mockRevokeBffSession).not.toHaveBeenCalled();
  });

  it('still returns 204 and completes when the BFF call throws', async () => {
    mockGetToken.mockResolvedValue({
      refreshToken: 'refresh-abc',
      id: '123',
    } as never);
    mockRevokeBffSession.mockRejectedValue(new Error('BFF unavailable'));

    const response = await POST(makeRequest());

    expect(response.status).toBe(204);
    expect(mockRevokeBffSession).toHaveBeenCalledOnce();
  });
});
