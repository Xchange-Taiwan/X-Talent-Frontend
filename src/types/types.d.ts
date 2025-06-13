import { type DefaultSession } from 'next-auth';
import { JWT as DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  /**
   * Extending the User object returned by `authorize`, `getUser`, etc.
   */
  interface User {
    id?: string;
    token?: string;
    onBoarding?: boolean;
    oauthId?: string;
    name?: string;
    avatar?: string;
    msg?: string;
    isMentor?: boolean;
  }

  /**
   * Extending the Session object used by `useSession` and `getSession`.
   */
  interface Session {
    user: {
      id?: string;
      token?: string;
      onBoarding?: boolean;
      oauthId?: string;
      msg?: string;
      isMentor?: boolean;
    } & DefaultSession['user'];
    accessToken?: string;
    googleAccessToken?: string;
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
    msg?: string;
    isMentor?: boolean;
  }
}
