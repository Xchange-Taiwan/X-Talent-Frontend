import { getSession } from 'next-auth/react';

interface UpdateAvatarResponse {
  code: string;
  msg: string;
  data?: {
    file_info_vo_list: {
      file_id: string;
      file_name: string;
      file_size: number;
      content_type: string;
      url: string;
      create_time: string;
      update_time: string;
      create_user_id: number;
      is_deleted: boolean;
    }[];
  };
}

export async function updateAvatar(
  avatarFile: File
): Promise<string | undefined> {
  try {
    const session = await getSession();
    const token = session?.accessToken;
    const userId = session?.user?.id;

    if (!token || !userId) {
      throw new Error('未獲取到有效的身份驗證信息，請重新登入。');
    }

    const formData = new FormData();
    formData.append('file', avatarFile, avatarFile.name);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/storage/?user_id=${userId}`,
      {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const result: UpdateAvatarResponse = await response.json();
      throw new Error(result.msg || '上傳頭像失敗');
    }

    const result: UpdateAvatarResponse = await response.json();

    const uploadedFile = result.data?.file_info_vo_list?.[1];
    if (!uploadedFile) {
      throw new Error('未找到原本尺寸的檔案');
    }

    return uploadedFile.url;
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('無法連接到伺服器。請檢查您的網絡連接。');
    }

    throw new Error(error instanceof Error ? error.message : '未知的錯誤發生');
  }
}
