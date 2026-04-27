'use client';

import SearchBar from '@/components/ui/search-bar';

import { useMentorPoolState } from './MentorPoolStateProvider';

export default function MentorPoolSearchBar() {
  const { setSearch } = useMentorPoolState();

  const handleSearch = async (query: string) => {
    setSearch(query);
  };

  return (
    <div className="absolute left-[calc(50%-169px)] top-[172px] h-20 w-[338px] md:left-[calc(50%-344px)] md:w-[688px] xl:left-[calc(50%-423px)] xl:w-[846px]">
      <SearchBar
        onSearch={handleSearch}
        mobilePlaceholder="搜尋職位、公司或領域"
        tabletPlaceholder="搜尋職位、公司或想精進的領域"
      />
    </div>
  );
}
