'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useTransition } from 'react';

import type {
  FilterOptions,
  SelectFilters,
} from '@/components/filter/MentorFilterDropdown';
import { useMentorPool } from '@/hooks/useMentorPool';
import useTagCatalog from '@/hooks/user/tags/useTagCatalog';
import { trackEvent } from '@/lib/analytics';
import {
  buildTagLabelMap,
  type TagCatalogGroupVO,
  type TagCatalogsByBucket,
} from '@/services/profile/tagCatalog';
import type { MentorType } from '@/services/search-mentor/mentors';

import { filterOptions } from './data';
import {
  buildHref,
  clearAllConditions,
  parseFiltersFromParams,
  removeFilterFromParams,
  setSelectedFiltersOnParams,
} from './searchParams';
import MentorPoolUI from './ui';

// BE search index stores filter targets (industry, skills, topics) as the
// `subject_group` code (e.g. "culture_education"), not the localized label —
// so the option's value must round-trip subject_group while `subject` stays
// as the display label.
function subjectsToOptions(
  items: ReadonlyArray<{ subject_group?: string; subject?: string | null }>
): { label: string; value: string }[] {
  return items
    .map((i) => ({ label: i.subject ?? '', value: i.subject_group ?? '' }))
    .filter((o) => o.value);
}

// Filter dropdowns show the BE-stored leaf labels, not catalog group labels —
// flatten each bucket's groups down to leaves so the user picks tags directly.
function flattenLeaves(
  groups: TagCatalogGroupVO[]
): { subject_group: string; subject: string }[] {
  return groups.flatMap((g) =>
    g.leaves.map((leaf) => ({
      subject_group: leaf.subject_group,
      subject: leaf.subject,
    }))
  );
}

interface Props {
  initialMentors: MentorType[];
  initialCursor: string;
  initialMentorCount: number;
  initialTagCatalog: TagCatalogsByBucket;
}

export default function MentorPoolContainer({
  initialMentors,
  initialCursor,
  initialMentorCount,
  initialTagCatalog,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const selectedFilters = parseFiltersFromParams(params);
  const tagCatalog = useTagCatalog('zh_TW', initialTagCatalog);

  const dynamicFilterOptions = useMemo<FilterOptions>(
    () => ({
      ...filterOptions,
      filter_skills: {
        ...filterOptions.filter_skills,
        options: subjectsToOptions(flattenLeaves(tagCatalog.have_skill)),
      },
      filter_topics: {
        ...filterOptions.filter_topics,
        options: subjectsToOptions(flattenLeaves(tagCatalog.have_topic)),
      },
      filter_industries: {
        ...filterOptions.filter_industries,
        options: subjectsToOptions(tagCatalog.industry),
      },
    }),
    [tagCatalog.have_skill, tagCatalog.have_topic, tagCatalog.industry]
  );

  const labelMap = useMemo(() => buildTagLabelMap(tagCatalog), [tagCatalog]);

  // All state management, pagination tracking, and error handling are delegated to custom hook
  const { mentors, mentorCount, isLoading, isNoResults, handleScrollToBottom } =
    useMentorPool({
      initialMentors,
      initialCursor,
      initialMentorCount,
      params,
      labelMap,
    });

  const handleFilterChange = useCallback(
    (filters: SelectFilters) => {
      const next = setSelectedFiltersOnParams(params, filters);
      startTransition(() => {
        router.push(buildHref(next));
      });
    },
    [params, router]
  );

  const handleRemoveFilter = useCallback(
    (key: string) => {
      const next = removeFilterFromParams(params, key);
      startTransition(() => {
        router.push(buildHref(next));
      });
    },
    [params, router]
  );

  const handleClearAll = useCallback(() => {
    trackEvent({ name: 'mentor_pool_clear_all_filters_click' });
    const next = clearAllConditions(params);
    startTransition(() => {
      router.push(buildHref(next));
    });
  }, [params, router]);

  return (
    <MentorPoolUI
      mentors={mentors}
      mentorCount={mentorCount}
      isLoading={isLoading}
      isReplacing={isPending}
      isNoResults={isNoResults}
      selectedFilters={selectedFilters}
      filterOptions={dynamicFilterOptions}
      onFilterChange={handleFilterChange}
      onRemoveFilter={handleRemoveFilter}
      onClearAll={handleClearAll}
      onScrollToBottom={handleScrollToBottom}
    />
  );
}
