import type { NextAuthConfig } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

import { SignInSchema } from '@/schemas/auth';

export default {
  providers: [
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
            }
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
      name: 'Custom Google Token',
      async authorize(credentials) {
        console.log('[DEBUG] Received credentials:', credentials);

        if (!credentials?.token || !credentials?.user) {
          console.warn('[DEBUG] Missing token or user');
          return null;
        }

        try {
          const user = JSON.parse(credentials.user as string);
          console.log('[DEBUG] Parsed user:', user);

          if (user) {
            const result = {
              id: user.user_id,
              token: credentials.token as string,
              name: user.name,
              avatar: user.avatar,
              isMentor: user.is_mentor,
              onBoarding: user.onboarding,
            };
            console.log('[DEBUG] Returning user object:', result);
            return result;
          } else {
            console.warn('[DEBUG] User is null after parsing');
            return null;
          }
        } catch (error) {
          console.error('[DEBUG] Error parsing user JSON:', error);
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
