import { apiClient } from '@/lib/apiClient';
import type { components } from '@/types/api';

type InterestVO = components['schemas']['InterestVO'];
type ApiResponse = components['schemas']['ApiResponse_InterestListVO_'];

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
  return {
    id: interest.id,
    category: interest.category ?? '',
    language: interest.language ?? '',
    subject_group: interest.subject_group,
    subject: interest.subject ?? '',
    desc: {
      desc: interest.desc?.desc ?? undefined,
      icon: interest.desc?.icon ?? undefined,
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
