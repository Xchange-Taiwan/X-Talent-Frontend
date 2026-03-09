import { getSession } from 'next-auth/react';

import { apiClient } from '@/lib/apiClient';

export interface PresignedUrlFields {
  key: string;
  AWSAccessKeyId: string;
  'x-amz-security-token': string;
  policy: string;
  signature: string;
  [key: string]: string;
}

export interface PresignedUrlData {
  url: string;
  fields: PresignedUrlFields;
}

export interface PresignedUrlResponse {
  code: string;
  msg: string;
  data?: PresignedUrlData;
}

export async function fetchPresignedUrl(): Promise<PresignedUrlData | null> {
  const session = await getSession();
  const userId = session?.user?.id;

  if (!userId) {
    console.error('No user id in session');
    return null;
  }

  return fetchPresignedUrlByUserId(Number(userId));
}

export async function fetchPresignedUrlByUserId(
  userId: number
): Promise<PresignedUrlData | null> {
  try {
    const result = await apiClient.get<PresignedUrlResponse>(
      `/v1/storage/presigned-url/${userId}`
    );

    if (result.code !== '0') {
      console.error(`API Error: ${result.msg}`);
      return null;
    }

    return result.data ?? null;
  } catch (error) {
    console.error('Fetch Presigned Url Error:', error);
    return null;
  }
}
