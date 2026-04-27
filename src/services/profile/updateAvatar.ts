import { getSession } from 'next-auth/react';

import {
  fetchPresignedUrlByUserId,
  PresignedUrlData,
} from '@/services/profile/presignedUrl';

interface PresignedUrlFields {
  key: string;
  AWSAccessKeyId: string;
  'x-amz-security-token': string;
  policy: string;
  signature: string;
  [key: string]: string;
}

// S3 presigned POST URLs are valid for 15 minutes; cap our cache at 10 to
// leave headroom for the actual upload to complete before expiry.
const PRESIGNED_TTL_MS = 10 * 60 * 1000;

interface PresignedCacheEntry {
  userId: number;
  fetchedAt: number;
  promise: Promise<PresignedUrlData | null>;
}

let presignedCache: PresignedCacheEntry | null = null;

function isCacheUsable(
  entry: PresignedCacheEntry | null,
  userId: number
): entry is PresignedCacheEntry {
  if (!entry) return false;
  if (entry.userId !== userId) return false;
  if (Date.now() - entry.fetchedAt > PRESIGNED_TTL_MS) return false;
  return true;
}

/**
 * Fire-and-forget warm-up for the avatar presigned URL. Caller should not
 * await — the cached promise is consumed by `updateAvatar` at submit time
 * to remove one serial request from the upload waterfall.
 */
export function prefetchPresignedUrl(userId: number): void {
  if (!Number.isFinite(userId) || userId <= 0) return;
  if (isCacheUsable(presignedCache, userId)) return;
  const promise = fetchPresignedUrlByUserId(userId).catch(() => null);
  presignedCache = { userId, fetchedAt: Date.now(), promise };
}

export function clearPresignedUrlCache(): void {
  presignedCache = null;
}

async function consumePresignedUrl(
  userId: number
): Promise<PresignedUrlData | null> {
  if (isCacheUsable(presignedCache, userId)) {
    const cached = presignedCache;
    // Single-use: clear regardless of outcome so the next upload re-fetches.
    presignedCache = null;
    const result = await cached.promise;
    if (result) return result;
  }
  return fetchPresignedUrlByUserId(userId);
}

// 你的後端 policy 有這條：["starts-with", "$Content-Type", "image/"]
// 所以 file.type 必須是 image/*
async function uploadToS3WithPresignedPost(
  presigned: { url: string; fields: PresignedUrlFields },
  avatarFile: File,
  signal?: AbortSignal
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

  // S3 upload uses raw fetch — not our API, so apiClient is not used here
  const res = await fetch(presigned.url, {
    method: 'POST',
    body: formData,
    signal,
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
 * 1) 呼叫後端拿 presigned url（若有預抓 cache 命中則直接消費）
 * 2) 用 presigned POST 直接上傳到 S3
 * 3) 回傳檔案的公開 URL（bucketUrl + key）
 */
export async function updateAvatar(
  avatarFile: File,
  signal?: AbortSignal
): Promise<string | undefined> {
  try {
    const session = await getSession();
    const userId = session?.user?.id;

    if (!userId) {
      throw new Error('未獲取到有效的身份驗證信息，請重新登入。');
    }

    if (!avatarFile.type?.startsWith('image/')) {
      throw new Error('頭像檔案必須是圖片格式 (image/*)。');
    }

    const presigned = await consumePresignedUrl(Number(userId));
    if (!presigned?.url || !presigned?.fields?.key) {
      throw new Error('取得 presigned url 失敗或回傳格式不完整');
    }

    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    await uploadToS3WithPresignedPost(presigned, avatarFile, signal);

    return buildS3ObjectUrl(presigned.url, presigned.fields.key);
  } catch (error) {
    // Let abort propagate as-is so callers can detect cancellation
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('無法連接到伺服器。請檢查您的網絡連接。');
    }

    throw new Error(error instanceof Error ? error.message : '未知的錯誤發生');
  }
}
