import { getSession } from 'next-auth/react';

import { ExperienceType } from './experienceType';

export async function deleteExperience(
  experienceType: ExperienceType,
  experienceId: number,
  isMentor: boolean,
): Promise<void> {
  try {
    const session = await getSession();
    const token = session?.accessToken;
    const rawUserId = session?.user?.id;

    const userId = Number(rawUserId);

    if (!token || !rawUserId || isNaN(userId)) {
      throw new Error('無效的使用者登入資訊，請重新登入。');
    }

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/mentors/${userId}/experiences/${experienceType}/${experienceId}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'is-mentor': String(isMentor),
        },
      },
    );

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error?.msg || '刪除失敗，請稍後再試。');
    }

    console.log(`✅ 已刪除 ${experienceType} 經驗（ID: ${experienceId}）`);
  } catch (err) {
    if (err instanceof TypeError && err.message === 'Failed to fetch') {
      throw new Error('無法連接到伺服器，請確認網路連線。');
    }

    throw new Error(err instanceof Error ? err.message : '發生未知錯誤');
  }
}
