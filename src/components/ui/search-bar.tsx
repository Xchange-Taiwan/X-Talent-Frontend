import SearchIcon from '@mui/icons-material/Search';
import { Loader2 } from 'lucide-react';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';

/**
 * SearchBar 元件屬性介面
 */
interface SearchBarProps {
  /**
   * 點擊搜尋按鈕或按下 Enter 鍵時觸發的搜尋非同步回呼函式。
   * @param query 使用者輸入並去除了首尾空格的搜尋關鍵字
   */
  onSearch: (query: string) => Promise<void>;

  /**
   * 預設（如桌機版螢幕寬度）顯示的搜尋輸入框提示預設文字。
   */
  placeholder?: string;

  /**
   * 手機版（窄螢幕）下顯示的自訂搜尋輸入框提示預設文字。若未傳入，將回退至 mobilePlaceholder / placeholder。
   */
  mobilePlaceholder?: string;

  /**
   * 平板版（中等螢幕）下顯示的自訂搜尋輸入框提示預設文字。若未傳入，將回退至 tabletPlaceholder / placeholder。
   */
  tabletPlaceholder?: string;

  /**
   * 搜尋框的預設初始輸入值，預設為空字串。
   */
  defaultValue?: string;
}

const DEFAULT_PLACEHOLDER = '搜尋有興趣職位、公司或是想精進的領域';

/**
 * SearchBar 搜尋欄元件：
 * 支援響應式設計（針對手機、平板、桌機寬度提供不同的 Placeholder）、防重覆提交的非同步 Loading 載入狀態，
 * 以及按下 Enter 鍵快速搜尋等功能，常置於首頁或導師列表頂部。
 */
const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  placeholder = DEFAULT_PLACEHOLDER,
  mobilePlaceholder,
  tabletPlaceholder,
  defaultValue = '',
}) => {
  const [query, setQuery] = useState(defaultValue);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await onSearch(query.trim());
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

  const inputClass =
    'h-5 min-w-0 flex-auto truncate rounded-sm text-base outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

  return (
    <div className="flex w-full max-w-[846px] items-center rounded-2xl border border-background-border bg-background-white px-3 py-1.5 md:px-6 md:py-4">
      <SearchIcon
        className="mr-2 size-6 shrink-0 text-text-tertiary"
        aria-hidden="true"
      />

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
        className="ml-2 size-10 shrink-0 cursor-pointer rounded-full border-none bg-brand-500 p-0 leading-5 md:size-auto md:rounded-[24px] md:px-6 md:py-2.5"
      >
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <>
            <SearchIcon className="size-5 md:hidden" aria-hidden="true" />
            <span className="hidden md:inline">搜尋</span>
          </>
        )}
      </Button>
    </div>
  );
};

export default SearchBar;
