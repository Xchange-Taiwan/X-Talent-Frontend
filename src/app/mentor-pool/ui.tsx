'use client';

import { AlertCircle, SearchXIcon, XIcon } from 'lucide-react';

import {
  FilterOptions,
  SelectFilters,
} from '@/components/filter/MentorFilterDropdown';
import MentorFilterDropdown from '@/components/filter/MentorFilterDropdown';
import { MentorCardList } from '@/components/mentor-pool/mentor-card-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import type { MentorType } from '@/types/mentor';

import PopularPositionChips from './PopularPositionChips';

interface Props {
  mentors: MentorType[];
  mentorCount: number;
  isLoading: boolean;
  isReplacing: boolean;
  listStatus: 'loading' | 'error' | 'empty' | 'success';
  selectedFilters: SelectFilters;
  filterOptions: FilterOptions;
  onFilterChange: (opts: SelectFilters) => void;
  onRemoveFilter: (key: string) => void;
  onClearAll: () => void;
  onScrollToBottom: () => Promise<void>;
  onRetry: () => void;
}

export default function MentorPoolUI({
  mentors,
  mentorCount,
  isLoading,
  isReplacing,
  listStatus,
  selectedFilters,
  filterOptions,
  onFilterChange,
  onRemoveFilter,
  onClearAll,
  onScrollToBottom,
  onRetry,
}: Props) {
  const hasMentors = listStatus === 'success';
  const showOverlay = hasMentors && isReplacing;
  const showFullSpinner = listStatus === 'loading';
  const showLoadMoreSpinner = hasMentors && isLoading && !isReplacing;
  const showNoResults = listStatus === 'empty';
  const showErrors = listStatus === 'error';
  return (
    <section className="mt-[80px] px-5 pb-10 md:px-10 xl:px-20">
      <div className="mx-auto w-full max-w-screen-xl">
        <PopularPositionChips />
        <div className="mb-5 mt-6 flex flex-col items-center gap-4 md:flex-row md:items-center md:justify-between md:gap-0">
          <div
            className={`text-base transition-opacity ${isReplacing ? 'opacity-50' : ''}`}
          >
            找到 {mentorCount} 位導師
          </div>
          <div className="grid w-full grid-cols-2 gap-3 md:flex md:w-fit">
            <div className="block md:hidden"></div>
            <MentorFilterDropdown
              onChange={onFilterChange}
              filterOptions={filterOptions}
              selectOptions={selectedFilters}
            />
          </div>
        </div>
        <div className="mb-5 flex flex-wrap gap-3">
          {Object.entries(selectedFilters).map(([key, filter]) => {
            // URL params persist the BE `subject_group` code; resolve back to
            // the localized `subject` label for display, falling back to the
            // code if the tag isn't in the current catalog.
            const label =
              filterOptions[key]?.options.find((o) => o.value === filter.value)
                ?.label ?? filter.value;
            return (
              <Badge
                key={key}
                variant={'filter'}
                className="text-sm font-medium leading-5"
              >
                <span>
                  {filter.name}: {label}
                </span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveFilter(key);
                  }}
                  aria-label={`移除「${filter.name}：${label}」篩選`}
                  className="inline-flex items-center rounded-sm bg-transparent p-0 hover:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <XIcon className="size-4" aria-hidden />
                </button>
              </Badge>
            );
          })}
        </div>
        {hasMentors && (
          <div className="relative mb-6">
            <MentorCardList
              mentors={mentors}
              onScrollToBottom={onScrollToBottom}
            />
            {showOverlay && (
              <div
                aria-busy="true"
                aria-live="polite"
                className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background-white/60"
              >
                <LoadingSpinner size="lg" />
              </div>
            )}
          </div>
        )}
        {showFullSpinner && (
          <div className="flex size-full items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        )}
        {showLoadMoreSpinner && (
          <div className="flex size-full items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        )}
        {showNoResults && (
          <div
            role="status"
            aria-live="polite"
            className="mt-6 flex w-full flex-col items-center justify-center gap-4 py-12 text-center"
          >
            <SearchXIcon
              className="size-12 text-text-tertiary md:size-16"
              aria-hidden
            />
            <p className="text-xl md:text-3xl">找不到符合的導師</p>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onClearAll}
            >
              清除所有條件
            </Button>
          </div>
        )}
        {showErrors && (
          <div
            role="status"
            aria-live="polite"
            className="mt-6 flex w-full flex-col items-center justify-center gap-4 py-12 text-center"
          >
            <AlertCircle
              className="size-12 text-text-tertiary md:size-16"
              aria-hidden
            />
            <p className="text-xl md:text-3xl">載入失敗，請重試</p>
            <Button type="button" variant="outline" size="lg" onClick={onRetry}>
              重新嘗試
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
