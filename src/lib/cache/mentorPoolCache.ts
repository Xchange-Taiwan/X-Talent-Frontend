import { AsyncReadManager } from '@/lib/asyncReadManager';
import { createKeyedCache } from '@/lib/createKeyedCache';
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
  action: MentorPageAction,
  _pageLimit: number = DEFAULT_MENTOR_PAGE_LIMIT
): MentorPoolPageState {
  void _pageLimit;
  switch (action.type) {
    case 'replace': {
      const { page, totalCount } = action;
      return {
        mentors: page.mentors,
        nextCursor: page.nextCursor,
        hasMore: page.nextCursor !== null,
        mentorCount: totalCount ?? page.mentors.length,
        isNoResults: page.mentors.length === 0,
        hasError: false,
      };
    }
    case 'append': {
      const { page } = action;

      const newMentors = page.mentors.filter(
        (newMentor) =>
          !state.mentors.some(
            (prevMentor) => prevMentor.user_id === newMentor.user_id
          )
      );

      return {
        mentors: [...state.mentors, ...newMentors],
        nextCursor: page.nextCursor,
        hasMore: page.nextCursor !== null,
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

const mentorPoolCache = createKeyedCache<string, MentorPoolPageState>();
export const mentorPoolReadManager = new AsyncReadManager<
  string,
  MentorPoolPageState
>(mentorPoolCache);

export const mentorPoolStore = {
  buildInitialUnfilteredState(opts: {
    initialMentors: MentorType[];
    initialNextCursor?: string | null;
    initialMentorCount: number;
    hasInitialFilters: boolean;
    initialError?: boolean;
    pageLimit?: number;
  }): MentorPoolPageState {
    const {
      initialMentors,
      initialMentorCount,
      hasInitialFilters,
      initialError,
      initialNextCursor = null,
    } = opts;
    return {
      mentors: initialMentors,
      nextCursor: initialNextCursor,
      hasMore: initialNextCursor !== null,
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
    return applyMentorPage(
      EMPTY_MENTOR_POOL_STATE,
      {
        type: 'replace',
        page,
      },
      pageLimit
    );
  },

  appendPage(
    key: string,
    fallbackBase: MentorPoolPageState,
    page: MentorPage,
    pageLimit: number = DEFAULT_MENTOR_PAGE_LIMIT
  ): MentorPoolPageState {
    let nextState = fallbackBase;
    mentorPoolReadManager.update(key, (current) => {
      nextState = applyMentorPage(
        current ?? fallbackBase,
        {
          type: 'append',
          page,
        },
        pageLimit
      );
      return nextState;
    });
    return nextState;
  },
};
