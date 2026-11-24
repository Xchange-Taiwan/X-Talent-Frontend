'use client';

import { useMemo } from 'react';

import { useMentorPool } from '@/hooks/useMentorPool';
import { useMentorPoolFilters } from '@/hooks/useMentorPoolFilters';
import useTagCatalog from '@/hooks/user/tags/useTagCatalog';
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

  const {
    query,
    queryKey,
    filterOptions,
    selectedFilters,
    activeFilterBadges,
    prioritizedCardTagCodes,
    isReplacing,
    setFilters,
    removeFilter,
    clearAll,
  } = useMentorPoolFilters({ tagCatalog });

  const labelMap = useMemo(() => buildTagLabelMap(tagCatalog), [tagCatalog]);

  // Shares the single-pass canonical discovery query directly without re-parsing URLSearchParams
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
    query,
    queryKey,
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
      prioritizedCardTagCodes={prioritizedCardTagCodes}
      filterOptions={filterOptions}
      labelMap={labelMap}
      onFilterChange={setFilters}
      onRemoveFilter={removeFilter}
      onClearAll={clearAll}
      onScrollToBottom={handleScrollToBottom}
      onRetry={handleRetry}
    />
  );
}
