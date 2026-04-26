import SearchIcon from '@mui/icons-material/Search';
import { Loader2 } from 'lucide-react';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';

interface SearchBarProps {
  onSearch: (query: string) => Promise<void>;
  placeholder?: string;
  mobilePlaceholder?: string;
  tabletPlaceholder?: string;
}

const DEFAULT_PLACEHOLDER = '搜尋有興趣職位、公司或是想精進的領域';

const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  placeholder = DEFAULT_PLACEHOLDER,
  mobilePlaceholder,
  tabletPlaceholder,
}) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim() || isLoading) return;
    setIsLoading(true);
    try {
      await onSearch(query);
    } catch (error) {
      console.error('Error during search:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  const sharedInputProps = {
    type: 'text' as const,
    value: query,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setQuery(e.target.value),
    onKeyDown: handleKeyDown,
    'aria-label': '搜尋',
  };

  const inputClass = 'h-5 min-w-0 flex-auto truncate text-base outline-none';

  return (
    <div className="flex w-full max-w-[846px] items-center rounded-2xl border border-[#E6E8EA] bg-background-white px-3 py-1.5 md:px-6 md:py-4">
      <SearchIcon className="mr-2 h-6 w-6 shrink-0 text-gray-500" />

      <input
        {...sharedInputProps}
        placeholder={mobilePlaceholder ?? placeholder}
        className={`${inputClass} md:hidden`}
      />
      <input
        {...sharedInputProps}
        placeholder={tabletPlaceholder ?? placeholder}
        className={`${inputClass} hidden md:inline-block xl:hidden`}
      />
      <input
        {...sharedInputProps}
        placeholder={placeholder}
        className={`${inputClass} hidden xl:inline-block`}
      />

      <Button
        onClick={handleSearch}
        disabled={isLoading}
        aria-label="搜尋"
        className="ml-2 h-10 w-10 shrink-0 cursor-pointer rounded-full border-none bg-primary p-0 leading-5 md:h-auto md:w-auto md:rounded-[24px] md:px-6 md:py-2.5"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <SearchIcon className="h-5 w-5 md:hidden" />
            <span className="hidden md:inline">搜尋</span>
          </>
        )}
      </Button>
    </div>
  );
};

export default SearchBar;
