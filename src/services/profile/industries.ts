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
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/users/${language}/industries`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP 錯誤: ${response.status}`);
    }
    const data: IndustryResponseDTO = await response.json();

    return data.data.professions;
  } catch (error) {
    console.error('獲取行業數據失敗:', error);
    return [];
  }
}
