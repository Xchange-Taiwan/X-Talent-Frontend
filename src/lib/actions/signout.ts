'use server';

import { signOut as AuthSignOut } from '@/auth';

export const signOut = async () => {
  await AuthSignOut();
};
