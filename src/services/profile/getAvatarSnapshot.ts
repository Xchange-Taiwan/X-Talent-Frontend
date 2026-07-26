import { apiClient } from '@/lib/apiClient';

/**
 * getAvatarSnapshot
 * Fetches the raw image bytes of an existing avatar from S3
 * using the non-authenticated apiClient.getExternalBlob utility.
 */
export async function getAvatarSnapshot(url: string): Promise<Blob> {
  return apiClient.getExternalBlob(url);
}
