import { DefaultSession } from 'next-auth';

export interface PersonalLink {
  platform: string;
  url: string;
}

declare module 'next-auth' {
  interface User {
    id?: string;
    token?: string;
    onBoarding?: boolean;
    name?: string | null;
    avatar?: string | null;
    isMentor?: boolean;
    jobTitle?: string;
    company?: string;
    personalLinks?: PersonalLink[];
    msg?: string;
  }

  interface Session {
    user: Omit<User, 'token'> & DefaultSession['user'];
    accessToken?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    token?: string;
    onBoarding?: boolean;
    name?: string | null;
    avatar?: string | null;
    isMentor?: boolean;
    jobTitle?: string;
    company?: string;
    personalLinks?: PersonalLink[];
    msg?: string;
  }
}
