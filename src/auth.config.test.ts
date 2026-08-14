import { fromPartial } from '@total-typescript/shoehorn';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { googleCallback } from '@/lib/actions/googleCallback';
import { refreshAccessToken } from '@/services/auth/refreshToken';

import authOptions, {
  jwtCallback,
  type MentorExperience,
  REFRESH_SKEW_SECONDS,
  resolveMentorExperienceLinks,
  sessionCallback,
} from './auth.config';

// Mock refreshAccessToken but keep the real extractRefreshToken
vi.mock('@/services/auth/refreshToken', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/services/auth/refreshToken')>();
  return {
    ...actual,
    refreshAccessToken: vi.fn(),
  };
});

const mockRefreshAccessToken = vi.mocked(refreshAccessToken);

// Cookie Mocking
interface CookieOptions {
  maxAge?: number;
  [key: string]: unknown;
}

interface MockCookie {
  name: string;
  value: string;
  maxAge?: number;
  [key: string]: unknown;
}

const cookieJar = new Map<string, MockCookie>();

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) => cookieJar.get(name),
    set: (name: string, value: string, options?: CookieOptions) => {
      cookieJar.set(name, { name, value, ...options });
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));

// Helper to create valid-looking JWT for decodeJwtExp
function createMockJwt(exp: number): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' })
  ).toString('base64');
  const payload = Buffer.from(JSON.stringify({ exp }))
    .toString('base64')
    .replace(/=/g, '');
  return `${header}.${payload}.signature`;
}

