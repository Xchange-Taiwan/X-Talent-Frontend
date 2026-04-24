import { apiClient } from '@/lib/apiClient';
import type { components } from '@/types/api';

export type ProfessionVO = components['schemas']['ProfessionVO'];
type ApiResponse = components['schemas']['ApiResponse_ProfessionListVO_'];

export async function fetchExpertises(
  language: string
): Promise<ProfessionVO[]> {
  try {
    const data = await apiClient.get<ApiResponse>(
      `/v1/mentors/${language}/expertises`,
      { auth: false }
    );

    return data.data?.professions ?? [];
  } catch (error) {
    console.error('獲取專業領域列表失敗:', error);
    return [];
  }
}
