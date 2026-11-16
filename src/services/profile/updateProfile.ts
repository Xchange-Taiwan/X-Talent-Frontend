import { apiClient } from '@/lib/apiClient';
import type { MentorExperiencePayload } from '@/lib/profile/experienceCodec';

/**
 * Canonical wire write contract for `PUT /v1/mentors/{id}/profile`.
 * Decoupled from React Hook Form UI schemas so UI-only fields (`work_experiences`,
 * `educations`, `links`, `statement`, `avatarFile`) never leak onto the wire.
 */
export interface MentorProfileWritePayload {
  name: string;
  avatar?: string;
  location: string;
  years_of_experience: string;
  industry: string;
  language: string;
  is_mentor: boolean;
  onboarding?: boolean;
  about: string;
  personal_statement: string;
  // Mirrored from the primary work experience so the backend mentor record
  // carries the canonical job_title / company.
  job_title?: string;
  company?: string;
  want_position: string[];
  want_skill: string[];
  want_topic: string[];
  have_skill?: string[];
  have_topic?: string[];
  // Inline experiences batch — same three-state semantics the backend uses
  // for tag buckets (omitted = leave alone, [] = clear, [...] = replace).
  experiences?: MentorExperiencePayload[];
}

/**
 * Transitional input contract retained for Stage 1 backward compatibility
 * until `useOnboardingSubmit` is replaced by `commitProfileMutation` in Stage 2.
 */
export interface UpdateProfileInput {
  name: string;
  avatar?: string;
  location: string;
  years_of_experience: string;
  industry?: string;
  language?: string;
  is_mentor?: boolean;
  onboarding?: boolean;
  about?: string;
  personal_statement?: string;
  job_title?: string;
  company?: string;
  want_position: string[];
  want_skill: string[];
  want_topic: string[];
  have_skill?: string[];
  have_topic?: string[];
  experiences?: MentorExperiencePayload[];
}

export async function updateProfile(
  userId: string | undefined,
  profileData: MentorProfileWritePayload | UpdateProfileInput
): Promise<void> {
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
