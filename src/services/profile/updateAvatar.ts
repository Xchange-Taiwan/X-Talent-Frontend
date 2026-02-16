import { getSession } from 'next-auth/react';

import { fetchPresignedUrlByUserId } from '@/services/profile/presignedUrl';

interface PresignedUrlFields {
  key: string;
  AWSAccessKeyId: string;
  'x-amz-security-token': string;
  policy: string;
  signature: string;
  [key: string]: string;
}

interface PresignedUrlData {
  url: string;
  fields: PresignedUrlFields;
}

// 你的後端 policy 有這條：["starts-with", "$Content-Type", "image/"]
// 所以 file.type 必須是 image/*
async function uploadToS3WithPresignedPost(
  presigned: PresignedUrlData,
  avatarFile: File
): Promise<void> {
  const formData = new FormData();

  // S3 Presigned POST: 必須先塞所有 fields
  Object.entries(presigned.fields).forEach(([k, v]) => {
    formData.append(k, v);
  });

  // 很多 presigned policy 會要求 Content-Type
  formData.append('Content-Type', avatarFile.type);

  // S3 期待 file 欄位名稱是 file
  formData.append('file', avatarFile);

  const res = await fetch(presigned.url, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(
      `S3 上傳失敗: ${res.status}${errText ? ` - ${errText}` : ''}`
    );
  }
}

function buildS3ObjectUrl(bucketUrl: string, key: string): string {
  return bucketUrl.endsWith('/') ? `${bucketUrl}${key}` : `${bucketUrl}/${key}`;
}

/**
 * updateAvatar
 * 1) 呼叫後端拿 presigned url (另外一支檔案)
 * 2) 用 presigned POST 直接上傳到 S3
 * 3) 回傳檔案的公開 URL（bucketUrl + key）
 *
 * 注意：如果你的 S3 bucket 不是 public，
 * 回傳的 object url 可能無法直接被瀏覽器讀取（要改成 CloudFront 或再拿 GET presigned）。
 */
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

    if (!avatarFile.type?.startsWith('image/')) {
      throw new Error('頭像檔案必須是圖片格式 (image/*)。');
    }

    // 1) 拿 presigned（你說在另外一支檔案）
    // 你的函式若只收 1 個參數，就只傳 userId
    const presigned = await fetchPresignedUrlByUserId(Number(userId));
    console.log(presigned);
    if (!presigned?.url || !presigned?.fields?.key) {
      throw new Error('取得 presigned url 失敗或回傳格式不完整');
    }

    // 2) 上傳到 S3
    await uploadToS3WithPresignedPost(presigned, avatarFile);

    // 3) 回傳上傳後的 URL（依你後端回傳的 url 結構）
    return buildS3ObjectUrl(presigned.url, presigned.fields.key);
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('無法連接到伺服器。請檢查您的網絡連接。');
    }

    throw new Error(error instanceof Error ? error.message : '未知的錯誤發生');
  }
}
