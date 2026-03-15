import SearchIcon from '@mui/icons-material/Search';
import { Loader2 } from 'lucide-react';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
interface SearchBarProps {
  onSearch: (query: string) => Promise<void>;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch }) => {
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

  return (
    <>
      <div className="flex w-full max-w-[846px] items-center rounded-2xl border border-[#E6E8EA] bg-background-white px-3 py-1.5 md:px-6 md:py-4">
        <SearchIcon className="mr-2 h-6 w-6 text-gray-500" />

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="搜尋有興趣職位、公司或是想精進的領域"
          className="h-5 min-w-[200px] flex-auto text-base outline-none"
        />

        <Button
          onClick={handleSearch}
          disabled={isLoading}
          className="ml-2 cursor-pointer rounded-[24px] border-none bg-primary leading-5 md:px-6 md:py-2.5"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : '搜尋'}
        </Button>
      </div>
    </>
  );
};

export default SearchBar;
