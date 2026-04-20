import { getSession } from 'next-auth/react';

import { apiClient, ApiError } from '@/lib/apiClient';
import type { components } from '@/types/api';

type DeleteAccountDTO = components['schemas']['DeleteAccountDTO'];

export type DeleteAccountResult =
  | { status: 'success' }
  | { status: 'blocked_reservations' }
  | { status: 'error'; message: string };

export async function deleteAccount(
  payload: DeleteAccountDTO
): Promise<DeleteAccountResult> {
  try {
    const session = await getSession();
    const token = session?.accessToken;
    await apiClient.delete('/v1/auth/account', payload, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return { status: 'success' };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 409) return { status: 'blocked_reservations' };
      return { status: 'error', message: error.message };
    }
    return { status: 'error', message: '系統錯誤，請稍後再試' };
  }
}
