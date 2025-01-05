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
  language: string,
): Promise<LocationType[]> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/users/${language}/countries`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP 錯誤: ${response.status}`);
    }

    const data: CountryResponse = await response.json();

    const countries: LocationType[] = Object.entries(data.data).map(
      ([key, value]) => ({
        value: key,
        text: value,
      }),
    );

    return countries;
  } catch (error) {
    console.error('獲取國家資料失敗:', error);
    return [];
  }
}
