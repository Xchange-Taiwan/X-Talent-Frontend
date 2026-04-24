import { apiClient } from '@/lib/apiClient';
import type { components } from '@/types/api';

type InterestVO = components['schemas']['InterestVO'];
type ApiResponse = components['schemas']['ApiResponse_InterestListVO_'];

// desc is typed as Record<string, never> in the generated schema
// because the backend Pydantic model uses dict — see X-Talent-Tracker#88
type InterestDesc = { desc?: string; icon?: string };

export interface InterestDTO {
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

function toInterestDTO(interest: InterestVO): InterestDTO {
  const desc = interest.desc as unknown as InterestDesc | null;
  return {
    id: interest.id,
    category: interest.category ?? '',
    language: interest.language ?? '',
    subject_group: interest.subject_group,
    subject: interest.subject ?? '',
    desc: {
      desc: desc?.desc,
      icon: desc?.icon,
    },
  };
}

export async function fetchInterests(
  language: string,
  interest: string
): Promise<InterestDTO[]> {
  try {
    const data = await apiClient.get<ApiResponse>(
      `/v1/users/${language}/interests`,
      { params: { interest }, auth: false }
    );

    return (data.data?.interests ?? []).map(toInterestDTO);
  } catch (error) {
    console.error('獲取興趣列表失敗:', error);
    return [];
  }
}
