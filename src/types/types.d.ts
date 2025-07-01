import { type DefaultSession } from 'next-auth';

declare module 'next-auth' {
  /**
   * Extending the User object returned by `authorize`, `getUser`, etc.
   */
  interface User {
    id?: string;
    token?: string;
    onBoarding?: boolean;
    name?: string;
    avatar?: string;
    isMentor?: boolean;
    msg?: string;
  }

  /**
   * Extending the Session object used by `useSession` and `getSession`.
   */
  interface Session {
    user: Omit<User, 'token'> & DefaultSession['user'];
    accessToken?: string;
  }
}

declare module 'next-auth/jwt' {
  /**
   * Extending the JWT object used in the `jwt` callback and session handling.
   */
  interface JWT extends User {}
}
