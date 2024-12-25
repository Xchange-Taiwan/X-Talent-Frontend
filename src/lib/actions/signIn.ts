'use server';

import { AuthError } from 'next-auth';
import * as z from 'zod';

import { signIn as AuthSignIn } from '@/auth';
import { SignInSchema } from '@/schemas/auth';

export const signIn = async (values: z.infer<typeof SignInSchema>) => {
  const validatedFields = SignInSchema.safeParse(values);

  if (!validatedFields.success) {
    return { error: 'Invalid fields!' };
  }

  const { email, password } = validatedFields.data;

  try {
    await AuthSignIn('credentials', {
      email,
      password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return { message: 'Invalid credentials!' };
        default:
          return { message: 'Something went wrong!' };
      }
    }

    throw error;
  }
};
