import { AsyncReadManager } from '@/lib/asyncReadManager';
import type { MentorPage, MentorType } from '@/types/mentor';

export const DEFAULT_MENTOR_PAGE_LIMIT = 9;
export const UNFILTERED_MENTOR_POOL_KEY = '__unfiltered__';

export interface MentorPoolPageState {
  mentors: MentorType[];
  nextCursor: string | null;
  hasMore: boolean;
  mentorCount: number;
  isNoResults: boolean;
  hasError: boolean;
}

export const EMPTY_MENTOR_POOL_STATE: MentorPoolPageState = {
  mentors: [],
  nextCursor: null,
  hasMore: true,
  mentorCount: 0,
  isNoResults: false,
  hasError: false,
};

export type MentorPageAction =
  | { type: 'replace'; page: MentorPage; totalCount?: number }
  | { type: 'append'; page: MentorPage };

export function applyMentorPage(
  state: MentorPoolPageState,
  action: MentorPageAction
): MentorPoolPageState {
  switch (action.type) {
    case 'replace': {
      const { page, totalCount } = action;
      const nextCursor = page.nextCursor || null;
      return {
        mentors: page.mentors,
        nextCursor,
        hasMore: page.mentors.length > 0 && nextCursor !== null,
        mentorCount: totalCount ?? page.mentors.length,
        isNoResults: page.mentors.length === 0,
        hasError: false,
      };
    }
    case 'append': {
      const { page } = action;
      const nextCursor = page.nextCursor || null;

      const newMentors = page.mentors.filter(
        (newMentor) =>
          !state.mentors.some(
            (prevMentor) => prevMentor.user_id === newMentor.user_id
          )
      );

      const hasValidNextCursor =
        nextCursor !== null && nextCursor !== state.nextCursor;
      const hasProgress = newMentors.length > 0 && hasValidNextCursor;

      return {
        mentors:
          newMentors.length === 0
            ? state.mentors
            : [...state.mentors, ...newMentors],
        nextCursor,
        hasMore: hasProgress,
        mentorCount: state.mentorCount + newMentors.length,
        isNoResults: false,
        hasError: false,
      };
    }
    default:
      return state;
  }
}

export function toMentorPoolConditionKey(
  paramsString: string,
  hasConditions: boolean
): string {
  return hasConditions ? `filter_${paramsString}` : UNFILTERED_MENTOR_POOL_KEY;
}

export const mentorPoolReadManager = new AsyncReadManager<
  string,
  MentorPoolPageState
>();

export const mentorPoolStore = {
  buildInitialUnfilteredState(opts: {
    initialMentors: MentorType[];
    initialNextCursor?: string | null;
    initialMentorCount: number;
    hasInitialFilters: boolean;
    initialError?: boolean;
  }): MentorPoolPageState {
    const {
      initialMentors,
      initialMentorCount,
      hasInitialFilters,
      initialError,
      initialNextCursor = null,
    } = opts;
    const nextCursor = initialNextCursor || null;
    return {
      mentors: initialMentors,
      nextCursor,
      hasMore: initialMentors.length > 0 && nextCursor !== null,
      mentorCount: initialMentorCount,
      isNoResults: initialMentors.length === 0,
      hasError: hasInitialFilters ? false : (initialError ?? false),
    };
  },

  seedInitialUnfiltered(opts: {
    initialMentors: MentorType[];
    initialNextCursor?: string | null;
    initialMentorCount: number;
    hasInitialFilters: boolean;
    initialError?: boolean;
  }): MentorPoolPageState {
    const state = mentorPoolStore.buildInitialUnfilteredState(opts);
    if (
      !opts.initialError &&
      opts.initialMentors.length > 0 &&
      !mentorPoolReadManager.has(UNFILTERED_MENTOR_POOL_KEY)
    ) {
      mentorPoolReadManager.set(UNFILTERED_MENTOR_POOL_KEY, state);
    }
    return state;
  },

  async fetchPageOne(
    fetchPage: (limit: number, signal: AbortSignal) => Promise<MentorPage>,
    signal: AbortSignal,
    pageLimit: number = DEFAULT_MENTOR_PAGE_LIMIT
  ): Promise<MentorPoolPageState> {
    const page = await fetchPage(pageLimit, signal);
    return applyMentorPage(EMPTY_MENTOR_POOL_STATE, {
      type: 'replace',
      page,
    });
  },

  appendPage(
    key: string,
    fallbackBase: MentorPoolPageState,
    page: MentorPage
  ): MentorPoolPageState {
    let nextState = fallbackBase;
    mentorPoolReadManager.update(key, (current) => {
      nextState = applyMentorPage(current ?? fallbackBase, {
        type: 'append',
        page,
      });
      return nextState;
    });
    return nextState;
  },
};
