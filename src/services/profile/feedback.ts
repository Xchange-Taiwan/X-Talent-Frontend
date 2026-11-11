import { apiClient, ApiError } from '@/lib/apiClient';
import { normalizeMentorStats } from '@/lib/mentor/mentorStats';
import type {
  MentorFeedbackItem,
  MentorFeedbackPage,
  RawMentorFeedbackItem,
  RawMentorFeedbackResponse,
} from '@/types/feedback';

export const DEFAULT_FEEDBACK_PAGE_SIZE = 10;

const TAIPEI_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toPositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
    return fallback;
  }
  return Math.floor(value);
}

function toNonNegativeInt(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return Math.floor(value);
}

export function parseFeedbackTimestamp(
  rawDate: string | number | null | undefined
): number {
  if (rawDate === null || rawDate === undefined || rawDate === '') {
    return Number.NEGATIVE_INFINITY;
  }

  if (typeof rawDate === 'number') {
    if (!Number.isFinite(rawDate) || rawDate <= 0) {
      return Number.NEGATIVE_INFINITY;
    }
    return rawDate < 1e11 ? rawDate * 1000 : rawDate;
  }

  const trimmed = rawDate.trim();
  if (!trimmed) return Number.NEGATIVE_INFINITY;

  const dateOnlyMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(trimmed);
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch;
    const padded = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00+08:00`;
    const ts = Date.parse(padded);
    return Number.isFinite(ts) ? ts : Number.NEGATIVE_INFINITY;
  }

  if (/^\d+$/.test(trimmed)) {
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric < 1e11 ? numeric * 1000 : numeric;
    }
  }

  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

export function formatFeedbackDate(
  rawDate: string | number | null | undefined
): string {
  if (typeof rawDate === 'string') {
    const trimmed = rawDate.trim();
    const dateOnlyMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(trimmed);
    if (dateOnlyMatch) {
      const [, y, m, d] = dateOnlyMatch;
      return `${y}/${m.padStart(2, '0')}/${d.padStart(2, '0')}`;
    }
  }

  const timestamp = parseFeedbackTimestamp(rawDate);
  if (!Number.isFinite(timestamp)) {
    return '';
  }

  return TAIPEI_DATE_FORMATTER.format(new Date(timestamp)).replace(/-/g, '/');
}

export function extractAuthorInitial(authorName: string): string {
  const cleaned = authorName.trim().replace(/^\*+/, '').trim();
  if (!cleaned) return '匿';
  const [firstChar] = Array.from(cleaned);
  return firstChar || '匿';
}

export function createEmptyMentorFeedbackPage(
  page = 1,
  isFallback = false
): MentorFeedbackPage {
  return {
    items: [],
    totalRatingCount: 0,
    page: toPositiveInt(page, 1),
    pageSize: DEFAULT_FEEDBACK_PAGE_SIZE,
    totalPages: 0,
    ratingAverage: null,
    completedMeetingCount: null,
    isFallback,
  };
}

function readRawItems(
  record: Record<string, unknown>
): Record<string, unknown>[] | null {
  const keys = ['items', 'feedbacks', 'feedback', 'reviews'] as const;
  for (const key of keys) {
    const candidate = record[key];
    if (Array.isArray(candidate)) {
      return candidate.filter(isPlainRecord);
    }
  }
  return null;
}

function hasRecognizedFeedbackShape(
  record: Record<string, unknown>,
  rawItems: Record<string, unknown>[] | null
): boolean {
  if (rawItems !== null) return true;
  return (
    'total_rating_count' in record ||
    'total' in record ||
    'rating_count' in record ||
    'page' in record ||
    'page_size' in record
  );
}

function normalizeRatingScore(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  const clamped = Math.min(10, Math.max(0, value));
  return Math.round(clamped * 10) / 10;
}

function readOptionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === 'number' ? value : undefined;
}

function readRawStatsRecord(
  record: Record<string, unknown>
): RawMentorFeedbackResponse {
  const nestedStats = isPlainRecord(record['stats']) ? record['stats'] : null;
  return {
    completed_meeting_count: readOptionalNumber(
      record['completed_meeting_count']
    ),
    total_rating_count: readOptionalNumber(record['total_rating_count']),
    rating_count: readOptionalNumber(record['rating_count']),
    rating_average: readOptionalNumber(record['rating_average']),
    total: readOptionalNumber(record['total']),
    page: readOptionalNumber(record['page']),
    page_size: readOptionalNumber(record['page_size']),
    limit: readOptionalNumber(record['limit']),
    stats: nestedStats
      ? {
          completed_meeting_count: readOptionalNumber(
            nestedStats['completed_meeting_count']
          ),
          total_rating_count: readOptionalNumber(
            nestedStats['total_rating_count']
          ),
          rating_count: readOptionalNumber(nestedStats['rating_count']),
          rating_average: readOptionalNumber(nestedStats['rating_average']),
        }
      : record['stats'] === null
        ? null
        : undefined,
  };
}

function toRawFeedbackItem(
  entry: Record<string, unknown>
): RawMentorFeedbackItem {
  const rawId = entry['id'];
  const rawFeedbackId = entry['feedback_id'];
  const rawCreatedAt = entry['created_at'];
  return {
    id: typeof rawId === 'string' || typeof rawId === 'number' ? rawId : null,
    feedback_id:
      typeof rawFeedbackId === 'string' || typeof rawFeedbackId === 'number'
        ? rawFeedbackId
        : null,
    author_name:
      typeof entry['author_name'] === 'string' ? entry['author_name'] : null,
    rating: typeof entry['rating'] === 'number' ? entry['rating'] : null,
    content: typeof entry['content'] === 'string' ? entry['content'] : null,
    created_at:
      typeof rawCreatedAt === 'string' || typeof rawCreatedAt === 'number'
        ? rawCreatedAt
        : null,
  };
}

export function mapMentorFeedbackPage(
  raw: unknown,
  requestedPage = 1
): MentorFeedbackPage {
  const safeRequestedPage = toPositiveInt(requestedPage, 1);

  if (raw === null || raw === undefined) {
    return createEmptyMentorFeedbackPage(safeRequestedPage, true);
  }

  let rawList: RawMentorFeedbackItem[] = [];
  let record: RawMentorFeedbackResponse = {};

  if (Array.isArray(raw)) {
    rawList = raw.filter(isPlainRecord).map(toRawFeedbackItem);
  } else if (isPlainRecord(raw)) {
    const extracted = readRawItems(raw);
    if (!hasRecognizedFeedbackShape(raw, extracted)) {
      return createEmptyMentorFeedbackPage(safeRequestedPage, true);
    }
    record = readRawStatsRecord(raw);
    rawList = (extracted ?? []).map(toRawFeedbackItem);
  } else {
    return createEmptyMentorFeedbackPage(safeRequestedPage, true);
  }

  const indexedItems = rawList.map((entry, index) => {
    const rawName =
      typeof entry.author_name === 'string' ? entry.author_name.trim() : '';
    const authorName = rawName || '匿名學員';
    const authorInitial = rawName ? extractAuthorInitial(rawName) : '匿';
    const rating = normalizeRatingScore(entry.rating);
    const content =
      typeof entry.content === 'string' ? entry.content.trim() : '';
    const createdAt =
      entry.created_at !== null && entry.created_at !== undefined
        ? String(entry.created_at)
        : '';
    const formattedDate = formatFeedbackDate(entry.created_at);
    const sortTimestamp = parseFeedbackTimestamp(entry.created_at);
    const rawId = entry.id ?? entry.feedback_id;
    const id =
      rawId !== null && rawId !== undefined && String(rawId).trim() !== ''
        ? String(rawId)
        : `feedback-${safeRequestedPage}-${index}`;

    return {
      item: {
        id,
        authorName,
        authorInitial,
        rating,
        content,
        createdAt,
        formattedDate,
      } satisfies MentorFeedbackItem,
      sortTimestamp,
      originalIndex: index,
    };
  });

  indexedItems.sort((a, b) => {
    if (b.sortTimestamp !== a.sortTimestamp) {
      return b.sortTimestamp - a.sortTimestamp;
    }
    return a.originalIndex - b.originalIndex;
  });

  const items = indexedItems.map((entry) => entry.item);

  const explicitTotal =
    record.total_rating_count ?? record.total ?? record.rating_count;
  const totalRatingCount =
    explicitTotal !== undefined && explicitTotal !== null
      ? toNonNegativeInt(explicitTotal, items.length)
      : items.length;

  const page = toPositiveInt(record.page, safeRequestedPage);
  const rawPageSize = toPositiveInt(
    record.page_size ?? record.limit,
    DEFAULT_FEEDBACK_PAGE_SIZE
  );
  const pageSize = Math.max(rawPageSize, 1);
  const totalPages =
    totalRatingCount > 0
      ? Math.max(1, Math.ceil(totalRatingCount / pageSize))
      : 0;

  const normalizedStats = normalizeMentorStats(record);
  let ratingAverage = normalizedStats?.rating_average ?? null;
  if (
    ratingAverage === null &&
    totalRatingCount > 0 &&
    items.length === totalRatingCount &&
    items.every((item) => item.rating > 0)
  ) {
    const sum = items.reduce((acc, item) => acc + item.rating, 0);
    ratingAverage = Math.round((sum / items.length) * 10) / 10;
  }

  return {
    items,
    totalRatingCount,
    page,
    pageSize,
    totalPages,
    ratingAverage: totalRatingCount > 0 ? ratingAverage : null,
    completedMeetingCount: normalizedStats
      ? normalizedStats.completed_meeting_count
      : null,
    isFallback: false,
  };
}

export async function fetchMentorFeedback(
  userId: number,
  page = 1,
  signal?: AbortSignal
): Promise<MentorFeedbackPage> {
  const safePage = toPositiveInt(page, 1);
  if (!Number.isFinite(userId) || userId <= 0) {
    return createEmptyMentorFeedbackPage(safePage, true);
  }
  const safeUserId = Math.floor(userId);
  try {
    const data = await apiClient.getUnwrapped<unknown>(
      `/v1/mentors/${safeUserId}/feedback`,
      {
        auth: false,
        params: { page: safePage },
        signal,
      }
    );
    return mapMentorFeedbackPage(data, safePage);
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    if (error instanceof ApiError && error.status === 404) {
      return createEmptyMentorFeedbackPage(safePage, true);
    }
    throw error;
  }
}
