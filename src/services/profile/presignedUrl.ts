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

export async function fetchPresignedUrl(
  userId: number
): Promise<PresignedUrlData | null> {
  try {
    const data = await apiClient.getUnwrapped<PresignedUrlData>(
      `/v1/storage/presigned-url/${userId}`
    );
    return data ?? null;
  } catch (error) {
    console.error('Fetch Presigned Url Error:', error);
    return null;
  }
}

export const fetchPresignedUrlByUserId = fetchPresignedUrl;
