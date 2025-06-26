import { getSession } from 'next-auth/react';
import * as z from 'zod';

import { formSchema } from '@/components/onboarding/Steps';

interface UpdateProfileResponse {
  msg?: string;
}

export async function updateProfile(
  profileData: z.infer<typeof formSchema>,
): Promise<void> {
  try {
    const session = await getSession();
    const token = session?.accessToken;
    const userId = session?.user?.id;

    if (!token) {
      throw new Error('未找到授權令牌。請重新登入。');
    }

    const updatedProfileData = {
      ...profileData,
      user_id: userId,
    };

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/users/${userId}/profile`,
      {
        method: 'PUT',
        body: JSON.stringify(updatedProfileData),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      const result: UpdateProfileResponse = await response.json();
      throw new Error(result.msg || '更新個人資料失敗');
    }
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('無法連接到伺服器。請檢查您的網絡連接。');
    }

    throw new Error(error instanceof Error ? error.message : '未知的錯誤發生');
  }
}
