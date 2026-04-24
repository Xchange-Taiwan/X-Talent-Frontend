import { getSession } from 'next-auth/react';

import { apiClient } from '@/lib/apiClient';
import type { components } from '@/types/api';

export type MentorProfileVO = components['schemas']['MentorProfileVO'];

type ApiResponseMentorProfileVO =
  components['schemas']['ApiResponse_MentorProfileVO_'];

export async function fetchUser(
  language: string
): Promise<MentorProfileVO | null> {
  const session = await getSession();
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error('未找到使用者 ID。請重新登入。');
  }

  return fetchUserById(Number(userId), language);
}

export async function fetchUserById(
  userId: number,
  language: string
): Promise<MentorProfileVO | null> {
  try {
    const result = await apiClient.get<ApiResponseMentorProfileVO>(
      `/v1/mentors/${userId}/${language}/profile`,
      { auth: false }
    );

    if (result.code !== '0') {
      console.error(`API Error: ${result.msg}`);
      return null;
    }

    return result.data ?? null;
  } catch (error) {
    console.error('Fetch User Error:', error);
    return null;
  }
}
