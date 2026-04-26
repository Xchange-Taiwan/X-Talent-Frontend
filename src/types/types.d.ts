import { DefaultSession } from 'next-auth';

export interface PersonalLink {
  platform: string;
  url: string;
}

declare module 'next-auth' {
  interface User {
    id?: string;
    token?: string;
    refreshToken?: string;
    onBoarding?: boolean;
    name?: string | null;
    avatar?: string | null;
    avatarUpdatedAt?: number;
    isMentor?: boolean;
    jobTitle?: string;
    company?: string;
    personalLinks?: PersonalLink[];
    msg?: string;
    /** NextAuth provider id: 'credentials' = XC, 'custom-google-token' = Google */
    provider?: string;
  }

  interface Session {
    user: Omit<User, 'token'> & DefaultSession['user']; // TEST: temporarily expose refreshToken (restore Omit after testing)
    accessToken?: string;
    error?: 'RefreshTokenError';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    token?: string;
    refreshToken?: string;
    email?: string;
    onBoarding?: boolean;
    name?: string | null;
    avatar?: string | null;
    avatarUpdatedAt?: number;
    isMentor?: boolean;
    jobTitle?: string;
    company?: string;
    personalLinks?: PersonalLink[];
    msg?: string;
    provider?: string;
    error?: 'RefreshTokenError';
  }
}
