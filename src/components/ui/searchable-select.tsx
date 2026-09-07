'use client';

import { X } from 'lucide-react';
import * as React from 'react';

import { Command, CommandInput, CommandList } from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useKeyboardInset } from '@/hooks/useKeyboardInset';
import { useMediaQuery } from '@/hooks/useMediaQuery';

/**
 * Tailwind `sm` 以下視為手機版面。低於這個寬度時改用底部面板，不用浮動 popover。
 */
const MOBILE_QUERY = '(max-width: 639.98px)';

/**
 * 底部面板佔用 visual viewport 的比例。留一段背景讓使用者知道可以點外面關閉。
 */
const SHEET_VIEWPORT_RATIO = 0.85;

/**
 * SearchableSelect 元件屬性介面
 */
export interface SearchableSelectProps {
  /**
   * 選單是否展開。
   */
  open: boolean;

  /**
   * 展開狀態變更時的回呼函式。
   */
  onOpenChange: (open: boolean) => void;

  /**
   * 觸發選單的元件。會透過 Radix `asChild` 轉譯，必須是單一個可聚焦元素。
   */
  trigger: React.ReactNode;

  /**
   * 手機版底部面板的標題。桌機版 popover 不顯示標題。
   */
  title: string;

  /**
   * 搜尋框的提示文字。
   */
  searchPlaceholder: string;

  /**
   * 受控的搜尋字串。省略時改由 cmdk 自行過濾選項。
   */
  search?: string;

  /**
   * 搜尋字串變更時的回呼函式。搭配 `search` 一起使用。
   */
  onSearchChange?: (search: string) => void;

  /**
   * 選項清單內容，例如 `CommandEmpty` 與 `CommandGroup`。
   */
  children: React.ReactNode;
}

/**
 * SearchableSelect 可搜尋選擇器：
 * 桌機版轉譯為錨定在觸發元件上的 popover，手機版轉譯為從畫面底部升起的面板。
 *
 * 手機版之所以不用 popover，是因為浮動定位在行動裝置上有兩個結構性問題：
 * 一是碰撞偵測用 visual viewport 量測、但 `position: fixed` 相對 layout viewport
 * 排版，鍵盤升起後兩者對不上，選單會被算到鍵盤底下；二是浮動元素得在 scroll 事件裡
 * 用 JS 重新定位，追不上由 compositor 執行的捲動，看起來就是抖動。底部面板的位置
 * 由版面決定而非即時運算，兩個問題都不成立。
 *
 * 參考 Xchange-Taiwan/X-Talent-Tracker#659。
 */
export function SearchableSelect({
  open,
  onOpenChange,
  trigger,
  title,
  searchPlaceholder,
  search,
  onSearchChange,
  children,
}: SearchableSelectProps): React.ReactElement {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const { inset, viewportHeight } = useKeyboardInset(open && isMobile);

  const commandBody = (
    <Command
      shouldFilter={search === undefined}
      className="max-h-full min-h-0 flex-1"
    >
      <CommandInput
        placeholder={searchPlaceholder}
        value={search}
        onValueChange={onSearchChange}
      />
      {/* 搜尋框不在捲動容器內，所以清單再長也不會把它推出畫面 */}
      <CommandList className="max-h-full min-h-0 flex-1">
        {children}
      </CommandList>
    </Command>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent
          side="bottom"
          // 選項列在手機上要撐到可以用手指點：加高列高、放大字級，並讓左緣對齊
          // 標題與搜尋框。沿用 CommandDialog 既有的 cmdk 屬性選取器寫法。
          className="flex flex-col gap-0 overflow-hidden rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)] [&_[cmdk-group]]:p-0 [&_[cmdk-input-wrapper]]:px-4 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:rounded-none [&_[cmdk-item]]:px-4 [&_[cmdk-item]]:py-3 [&_[cmdk-item]]:text-base [&_[cmdk-item]_svg]:size-5"
          style={{
            // 把面板抬到鍵盤上方，高度固定在鍵盤剩下的可視空間的一個比例。
            // 用固定高度而不是 max-height，是為了讓搜尋結果多寡不會改變面板大小 ——
            // 否則使用者一邊打字，搜尋框就一邊往下移。
            bottom: inset,
            height: viewportHeight
              ? `${Math.round(viewportHeight * SHEET_VIEWPORT_RATIO)}px`
              : undefined,
          }}
          // 開啟時不自動聚焦搜尋框，否則鍵盤會立刻蓋掉半個畫面；
          // 使用者要搜尋時自己點搜尋框即可。
          onOpenAutoFocus={(event) => event.preventDefault()}
          // 這個面板只是一份選項清單，標題已經說完它是什麼，沒有額外描述可放。
          aria-describedby={undefined}
        >
          <div className="flex shrink-0 flex-col">
            <div
              className="mx-auto mt-3 h-1 w-10 rounded-full bg-background-border"
              aria-hidden="true"
            />
            <div className="flex items-center justify-between px-4 py-3">
              <SheetTitle className="text-base">{title}</SheetTitle>
              <SheetClose className="rounded-sm p-1 text-text-tertiary hover:text-text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                <X className="size-5" aria-hidden="true" />
                <span className="sr-only">關閉</span>
              </SheetClose>
            </div>
          </div>
          {commandBody}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        // 高度綁在 Radix 量到的可用空間上，空間不足時讓選單縮短而不是整個翻面。
        className="flex max-h-[min(20rem,calc(var(--radix-popover-content-available-height)-1rem))] w-[var(--radix-popover-trigger-width)] flex-col overflow-hidden p-0"
        collisionPadding={8}
      >
        {commandBody}
      </PopoverContent>
    </Popover>
  );
}