describe('auth.config', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    cookieJar.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('REFRESH_SKEW_SECONDS', () => {
    it('should be set to 300 seconds', () => {
      expect(REFRESH_SKEW_SECONDS).toBe(300);
    });
  });

  describe('resolveMentorExperienceLinks', () => {
    it('should return empty array if experiences is undefined, null, or empty', () => {
      expect(resolveMentorExperienceLinks(undefined)).toEqual([]);
      expect(resolveMentorExperienceLinks(null)).toEqual([]);
      expect(resolveMentorExperienceLinks([])).toEqual([]);
    });

    it('should filter out non-LINK experiences', () => {
      const experiences: MentorExperience[] = [
        {
          category: 'WORK',
          mentor_experiences_metadata: {
            data: [
              { platform: 'LinkedIn', url: 'https://linkedin.com/in/test' },
            ],
          },
        },
      ];
      expect(resolveMentorExperienceLinks(experiences)).toEqual([]);
    });

    it('should extract experiences with category LINK', () => {
      const experiences: MentorExperience[] = [
        {
          category: 'LINK',
          mentor_experiences_metadata: {
            data: [
              { platform: 'LinkedIn', url: 'https://linkedin.com/in/test' },
            ],
          },
        },
      ];
      expect(resolveMentorExperienceLinks(experiences)).toEqual([
        { platform: 'LinkedIn', url: 'https://linkedin.com/in/test' },
      ]);
    });

    it('should handle missing mentor_experiences_metadata or data safely', () => {
      const experiences: MentorExperience[] = [
        {
          category: 'LINK',
        },
        {
          category: 'LINK',
          mentor_experiences_metadata: {},
        },
      ];
      expect(resolveMentorExperienceLinks(experiences)).toEqual([]);
    });

    it('should filter out links with empty or falsy url using Shoehorn', () => {
      const experiences: MentorExperience[] = [
        fromPartial({
          category: 'LINK',
          mentor_experiences_metadata: {
            data: [
              { platform: 'LinkedIn', url: '' },
              { platform: 'GitHub', url: 'https://github.com/test' },
              fromPartial({ platform: 'Medium', url: undefined }),
            ],
          },
        }),
      ];
      expect(resolveMentorExperienceLinks(experiences)).toEqual([
        { platform: 'GitHub', url: 'https://github.com/test' },
      ]);
    });

    it('should filter out unsafe URLs', () => {
      const experiences: MentorExperience[] = [
        fromPartial({
          category: 'LINK',
          mentor_experiences_metadata: {
            data: [
              { platform: 'LinkedIn', url: 'https://linkedin.com/in/test' },
              { platform: 'Evil', url: 'javascript:alert(1)' },
            ],
          },
        }),
      ];
      expect(resolveMentorExperienceLinks(experiences)).toEqual([
        { platform: 'LinkedIn', url: 'https://linkedin.com/in/test' },
      ]);
    });

    it('should flatMap multiple LINK experiences', () => {
      const experiences: MentorExperience[] = [
        {
          category: 'LINK',
          mentor_experiences_metadata: {
            data: [
              { platform: 'LinkedIn', url: 'https://linkedin.com/in/test' },
            ],
          },
        },
        {
          category: 'LINK',
          mentor_experiences_metadata: {
            data: [{ platform: 'GitHub', url: 'https://github.com/test' }],
          },
        },
      ];
      expect(resolveMentorExperienceLinks(experiences)).toEqual([
        { platform: 'LinkedIn', url: 'https://linkedin.com/in/test' },
        { platform: 'GitHub', url: 'https://github.com/test' },
      ]);
    });

    it('should safely handle non-object, null, or primitive values in metadata data array', () => {
      const experiences: MentorExperience[] = [
        fromPartial({
          category: 'LINK',
          mentor_experiences_metadata: {
            data: [
              null,
              undefined,
              'not-an-object',
              123,
              { platform: 'GitHub', url: 'https://github.com/test' },
            ],
          },
        }),
      ];
      expect(resolveMentorExperienceLinks(experiences)).toEqual([
        { platform: 'GitHub', url: 'https://github.com/test' },
      ]);
    });

    it('should filter out links with missing or invalid platform property', () => {
      const experiences: MentorExperience[] = [
        fromPartial({
          category: 'LINK',
          mentor_experiences_metadata: {
            data: [
              fromPartial({ url: 'https://github.com/test' }), // missing platform
              fromPartial({ platform: 123, url: 'https://github.com/test' }), // platform not a string
              { platform: 'GitHub', url: 'https://github.com/test' }, // correct
            ],
          },
        }),
      ];
      expect(resolveMentorExperienceLinks(experiences)).toEqual([
        { platform: 'GitHub', url: 'https://github.com/test' },
      ]);
    });
  });

  describe('jwtCallback', () => {
    it('returns token with user details if user is present on initial sign in', async () => {
      const token = { name: 'existing' };
      const user = { id: 'user-1', name: 'new-user' };
      const account = {
        provider: 'google',
        providerAccountId: 'google-123',
        type: 'oauth' as const,
      };

      const result = await jwtCallback!(
        fromPartial({
          token,
          user,
          account,
          trigger: 'signIn',
        })
      );

      expect(result).toEqual({
        name: 'new-user',
        id: 'user-1',
        provider: 'google',
      });
    });

    it('returns updated token if trigger is update and session has user', async () => {
      const token = { name: 'old-name' };
      const session = { user: { name: 'new-name' } };

      const result = await jwtCallback!(
        fromPartial({
          token,
          trigger: 'update',
          session,
        })
      );

      expect(result).toEqual({
        name: 'new-name',
      });
    });

    it('triggers refresh if token is expiring within skew window', async () => {
      const expiringTime = Math.floor(Date.now() / 1000) + 100; // 100s < REFRESH_SKEW_SECONDS (300)
      const mockToken = createMockJwt(expiringTime);

      mockRefreshAccessToken.mockResolvedValue({
        token: 'new-token',
        refreshToken: 'new-refresh-token',
      });

      const token = {
        token: mockToken,
        refreshToken: 'old-refresh-token',
      };

      const result = await jwtCallback!(
        fromPartial({
          token,
        })
      );

      expect(mockRefreshAccessToken).toHaveBeenCalledWith('old-refresh-token');
      expect(result).toEqual({
        token: 'new-token',
        refreshToken: 'new-refresh-token',
        error: undefined,
      });
    });

    it('does not trigger refresh if token is outside skew window', async () => {
      const expiringTime = Math.floor(Date.now() / 1000) + 1000; // 1000s > REFRESH_SKEW_SECONDS (300)
      const mockToken = createMockJwt(expiringTime);

      const token = {
        token: mockToken,
        refreshToken: 'old-refresh-token',
      };

      const result = await jwtCallback!(
        fromPartial({
          token,
        })
      );

      expect(mockRefreshAccessToken).not.toHaveBeenCalled();
      expect(result).toEqual(token);
    });

    it('handles refresh token failure and sets RefreshTokenError', async () => {
      const expiringTime = Math.floor(Date.now() / 1000) + 100; // 100s < REFRESH_SKEW_SECONDS (300)
      const mockToken = createMockJwt(expiringTime);

      mockRefreshAccessToken.mockRejectedValue(new Error('Refresh failed'));

      const token = {
        token: mockToken,
        refreshToken: 'old-refresh-token',
      };

      const result = await jwtCallback!(
        fromPartial({
          token,
        })
      );

      expect(result).toEqual({
        token: mockToken,
        refreshToken: 'old-refresh-token',
        error: 'RefreshTokenError',
      });
    });
  });

  describe('sessionCallback', () => {
    it('sets session user attributes and accessToken from JWT token', async () => {
      const result = await sessionCallback!(
        fromPartial({
          session: {
            user: {},
            expires: '',
          },
          token: {
            id: 'user-123',
            name: 'Test User',
            avatar: 'avatar.png',
            avatarUpdatedAt: 12345,
            onBoarding: true,
            isMentor: false,
            jobTitle: 'Developer',
            company: 'Xchange',
            personalLinks: [{ platform: 'web', url: 'https://test.com' }],
            token: 'jwt-access-token',
            provider: 'credentials',
            email: 'user@example.com',
            error: 'RefreshTokenError' as const,
          },
        })
      );

      expect(result.user).toEqual({
        id: 'user-123',
        name: 'Test User',
        avatar: 'avatar.png',
        avatarUpdatedAt: 12345,
        onBoarding: true,
        isMentor: false,
        jobTitle: 'Developer',
        company: 'Xchange',
        personalLinks: [{ platform: 'web', url: 'https://test.com' }],
        msg: undefined,
        provider: 'credentials',
        email: 'user@example.com',
      });

      const resultAny = result as unknown as Record<string, unknown>;
      expect(resultAny.accessToken).toBe('jwt-access-token');
      expect(resultAny.error).toBe('RefreshTokenError');
    });
  });

  describe('Google OAuth Bridge Cookie Round-trip (Single-use Invariant)', () => {
    it('stores the refresh token via googleCallback, resolves it in custom-google-token provider, and deletes it for single-use security', async () => {
      // 1. Mock the BFF Google callback response
      const mockHeaders = new Headers();
      mockHeaders.set(
        'set-cookie',
        'refresh_token=mock-refresh-token; Path=/; HttpOnly'
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            auth_type: 'LOGIN',
            auth: { token: 'google-access-token', email: 'user@example.com' },
            user: { user_id: 123, experiences: [] },
          },
        }),
        headers: mockHeaders,
      });

      // 2. Invoke googleCallback (simulating OAuth redirect landing action)
      const callbackResult = await googleCallback('auth-code', 'state-string');
      expect(callbackResult).toBeDefined();

      // Verify that the bridge cookie was successfully set with the correct TTL (60s)
      const bridgeCookie = cookieJar.get('g_oauth_rt');
      expect(bridgeCookie).toBeDefined();
      expect(bridgeCookie!.value).toBe('mock-refresh-token');
      expect(bridgeCookie!.maxAge).toBe(60);

      // 3. Find custom-google-token provider
      const googleProvider = authOptions.providers.find(
        (p) =>
          p.options?.id === 'custom-google-token' ||
          p.id === 'custom-google-token'
      );
      expect(googleProvider).toBeDefined();

      // 4. Call authorize for the first time
      const authorizeResult1 = await googleProvider!.options.authorize(
        {
          token: 'google-access-token',
          email: 'user@example.com',
          user: JSON.stringify({ user_id: 123, experiences: [] }),
        },
        fromPartial({})
      );

      // Verify that the provider reads the refresh token from the bridge cookie
      expect(authorizeResult1).toBeDefined();
      expect(authorizeResult1?.refreshToken).toBe('mock-refresh-token');

      // Verify that the cookie was deleted immediately after reading it
      const cookieAfterAuthorize = cookieJar.get('g_oauth_rt');
      expect(cookieAfterAuthorize).toBeUndefined();

      // 5. Call authorize for a second time (concurrent/subsequent call)
      const authorizeResult2 = await googleProvider!.options.authorize(
        {
          token: 'google-access-token',
          email: 'user@example.com',
          user: JSON.stringify({ user_id: 123, experiences: [] }),
        },
        fromPartial({})
      );

      // Verify that a second read gets no refresh token, proving the single-use contract
      expect(authorizeResult2).toBeDefined();
      expect(authorizeResult2?.refreshToken).toBeUndefined();
    });
  });
});
