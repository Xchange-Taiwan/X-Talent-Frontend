import SearchIcon from '@mui/icons-material/Search';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button'; // 匯入 Button 元件
interface SearchBarProps {
  onSearch: (query: string) => Promise<void>;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
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
    <div className="flex w-full items-center justify-center py-4">
      <div className="relative flex w-full min-w-[200px] max-w-[400px] items-center">
        <SearchIcon className="absolute left-[3%] top-1/2 -translate-y-1/2 transform text-gray-500" />

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search for job position..."
          className="box-border flex-1 rounded-[18px] border-none py-4 pl-[12%] pr-4 focus:ring-0"
        />

        <Button
          onClick={handleSearch}
          className="absolute right-[3%] top-1/2 -translate-y-1/2 transform cursor-pointer rounded-[24px] border-none bg-primary px-4 py-3 text-xs hover:bg-primary"
        >
          {isLoading ? '...' : 'Search'}
        </Button>
      </div>
    </div>
  );
};

export default SearchBar;
