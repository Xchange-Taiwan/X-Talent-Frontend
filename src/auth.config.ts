import type { NextAuthOptions, Session } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

import {
  authorizeGoogleBridgePayload,
  isBffTokenExpiringSoon,
  loginWithBffCredentials,
  REFRESH_SKEW_SECONDS,
  refreshBffTokenSingleflight,
} from '@/lib/auth/bffSession.server';

export { REFRESH_SKEW_SECONDS };

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

  if (
    backendToken &&
    storedRefreshToken &&
    isBffTokenExpiringSoon(backendToken)
  ) {
    try {
      const { token: newToken, refreshToken: newRefreshToken } =
        await refreshBffTokenSingleflight(storedRefreshToken);
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

  return token;
};

type SessionCallbackParams = Parameters<
  NonNullable<NonNullable<NextAuthOptions['callbacks']>['session']>
>[0];

export const sessionCallback = async ({
  session,
  token,
}: SessionCallbackParams): Promise<Session> => {
  session.user = {
    id: token.id ?? undefined,
    name: token.name ?? undefined,
    avatar: token.avatar ?? undefined,
    avatarUpdatedAt: token.avatarUpdatedAt ?? undefined,
    onBoarding: token.onBoarding ?? undefined,
    isMentor: token.isMentor ?? undefined,
    jobTitle: token.jobTitle ?? undefined,
    company: token.company ?? undefined,
    personalLinks: token.personalLinks ?? [],
    msg: token.msg ?? undefined,
  };

  session.accessToken =
    token.error === 'RefreshTokenError'
      ? undefined
      : (token.token ?? undefined);
  session.user.provider = token.provider ?? undefined;
  session.user.email = token.email ?? undefined;
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
      authorize(credentials) {
        return loginWithBffCredentials(credentials);
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
      authorize(credentials) {
        return authorizeGoogleBridgePayload(credentials);
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
