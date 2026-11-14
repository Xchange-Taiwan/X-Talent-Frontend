import { fromPartial } from '@total-typescript/shoehorn';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { extractRefreshToken, refreshAccessToken } from './refreshToken';

describe('refreshToken', () => {
  describe('extractRefreshToken', () => {
    it('successfully extracts refresh_token from set-cookie header', () => {
      const headers = new Headers();
      headers.append('set-cookie', 'refresh_token=rt_123456; Path=/; HttpOnly');
      const token = extractRefreshToken(headers);
      expect(token).toBe('rt_123456');
    });

    it('returns null if set-cookie header does not contain refresh_token', () => {
      const headers = new Headers();
      headers.append('set-cookie', 'other_cookie=xyz; Path=/');
      const token = extractRefreshToken(headers);
      expect(token).toBeNull();
    });

    it('returns null if set-cookie header is empty/missing', () => {
      const headers = new Headers();
      const token = extractRefreshToken(headers);
      expect(token).toBeNull();
    });
  });

  describe('refreshAccessToken', () => {
    const originalSsrUrl = process.env.SSR_API_URL;
    const originalPublicUrl = process.env.NEXT_PUBLIC_API_URL;

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

    it('successfully refreshes token with injected customFetch and prefers SSR_API_URL over NEXT_PUBLIC_API_URL (#885)', async () => {
      process.env.SSR_API_URL = 'http://internal-bff:8000/api';
      process.env.NEXT_PUBLIC_API_URL = 'https://public-bff.example.com/api';

      const mockResponseData = {
        data: {
          auth: {
            token: 'new_access_token_abc',
          },
        },
      };

      const mockHeaders = new Headers();
      mockHeaders.append(
        'set-cookie',
        'refresh_token=new_refresh_token_xyz; Path=/; HttpOnly'
      );

      const customFetch = vi.fn<typeof fetch>(async () =>
        fromPartial<Response>({
          ok: true,
          status: 200,
          json: async () => mockResponseData,
          headers: mockHeaders,
        })
      );

      const result = await refreshAccessToken(
        'old_refresh_token_123',
        customFetch
      );

      expect(customFetch).toHaveBeenCalledTimes(1);
      const [calledUrl, calledOptions] = customFetch.mock.calls[0];
      expect(calledUrl).toBe('http://internal-bff:8000/api/v1/auth/token');
      expect(calledOptions?.method).toBe('POST');
      expect(calledOptions?.headers).toEqual({
        'Content-Type': 'application/x-www-form-urlencoded',
      });

      const bodyParams = new URLSearchParams(String(calledOptions?.body));
      expect(bodyParams.get('grant_type')).toBe('refresh_token');
      expect(bodyParams.get('refresh_token')).toBe('old_refresh_token_123');

      expect(result).toEqual({
        token: 'new_access_token_abc',
        refreshToken: 'new_refresh_token_xyz',
      });
    });

    it('throws an error if response status is not ok', async () => {
      const customFetch = vi.fn<typeof fetch>(async () =>
        fromPartial<Response>({
          ok: false,
          status: 400,
          json: async () => ({ msg: 'Invalid refresh token' }),
          headers: new Headers(),
        })
      );

      await expect(
        refreshAccessToken('invalid_token', customFetch)
      ).rejects.toThrow('Token refresh failed with status 400');
    });

    it('throws an error if response is missing token', async () => {
      const mockResponseData = {
        data: {
          auth: {},
        },
      };

      const customFetch = vi.fn<typeof fetch>(async () =>
        fromPartial<Response>({
          ok: true,
          status: 200,
          json: async () => mockResponseData,
          headers: new Headers(),
        })
      );

      await expect(
        refreshAccessToken('some_token', customFetch)
      ).rejects.toThrow('Token refresh response missing token');
    });
  });
});
