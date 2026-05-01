import { getSession } from 'next-auth/react';

import { apiClient } from '@/lib/apiClient';

import type { ReplaceUserTagsPayload, ReplaceUserTagsVO } from './types';

interface ApiEnvelope<T> {
  data?: T;
  code?: string;
  msg?: string;
}

export async function replaceUserTags(
  payload: ReplaceUserTagsPayload,
  userId?: number
): Promise<ReplaceUserTagsVO | null> {
  let id = userId;
  if (!id) {
    const session = await getSession();
    id = session?.user?.id ? Number(session.user.id) : undefined;
  }

  if (!id) {
    throw new Error('未找到使用者 ID，請重新登入。');
  }

  try {
    const res = await apiClient.put<ApiEnvelope<ReplaceUserTagsVO>>(
      `/v1/users/${id}/tags`,
      payload
    );
    return res?.data ?? null;
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('無法連接到伺服器。請檢查您的網路連線。');
    }
    throw new Error(error instanceof Error ? error.message : '未知錯誤');
  }
}
