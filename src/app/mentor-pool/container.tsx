'use client';

import { useMemo } from 'react';

import type { FilterOptions } from '@/components/filter/MentorFilterDropdown';
import { useMentorPool } from '@/hooks/useMentorPool';
import { useMentorPoolFilters } from '@/hooks/useMentorPoolFilters';
import useTagCatalog from '@/hooks/user/tags/useTagCatalog';
import { buildTagLabelMap } from '@/lib/profile/tagLabelMap';
import type { MentorType } from '@/types/mentor';
import type {
  TagCatalogGroupVO,
  TagCatalogsByBucket,
} from '@/types/tagCatalog';

import { filterOptions } from './data';
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
    (g.leaves ?? []).map((leaf) => ({
      subject_group: leaf.subject_group,
      subject: leaf.subject,
    }))
  );
}

interface Props {
  initialMentors: MentorType[];
  initialMentorCount: number;
  initialTagCatalog: TagCatalogsByBucket;
  initialError?: boolean;
}

export default function MentorPoolContainer({
  initialMentors,
  initialMentorCount,
  initialTagCatalog,
  initialError,
}: Props) {
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

  const {
    params,
    selectedFilters,
    activeFilterBadges,
    isReplacing,
    setFilters,
    removeFilter,
    clearAll,
  } = useMentorPoolFilters({ filterOptions: dynamicFilterOptions });

  const labelMap = useMemo(() => buildTagLabelMap(tagCatalog), [tagCatalog]);

  // All state management, pagination tracking, and error handling are delegated to custom hook
  const {
    mentors,
    mentorCount,
    isLoading,
    listStatus,
    handleScrollToBottom,
    handleRetry,
  } = useMentorPool({
    initialMentors,
    initialMentorCount,
    params,
    labelMap,
    initialError,
  });

  return (
    <MentorPoolUI
      mentors={mentors}
      mentorCount={mentorCount}
      isLoading={isLoading}
      isReplacing={isReplacing}
      listStatus={listStatus}
      selectedFilters={selectedFilters}
      activeFilterBadges={activeFilterBadges}
      filterOptions={dynamicFilterOptions}
      onFilterChange={setFilters}
      onRemoveFilter={removeFilter}
      onClearAll={clearAll}
      onScrollToBottom={handleScrollToBottom}
      onRetry={handleRetry}
    />
  );
}
