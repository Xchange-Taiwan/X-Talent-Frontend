import { getSession } from 'next-auth/react';

import { apiClient } from '@/lib/apiClient';

import { ExperienceType } from './experienceType';

export interface MentorExperiencePayload {
  id?: number;
  category: ExperienceType;
  mentor_experiences_metadata: Record<string, unknown>;
  order: number;
}

export async function upsertMentorExperience(
  experienceType: ExperienceType,
  isMentor: boolean,
  payload: MentorExperiencePayload
): Promise<void> {
  const session = await getSession();
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error('未找到使用者 ID，請重新登入。');
  }

  try {
    await apiClient.put(
      `/v1/mentors/${userId}/experiences/${experienceType}`,
      payload,
      { headers: { 'is-mentor': String(isMentor) } }
    );
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('無法連接到伺服器。請檢查您的網路連線。');
    }

    throw new Error(error instanceof Error ? error.message : '未知錯誤');
  }
}
