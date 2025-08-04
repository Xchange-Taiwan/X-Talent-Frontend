import { getSession } from 'next-auth/react';

import { ExperienceType } from './experienceType';

export interface MentorExperiencePayload {
  id?: number;
  category: ExperienceType;
  mentor_experiences_metadata: Record<string, unknown>;
  order: number;
}

interface UpsertExperienceResponse {
  msg?: string;
}

export async function upsertMentorExperience(
  experienceType: ExperienceType,
  isMentor: boolean,
  payload: MentorExperiencePayload
): Promise<void> {
  try {
    const session = await getSession();
    const token = session?.accessToken;
    const userId = session?.user?.id;

    if (!token || !userId) {
      throw new Error('未找到授權令牌或使用者 ID，請重新登入。');
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/mentors/${userId}/experiences/${experienceType}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'is-mentor': String(isMentor),
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const result: UpsertExperienceResponse = await response.json();
      throw new Error(result.msg || '更新經驗資料失敗');
    }
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('無法連接到伺服器。請檢查您的網路連線。');
    }

    throw new Error(error instanceof Error ? error.message : '未知錯誤');
  }
}
