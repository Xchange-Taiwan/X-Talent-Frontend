import type { NextAuthConfig } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';

import { SignInSchema } from '@/schemas/auth';

export default {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    CredentialsProvider({
      async authorize(credentials) {
        const validatedFields = SignInSchema.safeParse(credentials);
        if (validatedFields.success) {
          const { email, password } = validatedFields.data;

          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/v1/auth/login`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password }),
            },
          );

          const response = await res.json();

          if (res.ok && response.data) {
            return {
              id: response.data.auth.user_id,
              token: response.data.auth.token,
              onBoarding: response.data.user.onboarding,
              isMentor: response.data.user.is_mentor,
              name: response.data.user.name,
              avatar: response.data.user.avatar,
            };
          }
          return { id: response.code, msg: response.msg };
        }
        return null;
      },
    }),
    CredentialsProvider({
      id: 'custom-google-token',
      credentials: {
        token: { label: 'Token', type: 'text' },
        user: { label: 'User JSON', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.token || !credentials?.user) return null;
        const user = JSON.parse(credentials.user as string);

        if (user) {
          return {
            id: user.user_id,
            token: credentials.token as string,
            name: user.name,
            avatar: user.avatar,
            isMentor: user.is_mentor,
            onBoarding: user.onboarding,
          };
        } else {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      return user ? { ...token, ...user } : token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.id as string,
        onBoarding: token.onBoarding as boolean | undefined,
        name: token.name as string | undefined,
        avatar: token.avatar as string | undefined,
        isMentor: token.isMentor as boolean | undefined,
        msg: token.msg as string | undefined,
      };
      session.accessToken = token.token as string | undefined;

      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
} satisfies NextAuthConfig;
