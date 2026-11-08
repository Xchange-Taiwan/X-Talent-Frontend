import { AsyncReadManager } from '@/lib/asyncReadManager';
import { createKeyedCache } from '@/lib/createKeyedCache';
import type { MentorType } from '@/types/mentor';

export const DEFAULT_MENTOR_PAGE_LIMIT = 9;
export const UNFILTERED_MENTOR_POOL_KEY = '__unfiltered__';

export interface MentorPoolPageState {
  mentors: MentorType[];
  cursor: string | undefined;
  hasMore: boolean;
  mentorCount: number;
  isNoResults: boolean;
  hasError: boolean;
}

export const EMPTY_MENTOR_POOL_STATE: MentorPoolPageState = {
  mentors: [],
  cursor: undefined,
  hasMore: true,
  mentorCount: 0,
  isNoResults: false,
  hasError: false,
};

export type MentorPageAction =
  | { type: 'replace'; page: MentorType[]; totalCount?: number }
  | { type: 'append'; page: MentorType[] };

export function applyMentorPage(
  state: MentorPoolPageState,
  action: MentorPageAction,
  pageLimit: number = DEFAULT_MENTOR_PAGE_LIMIT
): MentorPoolPageState {
  switch (action.type) {
    case 'replace': {
      const { page, totalCount } = action;
      const nextCursor = page.at(-1)?.updated_at?.toString();
      return {
        mentors: page,
        cursor: nextCursor,
        hasMore: Boolean(nextCursor) && page.length === pageLimit,
        mentorCount: totalCount ?? page.length,
        isNoResults: page.length === 0,
        hasError: false,
      };
    }
    case 'append': {
      const { page } = action;
      if (page.length === 0) {
        return {
          ...state,
          hasMore: false,
        };
      }

      const newMentors = page.filter(
        (newMentor) =>
          !state.mentors.some(
            (prevMentor) => prevMentor.user_id === newMentor.user_id
          )
      );

      if (newMentors.length === 0) {
        return {
          ...state,
          hasMore: false,
        };
      }

      const nextCursor = page.at(-1)?.updated_at?.toString();

      return {
        mentors: [...state.mentors, ...newMentors],
        cursor: nextCursor,
        hasMore:
          Boolean(nextCursor) &&
          nextCursor !== state.cursor &&
          page.length === pageLimit,
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
      pageLimit = DEFAULT_MENTOR_PAGE_LIMIT,
    } = opts;
    const nextCursor = initialMentors.at(-1)?.updated_at?.toString();
    return {
      mentors: initialMentors,
      cursor: nextCursor,
      hasMore: Boolean(nextCursor) && initialMentors.length === pageLimit,
      mentorCount: initialMentorCount,
      isNoResults: initialMentors.length === 0,
      hasError: hasInitialFilters ? false : (initialError ?? false),
    };
  },

  seedInitialUnfiltered(opts: {
    initialMentors: MentorType[];
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
    fetchPage: (limit: number, signal: AbortSignal) => Promise<MentorType[]>,
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
    page: MentorType[],
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
