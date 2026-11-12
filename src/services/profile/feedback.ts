import { apiClient, ApiError } from '@/lib/apiClient';
import {
  formatAuthorMaskedName,
  toNonNegativeInt,
} from '@/lib/mentor/mentorStats';
import {
  DEFAULT_FEEDBACK_PAGE_SIZE,
  type FetchMentorFeedbackParams,
  type MentorFeedbackItem,
  type MentorFeedbackPage,
  type RawMentorFeedbackItem,
  type RawMentorFeedbackResponse,
} from '@/types/feedback';

function clampRating(rawRating: number | null | undefined): number {
  if (typeof rawRating !== 'number' || !Number.isFinite(rawRating)) {
    return 0;
  }
  const rounded = Math.round(rawRating);
  if (rounded < 0) return 0;
  if (rounded > 10) return 10;
  return rounded;
}

function extractRawItems(
  raw: RawMentorFeedbackResponse | RawMentorFeedbackItem[]
): RawMentorFeedbackItem[] {
  if (Array.isArray(raw)) {
    return raw;
  }
  const candidates = raw.feedbacks ?? raw.items ?? raw.feedback ?? raw.reviews;
  return Array.isArray(candidates) ? candidates : [];
}

function mapFeedbackItem(
  raw: RawMentorFeedbackItem,
  index: number,
  page: number
): MentorFeedbackItem {
  const rawId = raw.id ?? raw.feedback_id ?? raw.reservation_id;
  const id =
    rawId !== null && rawId !== undefined && String(rawId).trim() !== ''
      ? String(rawId)
      : `feedback-${page}-${index}`;

  return {
    id,
    authorName: formatAuthorMaskedName(
      raw.author_name ?? raw.author_masked_name
    ),
    rating: clampRating(raw.rating),
    content: typeof raw.content === 'string' ? raw.content.trim() : '',
    createdAt: raw.created_at ?? null,
  };
}

export function mapMentorFeedbackResponse(
  raw: RawMentorFeedbackResponse | RawMentorFeedbackItem[] | null | undefined,
  requestedPage = 1,
  requestedPageSize = DEFAULT_FEEDBACK_PAGE_SIZE
): MentorFeedbackPage {
  const safeRequestedPage = Math.max(1, Math.floor(requestedPage));
  const safeRequestedPageSize = Math.max(1, Math.floor(requestedPageSize));

  if (!raw) {
    return {
      items: [],
      totalRatingCount: 0,
      page: safeRequestedPage,
      pageSize: safeRequestedPageSize,
      ratingAverage: null,
      completedMeetingCount: null,
      isFallbackEmpty: true,
    };
  }

  const rawItems = extractRawItems(raw);
  const resolvedPage =
    !Array.isArray(raw) &&
    typeof raw.page === 'number' &&
    Number.isFinite(raw.page) &&
    raw.page >= 1
      ? Math.floor(raw.page)
      : safeRequestedPage;

  const resolvedPageSize =
    !Array.isArray(raw) &&
    typeof raw.page_size === 'number' &&
    Number.isFinite(raw.page_size) &&
    raw.page_size >= 1
      ? Math.floor(raw.page_size)
      : safeRequestedPageSize;

  const items = rawItems
    .filter((item) => item?.is_public !== false)
    .map((item, idx) => mapFeedbackItem(item, idx, resolvedPage));

  const filteredOutCount = rawItems.length - items.length;
  const rawTotal = Array.isArray(raw)
    ? undefined
    : (raw.total_rating_count ?? raw.total ?? raw.rating_count);
  const parsedBackendTotal =
    rawTotal !== undefined && rawTotal !== null
      ? toNonNegativeInt(rawTotal)
      : null;
  const totalRatingCount =
    parsedBackendTotal === null
      ? items.length
      : filteredOutCount > 0 && parsedBackendTotal >= rawItems.length
        ? Math.max(items.length, parsedBackendTotal - filteredOutCount)
        : Math.max(items.length, parsedBackendTotal);

  let ratingAverage: number | null = null;
  if (
    !Array.isArray(raw) &&
    totalRatingCount > 0 &&
    typeof raw.rating_average === 'number' &&
    Number.isFinite(raw.rating_average) &&
    raw.rating_average > 0
  ) {
    ratingAverage = raw.rating_average;
  } else if (
    totalRatingCount > 0 &&
    items.length === totalRatingCount &&
    items.every((item) => item.rating > 0)
  ) {
    const sum = items.reduce((acc, item) => acc + item.rating, 0);
    ratingAverage = Math.round((sum / items.length) * 10) / 10;
  }

  const completedMeetingCount =
    !Array.isArray(raw) &&
    raw.completed_meeting_count !== undefined &&
    raw.completed_meeting_count !== null
      ? toNonNegativeInt(raw.completed_meeting_count)
      : null;

  return {
    items,
    totalRatingCount,
    page: resolvedPage,
    pageSize: resolvedPageSize,
    ratingAverage,
    completedMeetingCount,
  };
}

export async function fetchMentorFeedback({
  mentorId,
  page = 1,
  pageSize = DEFAULT_FEEDBACK_PAGE_SIZE,
  signal,
}: FetchMentorFeedbackParams): Promise<MentorFeedbackPage> {
  const safePage = Math.max(1, Math.floor(page));
  const params: Record<string, string | number | undefined> = {
    page: safePage,
    ...(pageSize !== DEFAULT_FEEDBACK_PAGE_SIZE ? { page_size: pageSize } : {}),
  };

  try {
    const data = await apiClient.getUnwrapped<
      RawMentorFeedbackResponse | RawMentorFeedbackItem[]
    >(`/v1/mentors/${mentorId}/feedback`, {
      auth: false,
      params,
      signal,
    });
    return mapMentorFeedbackResponse(data, safePage, pageSize);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return {
        items: [],
        totalRatingCount: 0,
        page: safePage,
        pageSize,
        ratingAverage: null,
        completedMeetingCount: null,
        isFallbackEmpty: true,
      };
    }
    throw error;
  }
}

type MentorFeedbackInvalidationListener = (mentorId?: number) => void;
const mentorFeedbackInvalidationListeners =
  new Set<MentorFeedbackInvalidationListener>();

export function subscribeMentorFeedbackInvalidation(
  listener: MentorFeedbackInvalidationListener
): () => void {
  mentorFeedbackInvalidationListeners.add(listener);
  return () => {
    mentorFeedbackInvalidationListeners.delete(listener);
  };
}

export function invalidateMentorFeedback(mentorId?: number): void {
  mentorFeedbackInvalidationListeners.forEach((listener) => {
    listener(mentorId);
  });
}
