import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

import { SignInSchema } from '@/schemas/auth';

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

        const experiences: {
          category: string;
          mentor_experiences_metadata?: { data?: unknown[] };
        }[] = response.data.user.experiences ?? [];
        const personalLinks = experiences
          .filter((exp) => exp.category === 'LINK')
          .flatMap(
            (exp) =>
              (exp.mentor_experiences_metadata?.data ?? []) as {
                platform: string;
                url: string;
              }[]
          )
          .filter((l) => Boolean(l.url));

        return {
          id: String(response.data.auth.user_id),
          token: response.data.auth.token,
          email: response.data.auth.email,
          onBoarding: response.data.user.onboarding,
          isMentor: response.data.user.is_mentor,
          name: response.data.user.name,
          avatar: response.data.user.avatar,
          // Set on every login so the browser never serves a stale cached avatar
          // from a previous session (the S3 key never changes between uploads).
          avatarUpdatedAt: Date.now(),
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

          const experiences: {
            category: string;
            mentor_experiences_metadata?: { data?: unknown[] };
          }[] = user.experiences ?? [];
          const personalLinks = experiences
            .filter((exp) => exp.category === 'LINK')
            .flatMap(
              (exp) =>
                (exp.mentor_experiences_metadata?.data ?? []) as {
                  platform: string;
                  url: string;
                }[]
            )
            .filter((l) => Boolean(l.url));

          return {
            id: String(user.user_id),
            token: credentials.token,
            email: (credentials.email as string) || undefined,
            name: user.name,
            avatar: user.avatar,
            avatarUpdatedAt: Date.now(),
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
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
} satisfies NextAuthOptions;

export default authOptions;
