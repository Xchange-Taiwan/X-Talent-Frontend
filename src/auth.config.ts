import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

import { SignInSchema } from '@/schemas/auth';

const authOptions = {
  session: { strategy: 'jwt' },

  providers: [
    /***************************************
     * Username + Password Login Provider
     ***************************************/
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

        return {
          id: response.data.auth.user_id,
          token: response.data.auth.token,
          onBoarding: response.data.user.onboarding,
          isMentor: response.data.user.is_mentor,
          name: response.data.user.name,
          avatar: response.data.user.avatar,
        };
      },
    }),

    /***************************************
     * Custom Google Token Provider
     ***************************************/
    CredentialsProvider({
      id: 'custom-google-token',
      name: 'Custom Google Token',
      credentials: {
        token: { label: 'Token', type: 'text' },
        user: { label: 'User JSON', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.token || !credentials?.user) return null;

        try {
          const user = JSON.parse(credentials.user as string);

          return {
            id: user.user_id,
            token: credentials.token,
            name: user.name,
            avatar: user.avatar,
            isMentor: user.is_mentor,
            onBoarding: user.onboarding,
          };
        } catch {
          return null;
        }
      },
    }),
  ],

  /***************************************
   * JWT + Session callbacks
   ***************************************/
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // 1) initial sign-in (user comes from authorize())
      if (user) return { ...token, ...user };

      // 2) client calls useSession().update(...)
      // IMPORTANT: this enables session update after profile edit
      if (trigger === 'update' && session?.user) {
        return {
          ...token,
          ...session.user,
        };
      }

      return token;
    },

    async session({ session, token }) {
      session.user = {
        id: token.id ?? undefined,
        name: (token.name as string | null | undefined) ?? undefined,
        avatar: (token.avatar as string | null | undefined) ?? undefined,
        onBoarding: (token.onBoarding as boolean | undefined) ?? undefined,
        isMentor: (token.isMentor as boolean | undefined) ?? undefined,
        msg: (token.msg as string | undefined) ?? undefined,
      };

      session.accessToken = (token.token as string | undefined) ?? undefined;
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
} satisfies NextAuthOptions;

export default authOptions;
