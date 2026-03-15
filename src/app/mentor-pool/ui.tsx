'use client';

import { XIcon } from 'lucide-react';

import {
  FilterOptions,
  SelectFilters,
} from '@/components/filter/MentorFilterDropdown';
import MentorFilterDropdown from '@/components/filter/MentorFilterDropdown';
import { MentorCardList } from '@/components/mentor-pool/mentor-card-list';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import SearchBar from '@/components/ui/search-bar';
import { MentorType } from '@/services/search-mentor/mentors';

interface Props {
  mentors: MentorType[];
  mentorCount: number;
  isLoading: boolean;
  isNoResults: boolean;
  selectedFilters: SelectFilters;
  filterOptions: FilterOptions;
  onSearch: (q: string) => Promise<void>;
  onFilterChange: (opts: SelectFilters) => void;
  onRemoveFilter: (key: string) => void;
  onScrollToBottom: () => Promise<void>;
}

export default function MentorPoolUI({
  mentors,
  mentorCount,
  isLoading,
  isNoResults,
  selectedFilters,
  filterOptions,
  onSearch,
  onFilterChange,
  onRemoveFilter,
  onScrollToBottom,
}: Props) {
  return (
    <div className="relative">
      <section className="flex h-[202px] w-full items-center justify-center bg-[linear-gradient(to_right,#FFFFEF_0%,#FFF6FF_19%,#F7F2FB_42%,#E4FFFF_100%)] text-3xl font-semibold xl:rounded-br-[120px]">
        和 Mentors 一起提升你的職涯經驗吧！
      </section>
      <div className="absolute left-[calc(50%-169px)] top-[172px] h-20 w-[338px] md:left-[calc(50%-344px)] md:w-[688px] xl:left-[calc(50%-423px)] xl:w-[846px]">
        <SearchBar onSearch={onSearch} />
      </div>
      <section className="mt-[132px] px-5 pb-10 md:px-10 xl:px-20">
        <div className="mx-auto w-full max-w-[1280px] ">
          <div className="item-center mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-0">
            <div className="text-base">{mentorCount} mentors were found</div>
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
            {Object.entries(selectedFilters).map(([key, filter]) => (
              <Badge
                key={key}
                variant={'filter'}
                className="text-sm font-medium leading-5"
              >
                <span>
                  {filter.name}: {filter.value}
                </span>
                <XIcon
                  className="h-4 w-4 cursor-pointer"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveFilter(key);
                  }}
                />
              </Badge>
            ))}
          </div>
          {mentors.length === 0 && !isLoading ? (
            <div className="mt-6 flex h-full w-full items-center justify-center">
              {isNoResults && (
                <span className="text-3xl">No results found</span>
              )}
            </div>
          ) : (
            <div className="mb-6">
              <MentorCardList
                mentors={mentors}
                onScrollToBottom={onScrollToBottom}
              />
            </div>
          )}
          {isLoading && (
            <div className="flex h-full w-full items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
