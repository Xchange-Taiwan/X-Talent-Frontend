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
  // `avatar_updated_at` is an out-of-band signal the form passes when it just
  // uploaded a new avatar this session — see useProfileSubmit. Backend treats
  // any non-null value as "bytes changed, please bump the cache buster" and
  // overwrites with its own clock, so the value the FE sends is irrelevant.
  profileData: z.infer<typeof unionformSchema> & {
    avatar_updated_at?: number;
  }
): Promise<void> {
  const session = await getSession();
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error('未找到使用者 ID。請重新登入。');
  }

  // Backend currently accepts a single industry string; the frontend models
  // it as string[] (cap 10) for UI consistency with the other category menus.
  // Drop the array down to its first element until the BFF accepts an array.
  const { industry, ...rest } = profileData;
  const industryPayload = Array.isArray(industry)
    ? (industry[0] ?? '')
    : industry;

  try {
    await apiClient.put(`/v1/mentors/${userId}/profile`, {
      ...rest,
      industry: industryPayload,
      user_id: userId,
    });
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('無法連接到伺服器。請檢查您的網絡連接。');
    }

    throw new Error(error instanceof Error ? error.message : '未知的錯誤發生');
  }
}
