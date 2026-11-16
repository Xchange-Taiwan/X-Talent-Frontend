import { withAvatarVersion } from '@/lib/avatar/avatarUrl';
import {
  fetchPresignedUrl,
  PresignedUrlData,
  PresignedUrlFields,
} from '@/services/profile/presignedUrl';

// S3 presigned POST URLs are valid for 15 minutes; cap our cache at 10 to
// leave headroom for the actual upload to complete before expiry.
const PRESIGNED_TTL_MS = 10 * 60 * 1000;

interface PresignedCacheEntry {
  userId: number;
  fetchedAt: number;
  promise: Promise<PresignedUrlData | null>;
}

export interface PresignedUrlCache {
  prefetch(userId: number): void;
  consume(userId: number): Promise<PresignedUrlData | null>;
  clear(): void;
}

export interface CreatePresignedUrlCacheOptions {
  fetchPresigned?: (userId: number) => Promise<PresignedUrlData | null>;
  now?: () => number;
  ttlMs?: number;
}

export function createPresignedUrlCache(
  options: CreatePresignedUrlCacheOptions = {}
): PresignedUrlCache {
  const fetchFn = options.fetchPresigned ?? fetchPresignedUrl;
  const now = options.now ?? (() => Date.now());
  const ttlMs = options.ttlMs ?? PRESIGNED_TTL_MS;
  let currentEntry: PresignedCacheEntry | null = null;

  function isUsable(
    entry: PresignedCacheEntry | null,
    userId: number
  ): entry is PresignedCacheEntry {
    if (!entry) return false;
    if (entry.userId !== userId) return false;
    if (now() - entry.fetchedAt > ttlMs) return false;
    return true;
  }

  return {
    prefetch(userId: number): void {
      if (!Number.isFinite(userId) || userId <= 0) return;
      if (isUsable(currentEntry, userId)) return;
      const promise = fetchFn(userId).catch(() => null);
      currentEntry = { userId, fetchedAt: now(), promise };
    },
    async consume(userId: number): Promise<PresignedUrlData | null> {
      if (isUsable(currentEntry, userId)) {
        const cached = currentEntry;
        currentEntry = null;
        const result = await cached.promise;
        if (result) return result;
      }
      return fetchFn(userId);
    },
    clear(): void {
      currentEntry = null;
    },
  };
}

const defaultPresignedCache = createPresignedUrlCache();

export function resetPresignedUrlCache(): void {
  defaultPresignedCache.clear();
}

/**
 * Fire-and-forget warm-up for the avatar presigned URL. Caller should not
 * await — the cached promise is consumed by `updateAvatar` at submit time
 * to remove one serial request from the upload waterfall.
 */
export function prefetchPresignedUrl(
  userId: number,
  cache: PresignedUrlCache = defaultPresignedCache
): void {
  cache.prefetch(userId);
}

// 你的後端 policy 有這條：["starts-with", "$Content-Type", "image/"]
// 所以 file.type 必須是 image/*
async function uploadToS3WithPresignedPost(
  presigned: { url: string; fields: PresignedUrlFields },
  avatarFile: File,
  signal?: AbortSignal
): Promise<void> {
  const formData = new FormData();

  // S3 presigned-POST requires fields and policy-matching Content-Type to be appended before the file field.
  Object.entries(presigned.fields).forEach(([k, v]) => {
    formData.append(k, v);
  });

  formData.append('Content-Type', avatarFile.type);
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

// The S3 avatar key is per-user and stable, so the bare URL doesn't change
// when the user re-uploads. Bake `?v=<timestamp>` into the URL we hand back
// so the Image Optimizer / browser cache key changes on every upload —
// downstream consumers can render the URL directly without combining it
// with a separate version field.
function buildS3ObjectUrl(bucketUrl: string, key: string): string {
  const base = bucketUrl.endsWith('/')
    ? `${bucketUrl}${key}`
    : `${bucketUrl}/${key}`;
  return withAvatarVersion(base, Date.now(), 'v');
}

/**
 * updateAvatar
 * 1) Get a presigned URL (consumes the prefetched cache when available)
 * 2) Upload the file directly to S3 via presigned POST
 * 3) Return the public object URL (bucketUrl + key)
 *
 * `userId` is the caller's resolved auth identity — this service layer
 * never reads session/auth state itself, so callers (hooks/components)
 * are responsible for resolving it (e.g. via `useSession`).
 */
export async function updateAvatar(
  avatarFile: File,
  userId: number | undefined,
  signal?: AbortSignal,
  cache: PresignedUrlCache = defaultPresignedCache
): Promise<string | undefined> {
  try {
    if (!userId || !Number.isFinite(userId)) {
      throw new Error('未獲取到有效的身份驗證信息，請重新登入。');
    }

    if (!avatarFile.type?.startsWith('image/')) {
      throw new Error('頭像檔案必須是圖片格式 (image/*)。');
    }

    const presigned = await cache.consume(userId);
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
