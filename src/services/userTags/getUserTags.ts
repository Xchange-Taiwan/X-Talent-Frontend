import { getSession } from 'next-auth/react';

import { apiClient } from '@/lib/apiClient';

import type { TagIntent, TagKind, UserTag, UserTagListVO } from './types';

interface ApiEnvelope<T> {
  data?: T;
  code?: string;
  msg?: string;
}

interface GetUserTagsOptions {
  userId?: number;
  kind?: TagKind;
  intent?: TagIntent;
  signal?: AbortSignal;
}

export async function getUserTags({
  userId,
  kind,
  intent,
  signal,
}: GetUserTagsOptions = {}): Promise<UserTag[]> {
  let id = userId;
  if (!id) {
    const session = await getSession();
    id = session?.user?.id ? Number(session.user.id) : undefined;
  }

  if (!id) {
    throw new Error('未找到使用者 ID，請重新登入。');
  }

  try {
    const res = await apiClient.get<ApiEnvelope<UserTagListVO>>(
      `/v1/users/${id}/tags`,
      {
        params: { kind, intent },
        signal,
      }
    );
    return res?.data?.user_tags ?? [];
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('無法連接到伺服器。請檢查您的網路連線。');
    }
    throw error;
  }
}
