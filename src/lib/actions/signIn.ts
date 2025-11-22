'use server';

import * as z from 'zod';

import { SignInSchema } from '@/schemas/auth';

export const validateSignIn = async (values: z.infer<typeof SignInSchema>) => {
  const parsed = SignInSchema.safeParse(values);

  if (!parsed.success) {
    return { error: 'Invalid fields!' };
  }

  return {
    success: true,
    email: parsed.data.email,
    password: parsed.data.password,
  };
};
