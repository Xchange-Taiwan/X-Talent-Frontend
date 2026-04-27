'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

import SearchBar from '@/components/ui/search-bar';

import {
  buildHref,
  getSearchPatternFromParams,
  setSearchPattern,
} from './searchParams';

export default function MentorPoolSearchBar() {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const currentQ = getSearchPatternFromParams(params);

  const handleSearch = async (query: string) => {
    const next = setSearchPattern(params, query);
    startTransition(() => {
      router.push(buildHref(next));
    });
  };

  return (
    <div className="absolute left-[calc(50%-169px)] top-[172px] h-20 w-[338px] md:left-[calc(50%-344px)] md:w-[688px] xl:left-[calc(50%-423px)] xl:w-[846px]">
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
