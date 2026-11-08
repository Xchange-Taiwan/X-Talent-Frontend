'use client';

import SearchBar from '@/components/ui/search-bar';
import { useMentorPoolFilters } from '@/hooks/useMentorPoolFilters';

export default function MentorPoolSearchBar() {
  const { searchQuery: currentQ, setSearchQuery } = useMentorPoolFilters();

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
  };

  return (
    <div className="absolute top-[172px] left-[calc(50%-169px)] h-20 w-[338px] md:left-[calc(50%-344px)] md:w-[688px] xl:left-[calc(50%-423px)] xl:w-[846px]">
      <SearchBar
        key={currentQ}
        defaultValue={currentQ}
        onSearch={handleSearch}
        mobilePlaceholder="搜尋職位、公司或領域"
        tabletPlaceholder="搜尋職位、公司或想精進的領域"
      />
    </div>
  );
}
