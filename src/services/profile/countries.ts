import { apiClient } from '@/lib/apiClient';

export interface LocationType {
  value: string;
  text: string;
}

interface CountryResponse {
  code: string;
  msg: string;
  data: Record<string, string>;
}

export async function fetchCountries(
  language: string
): Promise<LocationType[]> {
  try {
    const data = await apiClient.get<CountryResponse>(
      `/v1/users/${language}/countries`,
      { auth: false }
    );

    return Object.entries(data.data).map(([key, value]) => ({
      value: key,
      text: value,
    }));
  } catch (error) {
    console.error('獲取國家資料失敗:', error);
    return [];
  }
}
