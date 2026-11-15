import { cookies } from 'next/headers';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

import {
  type BffUserPayload,
  type MentorExperience,
  normalizeBffAuthUser,
  type PersonalLink,
  resolveBffBaseUrl,
  resolveMentorExperienceLinks,
} from '@/lib/auth/bffAuth';
import { consumeOAuthRefreshBridge } from '@/lib/auth/oauthRefreshBridge';
import { singleFlight } from '@/lib/singleFlight';
import { SignInSchema } from '@/schemas/auth';
import {
  extractRefreshToken,
  refreshAccessToken,
} from '@/services/auth/refreshToken';

export {
  type BffUserPayload,
  type MentorExperience,
  normalizeBffAuthUser,
  type PersonalLink,
  resolveBffBaseUrl,
  resolveMentorExperienceLinks,
};

export const REFRESH_SKEW_SECONDS = 300;

function decodeJwtExp(jwtString: string): number | null {
  try {
    const base64 = jwtString
      .split('.')[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const payload = JSON.parse(
      Buffer.from(base64, 'base64').toString('utf-8')
    ) as Record<string, unknown>;
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

// BFF rotates the refresh_token on every /v1/auth/token call (revokes the old
// rt:* index immediately). Concurrent jwt callbacks reading the same stored
// refresh token would all POST it; first wins, the rest get invalid_grant.
// Coalesce in-flight refreshes by token so parallel callers share one result.
const inflightRefresh = new Map<
  string,
  ReturnType<typeof refreshAccessToken>
>();

function refreshAccessTokenSingleflight(
  currentRefreshToken: string
): ReturnType<typeof refreshAccessToken> {
  return singleFlight(inflightRefresh, currentRefreshToken, () =>
    refreshAccessToken(currentRefreshToken)
  );
}

export const jwtCallback: NonNullable<
  NextAuthOptions['callbacks']
>['jwt'] = async ({ token, user, account, trigger, session }) => {
  if (user) {
    return {
      ...token,
      ...user,
      ...(account ? { provider: account.provider } : {}),
    };
  }

  if (trigger === 'update' && session?.user) {
    return {
      ...token,
      ...session.user,
    };
  }

  const backendToken = token.token;
  const storedRefreshToken = token.refreshToken;

  if (backendToken && storedRefreshToken) {
    const exp = decodeJwtExp(backendToken);
    const isExpiringSoon =
      exp !== null && exp - Date.now() / 1000 < REFRESH_SKEW_SECONDS;

    if (isExpiringSoon) {
      try {
        const { token: newToken, refreshToken: newRefreshToken } =
          await refreshAccessTokenSingleflight(storedRefreshToken);
        return {
          ...token,
          token: newToken,
          refreshToken: newRefreshToken ?? storedRefreshToken,
          error: undefined,
        };
      } catch {
        return { ...token, error: 'RefreshTokenError' as const };
      }
    }
  }

  return token;
};

export const sessionCallback: NonNullable<
  NextAuthOptions['callbacks']
>['session'] = async ({ session, token }) => {
  session.user = {
    id: (token.id as string | undefined) ?? undefined,
    name: (token.name as string | null | undefined) ?? undefined,
    avatar: (token.avatar as string | undefined) ?? undefined,
    avatarUpdatedAt: (token.avatarUpdatedAt as number | undefined) ?? undefined,
    onBoarding: (token.onBoarding as boolean | undefined) ?? undefined,
    isMentor: (token.isMentor as boolean | undefined) ?? undefined,
    jobTitle: (token.jobTitle as string | undefined) ?? undefined,
    company: (token.company as string | undefined) ?? undefined,
    personalLinks: token.personalLinks ?? [],
    msg: (token.msg as string | undefined) ?? undefined,
  };

  session.accessToken = (token.token as string | undefined) ?? undefined;
  session.user.provider = (token.provider as string | undefined) ?? undefined;
  session.user.email = (token.email as string | undefined) ?? undefined;
  session.error = token.error;
  return session;
};

const authOptions = {
  session: { strategy: 'jwt' },

  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials) return null;

        const validated = SignInSchema.safeParse(credentials);
        if (!validated.success) return null;

        const { email, password } = validated.data;

        const res = await fetch(`${resolveBffBaseUrl()}/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const response = (await res.json()) as {
          data?: {
            auth: {
              user_id: string | number;
              token: string;
              email?: string | null;
            };
            user: BffUserPayload;
          };
        };
        if (!res.ok || !response?.data) return null;

        return normalizeBffAuthUser({
          userId: response.data.auth.user_id,
          token: response.data.auth.token,
          refreshToken: extractRefreshToken(res.headers),
          email: response.data.auth.email,
          user: response.data.user,
        });
      },
    }),

    CredentialsProvider({
      id: 'custom-google-token',
      name: 'Custom Google Token',
      credentials: {
        token: { label: 'Token', type: 'text' },
        email: { label: 'Email', type: 'text' },
        user: { label: 'User JSON', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.token || !credentials?.user) return null;

        try {
          const user = JSON.parse(credentials.user as string) as BffUserPayload;

          const cookieStore = await cookies();
          const refreshToken = consumeOAuthRefreshBridge(cookieStore);

          return normalizeBffAuthUser({
            token: credentials.token,
            refreshToken,
            email: credentials.email as string,
            user,
          });
        } catch {
          return null;
        }
      },
    }),
  ],

  callbacks: {
    jwt: jwtCallback,
    session: sessionCallback,
  },

  secret: process.env.NEXTAUTH_SECRET,
} satisfies NextAuthOptions;

export default authOptions;
