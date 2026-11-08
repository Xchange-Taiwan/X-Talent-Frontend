import { z } from 'zod';

import { apiClient } from '@/lib/apiClient';
import { SignUpSchema } from '@/schemas/auth';

export async function signUp(
  values: z.infer<typeof SignUpSchema>
): Promise<void> {
  await apiClient.postUnwrapped<null>(
    '/v1/auth/signup',
    {
      email: values.email,
      password: values.password,
      confirm_password: values.confirm_password,
    },
    { auth: false }
  );
}
