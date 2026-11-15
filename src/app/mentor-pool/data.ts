import {
  DEFAULT_MENTOR_FILTER_OPTIONS,
  type FilterOptions,
} from '@/lib/mentor/mentorPoolQuery';

export const filterOptions: FilterOptions = DEFAULT_MENTOR_FILTER_OPTIONS;

// Hardcoded fallback until the backend exposes a popular-position ranking
// endpoint. Replacing this with a fetch is a one-line swap in container.tsx.
// Labels follow the zh_TW INTERESTED_POSITION naming used in onboarding.
export const POPULAR_POSITIONS: ReadonlyArray<string> = [
  '前端工程師',
  '後端工程師',
  '全端工程師',
  '產品經理',
  'UIUX 設計師',
  '資料工程師',
  'AI 工程師',
  'iOS 工程師',
];
