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
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        padding: '16px 0',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          maxWidth: '400px', // 最大寬度
          minWidth: '200px', // 最小寬度
          width: '100%', // 預設寬度為 20%
        }}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search for job position..."
          style={{
            padding: '18px 16px',
            flex: 1,
            border: '1px solid #ccc',
            borderRadius: '18px',
            boxSizing: 'border-box',
          }}
        />
        <Button
          onClick={handleSearch}
          className="bg-primary hover:bg-primary"
          style={{
            position: 'absolute',
            right: '3%', // 與搜尋框右側保持距離
            top: '50%',
            transform: 'translateY(-50%)',
            padding: '18px', // 減少按鈕內邊距
            fontSize: '12px', // 縮小字體大小
            borderRadius: '24px', // 減少圓角
            cursor: 'pointer', // 確保顯示為可點擊的指標
          }}
        >
          {isLoading ? '...' : 'Search'}
        </Button>
      </div>
    </div>
  );
};

export default SearchBar;
