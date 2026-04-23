import { apiClient } from '@/lib/apiClient';
import type { components } from '@/types/api';

type ProfessionVO = components['schemas']['ProfessionVO'];
type ApiResponse = components['schemas']['ApiResponse_ProfessionListVO_'];

// profession_metadata is typed as Record<string, never> in the generated schema
// because the backend Pydantic model uses dict — see X-Talent-Tracker#88
type ProfessionMetadata = { desc?: string; icon?: string };

export interface IndustryDTO {
  id: number;
  category: string;
  language: string;
  subject_group: string;
  subject: string;
  profession_metadata: {
    desc?: string;
    icon?: string;
  };
}

function toIndustryDTO(profession: ProfessionVO): IndustryDTO {
  const metadata =
    profession.profession_metadata as unknown as ProfessionMetadata;
  return {
    id: profession.id,
    category: profession.category,
    language: profession.language ?? '',
    subject_group: profession.subject_group,
    subject: profession.subject,
    profession_metadata: {
      desc: metadata.desc,
      icon: metadata.icon,
    },
  };
}

export async function fetchIndustries(
  language: string
): Promise<IndustryDTO[]> {
  try {
    const data = await apiClient.get<ApiResponse>(
      `/v1/users/${language}/industries`
    );

    return (data.data?.professions ?? []).map(toIndustryDTO);
  } catch (error) {
    console.error('獲取行業數據失敗:', error);
    return [];
  }
}
