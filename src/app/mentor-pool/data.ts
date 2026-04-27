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
export const POPULAR_POSITIONS: ReadonlyArray<string> = [
  'Frontend Developer',
  'Backend Developer',
  'Software Engineer',
  'Product Manager',
  'UI/UX Designer',
  'Data Engineer',
  'DevOps Engineer',
  'Mobile Developer',
];
