import NextAuth, { AuthOptions } from 'next-auth';
import GithubProvider from 'next-auth/providers/github';
import LinkedInProvider from 'next-auth/providers/linkedin';

export const authOptions: AuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
    LinkedInProvider({
      clientId: process.env.LINKEDIN_CLIENT_ID,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    }),
  ],
};

export default NextAuth(authOptions);
