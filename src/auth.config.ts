import { cookies } from 'next/headers';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

import { OAUTH_REFRESH_BRIDGE_COOKIE } from '@/lib/auth/oauthRefreshBridge';
import { singleFlight } from '@/lib/singleFlight';
import { SignInSchema } from '@/schemas/auth';
import {
  refreshAccessToken,
  extractRefreshToken,
} from '@/services/auth/refreshToken';

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

export const REFRESH_SKEW_SECONDS = 300;

export interface MentorExperience {
  category: string;
  mentor_experiences_metadata?: {
    data?: unknown[];
  };
}

export interface PersonalLink {
  platform: string;
  url: string;
}

export function resolveMentorExperienceLinks(
  experiences: MentorExperience[] | undefined | null
): PersonalLink[] {
  if (!experiences) return [];
  return experiences
    .filter((exp) => exp.category === 'LINK')
    .flatMap((exp) => {
      const list = exp.mentor_experiences_metadata?.data;
      return Array.isArray(list) ? list : [];
    })
    .filter(
      (l): l is PersonalLink =>
        typeof l === 'object' &&
        l !== null &&
        'url' in l &&
        typeof (l as any).url === 'string' &&
        Boolean((l as any).url)
    );
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

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/v1/auth/login`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          }
        );

        const response = await res.json();
        if (!res.ok || !response?.data) return null;

        const personalLinks = resolveMentorExperienceLinks(
          response.data.user.experiences
        );

        return {
          id: String(response.data.auth.user_id),
          token: response.data.auth.token,
          refreshToken: extractRefreshToken(res.headers) ?? undefined,
          email: response.data.auth.email,
          onBoarding: response.data.user.onboarding,
          isMentor: response.data.user.is_mentor,
          name: response.data.user.name,
          avatar: response.data.user.avatar,
          avatarUpdatedAt: response.data.user.avatar_updated_at ?? undefined,
          jobTitle: response.data.user.job_title ?? '',
          company: response.data.user.company ?? '',
          personalLinks,
        };
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
          const user = JSON.parse(credentials.user as string);

          const cookieStore = cookies();
          const refreshToken = cookieStore.get(
            OAUTH_REFRESH_BRIDGE_COOKIE
          )?.value;
          cookieStore.delete(OAUTH_REFRESH_BRIDGE_COOKIE);

          const personalLinks = resolveMentorExperienceLinks(user.experiences);

          return {
            id: String(user.user_id),
            token: credentials.token,
            refreshToken: refreshToken || undefined,
            email: (credentials.email as string) || undefined,
            name: user.name,
            avatar: user.avatar,
            avatarUpdatedAt: user.avatar_updated_at ?? undefined,
            isMentor: user.is_mentor,
            onBoarding: user.onboarding,
            jobTitle: user.job_title ?? '',
            company: user.company ?? '',
            personalLinks,
          };
        } catch {
          return null;
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, account, trigger, session }) {
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
    },

    async session({ session, token }) {
      session.user = {
        id: (token.id as string | undefined) ?? undefined,
        name: (token.name as string | null | undefined) ?? undefined,
        avatar: (token.avatar as string | undefined) ?? undefined,
        avatarUpdatedAt:
          (token.avatarUpdatedAt as number | undefined) ?? undefined,
        onBoarding: (token.onBoarding as boolean | undefined) ?? undefined,
        isMentor: (token.isMentor as boolean | undefined) ?? undefined,
        jobTitle: (token.jobTitle as string | undefined) ?? undefined,
        company: (token.company as string | undefined) ?? undefined,
        personalLinks: token.personalLinks ?? [],
        msg: (token.msg as string | undefined) ?? undefined,
      };

      session.accessToken = (token.token as string | undefined) ?? undefined;
      session.user.provider =
        (token.provider as string | undefined) ?? undefined;
      session.user.email = (token.email as string | undefined) ?? undefined;
      session.error = token.error;
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
} satisfies NextAuthOptions;

export default authOptions;
