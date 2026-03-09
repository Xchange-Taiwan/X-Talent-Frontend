import { getSession } from 'next-auth/react';
import * as z from 'zod';

import { formSchema } from '@/components/onboarding/steps';
import { createProfileFormSchema } from '@/components/profile/edit/profileSchema';
import { apiClient } from '@/lib/apiClient';

export const unionformSchema = z.union([
  formSchema,
  createProfileFormSchema(true),
]);

export async function updateProfile(
  profileData: z.infer<typeof unionformSchema>
): Promise<void> {
  const session = await getSession();
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error('未找到使用者 ID。請重新登入。');
  }

  try {
    await apiClient.put(`/v1/mentors/${userId}/profile`, {
      ...profileData,
      user_id: userId,
    });
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('無法連接到伺服器。請檢查您的網絡連接。');
    }

    throw new Error(error instanceof Error ? error.message : '未知的錯誤發生');
  }
}
