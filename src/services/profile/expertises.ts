export interface ExpertiseType {
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

interface ExpertiseResponse {
  code: string;
  msg: string;
  data: {
    professions: {
      id: number;
      category: string;
      language: string;
      subject_group: string;
      subject: string;
      profession_metadata: {
        desc?: string;
        icon?: string;
      };
    }[];
  };
}

export async function fetchExpertises(
  language: string
): Promise<ExpertiseType[]> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/mentors/${language}/expertises`,
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

    const data: ExpertiseResponse = await response.json();

    return data.data.professions.map((profession) => ({
      id: profession.id,
      category: profession.category,
      language: profession.language,
      subject_group: profession.subject_group,
      subject: profession.subject,
      desc: {
        desc: profession.profession_metadata.desc,
        icon: profession.profession_metadata.icon,
      },
    }));
  } catch (error) {
    console.error('獲取專業領域列表失敗:', error);
    return [];
  }
}
