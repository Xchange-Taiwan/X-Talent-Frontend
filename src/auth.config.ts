import type { NextAuthConfig } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

import { SignInSchema } from './schemas/auth';

export default {
  providers: [
    CredentialsProvider({
      async authorize(credentials) {
        const validatedFields = SignInSchema.safeParse(credentials);
        if (validatedFields.success) {
          const { email, password } = validatedFields.data;

          // TODO : 待處理串接 API
          const res = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: email,
              password: password,
            }),
          });

          // TODO : 待處理 user 資訊
          const user = await res.json();
          if (res.ok && user.token) {
            return { id: user.id, email: user.email, token: user.token };
          }
          return null;
        }
        return null;
      },
    }),
  ],
} satisfies NextAuthConfig;
