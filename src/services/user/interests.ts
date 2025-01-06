export interface InterestType {
  id: number;
  category: string;
  language: string;
  subject_group: string;
  subject: string;
  desc: {
    desc?: string;
    icon: string;
  };
}

interface InterestResponse {
  code: string;
  msg: string;
  data: {
    interests: InterestType[];
    language: string | null;
  };
}

export async function fetchInterests(
  language: string,
  interest: string,
): Promise<InterestType[]> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/users/${language}/interests?interest=${interest}`,
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

    const data: InterestResponse = await response.json();

    return data.data.interests;
  } catch (error) {
    console.error('獲取興趣列表失敗:', error);
    return [];
  }
}
