import { getSession } from 'next-auth/react';
import * as z from 'zod';

import { formSchema } from '@/components/onboarding/steps';
import { apiClient } from '@/lib/apiClient';
import { MentorExperiencePayload } from '@/lib/profile/parseUserExperiences';
import { createProfileFormSchema } from '@/schemas/profileSchema';

export const unionformSchema = z.union([
  formSchema,
  createProfileFormSchema(true),
]);

export type UpdateProfileInput = z.infer<typeof unionformSchema> & {
  // Mirrored from the primary work experience by useProfileSubmit so the
  // backend mentor record carries the canonical job_title / company.
  job_title?: string;
  company?: string;
  // Inline experiences batch — same three-state semantics the backend uses
  // for tag buckets (omitted = leave alone, [] = clear, [...] = replace).
  experiences?: MentorExperiencePayload[];
};

export async function updateProfile(
  profileData: UpdateProfileInput
): Promise<void> {
  const session = await getSession();
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error('未找到使用者 ID。請重新登入。');
  }

  try {
    const numericUserId = Number(userId);
    if (Number.isNaN(numericUserId)) {
      throw new Error('使用者 ID 格式無效。');
    }
    await apiClient.put(`/v1/mentors/${userId}/profile`, {
      ...profileData,
      user_id: numericUserId,
    });
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('無法連接到伺服器。請檢查您的網絡連接。');
    }

    throw new Error(error instanceof Error ? error.message : '未知的錯誤發生');
  }
}
