import { apiClient } from '@/lib/apiClient';

export interface IndustryDTO {
  id: number;
  category: string;
  language: string;
  subject_group: string;
  subject: string;
  profession_metadata: {
    desc: string;
    icon: string;
  };
}

interface IndustryResponseDTO {
  code: string;
  msg: string;
  data: {
    professions: IndustryDTO[];
  };
}

export async function fetchIndustries(
  language: string
): Promise<IndustryDTO[]> {
  try {
    const data = await apiClient.get<IndustryResponseDTO>(
      `/v1/users/${language}/industries`,
      { auth: false }
    );

    return data.data.professions;
  } catch (error) {
    console.error('獲取行業數據失敗:', error);
    return [];
  }
}
