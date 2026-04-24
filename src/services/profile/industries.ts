import { apiClient } from '@/lib/apiClient';
import type { components } from '@/types/api';

export type ProfessionVO = components['schemas']['ProfessionVO'];
type ApiResponse = components['schemas']['ApiResponse_ProfessionListVO_'];

export async function fetchIndustries(
  language: string
): Promise<ProfessionVO[]> {
  try {
    const data = await apiClient.get<ApiResponse>(
      `/v1/users/${language}/industries`,
      { auth: false }
    );

    return data.data?.professions ?? [];
  } catch (error) {
    console.error('獲取行業數據失敗:', error);
    return [];
  }
}
