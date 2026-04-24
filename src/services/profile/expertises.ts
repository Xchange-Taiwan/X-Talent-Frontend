import { apiClient } from '@/lib/apiClient';
import type { components } from '@/types/api';

type ProfessionVO = components['schemas']['ProfessionVO'];
type ApiResponse = components['schemas']['ApiResponse_ProfessionListVO_'];

export interface ExpertiseType {
  id: number;
  category: string;
  language: string;
  subject_group: string;
  subject: string;
  desc: {
    desc?: string;
    icon?: string;
  };
}

function toExpertiseType(profession: ProfessionVO): ExpertiseType {
  return {
    id: profession.id,
    category: profession.category,
    language: profession.language ?? '',
    subject_group: profession.subject_group,
    subject: profession.subject,
    desc: {
      desc: profession.profession_metadata.desc ?? undefined,
      icon: profession.profession_metadata.icon ?? undefined,
    },
  };
}

export async function fetchExpertises(
  language: string
): Promise<ExpertiseType[]> {
  try {
    const data = await apiClient.get<ApiResponse>(
      `/v1/mentors/${language}/expertises`,
      { auth: false }
    );

    return (data.data?.professions ?? []).map(toExpertiseType);
  } catch (error) {
    console.error('獲取專業領域列表失敗:', error);
    return [];
  }
}
