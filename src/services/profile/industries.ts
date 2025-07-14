export interface IndustryType {
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

interface IndustryResponse {
  code: string;
  msg: string;
  data: {
    professions: IndustryType[];
  };
}

export async function fetchIndustries(
  language: string,
): Promise<IndustryType[]> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/users/${language}/industries`,
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
    const data: IndustryResponse = await response.json();

    return data.data.professions;
  } catch (error) {
    console.error('獲取行業數據失敗:', error);
    return [];
  }
}
