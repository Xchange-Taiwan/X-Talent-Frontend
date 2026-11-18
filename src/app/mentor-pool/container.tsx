'use client';

import { useMemo } from 'react';

import { useMentorPool } from '@/hooks/useMentorPool';
import { useMentorPoolFilters } from '@/hooks/useMentorPoolFilters';
import useTagCatalog from '@/hooks/user/tags/useTagCatalog';
import {
  buildMentorFilterOptions,
  DEFAULT_MENTOR_FILTER_OPTIONS,
  type FilterOptions,
} from '@/lib/mentor/mentorPoolQuery';
import { buildTagLabelMap } from '@/lib/profile/tagLabelMap';
import type { MentorType } from '@/types/mentor';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';

import MentorPoolUI from './ui';

interface Props {
  initialMentors: MentorType[];
  initialNextCursor?: string | null;
  initialMentorCount: number;
  initialTagCatalog: TagCatalogsByBucket;
  initialError?: boolean;
}

export default function MentorPoolContainer({
  initialMentors,
  initialNextCursor,
  initialMentorCount,
  initialTagCatalog,
  initialError,
}: Props) {
  const tagCatalog = useTagCatalog('zh_TW', initialTagCatalog);

  const dynamicFilterOptions = useMemo<FilterOptions>(
    () =>
      buildMentorFilterOptions(
        {
          have_skill: tagCatalog.have_skill,
          have_topic: tagCatalog.have_topic,
          industry: tagCatalog.industry,
        },
        DEFAULT_MENTOR_FILTER_OPTIONS
      ),
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
    initialNextCursor,
    initialMentorCount,
    params,
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
      labelMap={labelMap}
      onFilterChange={setFilters}
      onRemoveFilter={removeFilter}
      onClearAll={clearAll}
      onScrollToBottom={handleScrollToBottom}
      onRetry={handleRetry}
    />
  );
}
