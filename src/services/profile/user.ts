import { getSession } from 'next-auth/react';

import { apiClient } from '@/lib/apiClient';
import type { MentorProfileVO } from '@/types/user';

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export async function fetchUser(
  language: string,
  signal?: AbortSignal
): Promise<MentorProfileVO | null> {
  const session = await getSession();
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error('未找到使用者 ID。請重新登入。');
  }

  return fetchUserById(Number(userId), language, signal);
}

export async function fetchUserById(
  userId: number,
  language: string,
  signal?: AbortSignal
): Promise<MentorProfileVO | null> {
  try {
    const data = await apiClient.getUnwrapped<MentorProfileVO>(
      `/v1/mentors/${userId}/${language}/profile`,
      { auth: false, signal }
    );

    return data ?? null;
  } catch (error) {
    if (isAbortError(error)) throw error;
    console.error('Fetch User Error:', error);
    return null;
  }
}
