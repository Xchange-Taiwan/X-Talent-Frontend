import { apiClient } from '@/lib/apiClient';

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

interface InterestResponseDTO {
  code: string;
  msg: string;
  data: {
    interests: InterestDTO[];
    language: string | null;
  };
}

export async function fetchInterests(
  language: string,
  interest: string
): Promise<InterestDTO[]> {
  try {
    const data = await apiClient.get<InterestResponseDTO>(
      `/v1/users/${language}/interests`,
      { auth: false, params: { interest } }
    );

    return data.data.interests;
  } catch (error) {
    console.error('獲取興趣列表失敗:', error);
    return [];
  }
}
