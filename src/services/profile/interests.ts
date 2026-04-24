import { apiClient } from '@/lib/apiClient';
import type { components } from '@/types/api';

export type InterestVO = components['schemas']['InterestVO'];
type ApiResponse = components['schemas']['ApiResponse_InterestListVO_'];

export async function fetchInterests(
  language: string,
  interest: string
): Promise<InterestVO[]> {
  try {
    const data = await apiClient.get<ApiResponse>(
      `/v1/users/${language}/interests`,
      { params: { interest }, auth: false }
    );

    return data.data?.interests ?? [];
  } catch (error) {
    console.error('獲取興趣列表失敗:', error);
    return [];
  }
}
