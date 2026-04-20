import { apiClient } from '@/lib/apiClient';
import type { components } from '@/types/api';

type ProfessionVO = components['schemas']['ProfessionVO'];
type ApiResponse = components['schemas']['ApiResponse_ProfessionListVO_'];

// profession_metadata is typed as Record<string, never> in the generated schema
// because the backend Pydantic model uses dict — see X-Talent-Tracker#88
type ProfessionMetadata = { desc?: string; icon?: string };

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
  const metadata =
    profession.profession_metadata as unknown as ProfessionMetadata;
  return {
    id: profession.id,
    category: profession.category,
    language: profession.language ?? '',
    subject_group: profession.subject_group,
    subject: profession.subject,
    desc: {
      desc: metadata.desc,
      icon: metadata.icon,
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
