import { FilterOptions } from '@/components/filter/MentorFilterDropdown';

// Option lists are populated at runtime in container.tsx
// (useInterests for skills/topics, useIndustries for industries).
// We keep the keys + display name here so server-side searchParams
// parsing has a stable shape without touching the client caches.
export const filterOptions: FilterOptions = {
  filter_skills: {
    name: '技能',
    options: [],
  },
  filter_topics: {
    name: '主題',
    options: [],
  },
  filter_industries: {
    name: '產業',
    options: [],
  },
};

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
