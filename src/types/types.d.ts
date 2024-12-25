import { type DefaultSession } from 'next-auth';
import { JWT as DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  /**
   * Extending the User object returned by `authorize`, `getUser`, etc.
   */
  interface User {
    id: string;
    token?: string;
    onBoarding?: boolean;
  }

  /**
   * Extending the Session object used by `useSession` and `getSession`.
   */
  interface Session {
    user: {
      id: string;
      onBoarding?: boolean;
    } & DefaultSession['user'];
    accessToken?: string;
  }

  /**
   * Account object returned by OAuth providers.
   */
  interface Account {
    provider: string;
    type: string;
    access_token?: string;
    expires_at?: number;
    id_token?: string;
    refresh_token?: string;
  }
}

declare module 'next-auth/jwt' {
  /**
   * Extending the JWT object used in the `jwt` callback and session handling.
   */
  interface JWT extends DefaultJWT {
    id: string;
    token: string;
    onBoarding?: boolean;
  }
}
