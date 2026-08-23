import { cookies } from 'next/headers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setOAuthRefreshBridge } from '@/lib/auth/oauthRefreshBridge';
import { extractRefreshToken } from '@/services/auth/refreshToken';

import { googleCallback } from './googleCallback';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/lib/auth/oauthRefreshBridge', () => ({
  setOAuthRefreshBridge: vi.fn(),
}));

vi.mock('@/services/auth/refreshToken', () => ({
  extractRefreshToken: vi.fn(),
}));

describe('googleCallback', () => {
  const mockFetch = vi.fn();
  const mockCookieStore = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    vi.mocked(cookies).mockResolvedValue(
      mockCookieStore as unknown as Awaited<ReturnType<typeof cookies>>
    );
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls fetch with the correct URL, headers and body, without language param', async () => {
    const mockResponseData = {
      data: {
        auth_type: 'LOGIN',
        auth: { token: 'google-access-token', email: 'user@example.com' },
        user: { user_id: 123, experiences: [] },
      },
    };

    const mockHeaders = new Headers();
    mockHeaders.set(
      'set-cookie',
      'refresh_token=mock-refresh-token; Path=/; HttpOnly'
    );

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponseData,
      headers: mockHeaders,
    });

    vi.mocked(extractRefreshToken).mockReturnValue('mock-refresh-token');

    const result = await googleCallback('auth-code', 'state-string');

    // Verify calling fetch with correct URL and body
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0];
    expect(calledUrl).toContain('/v2/oauth/google/callback');
    expect(calledOptions?.method).toBe('POST');
    expect(calledOptions?.headers).toEqual({
      'Content-Type': 'application/json',
    });

    const requestBody = JSON.parse(calledOptions?.body);
    expect(requestBody).toEqual({ code: 'auth-code', state: 'state-string' });
    expect(requestBody).not.toHaveProperty('language');

    // Verify extracts and sets refresh bridge correctly
    expect(extractRefreshToken).toHaveBeenCalledWith(mockHeaders);
    expect(cookies).toHaveBeenCalledTimes(1);
    expect(setOAuthRefreshBridge).toHaveBeenCalledWith(
      mockCookieStore,
      'mock-refresh-token'
    );

    expect(result).toEqual(mockResponseData);
  });
});
