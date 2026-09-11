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
} from '@/components/ui/sheet';
import { useKeyboardInset } from '@/hooks/useKeyboardInset';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { FOCUS_RING_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';

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

  const listRef = React.useRef<HTMLDivElement | null>(null);

  // 桌機 Popover 與手機 Sheet 共用同一個 commandBody（因此共用這個 ref）。斷點跨越
  // 的瞬間，Radix Presence 會讓正在退場動畫的舊分支節點與剛掛載的新分支節點短暫並存，
  // 舊節點卸載時 React 會用這個 ref 呼叫一次 `ref(null)`——直接指派會把 ref 覆寫成
  // null，即使當下真正可見、互動中的是另一個節點。改用 callback ref 忽略 null，讓
  // ref 永遠指向「最後一個真正掛上去」的節點，不被退場中的舊節點覆寫掉。
  // 故意不在選單關閉時把 listRef 清成 null：Radix 的退場動畫可以被中途打斷
  // （使用者在動畫結束前重新開啟），這種情況下 DOM 節點會被沿用、React 不會
  // 再呼叫一次 setListRef，若曾經手動清空就會永久失去這個節點的參考。留著
  // 已卸載的舊節點只是暫時多撐一輪，下次真的有新節點掛上來就會被取代掉。
  const setListRef = React.useCallback((node: HTMLDivElement | null) => {
    if (node) {
      listRef.current = node;
    }
  }, []);

  // cmdk 只在 shouldFilter 開啟時才會自己重新排序/捲動；這裡用 search 自行排序
  // (shouldFilter=false)，所以每次結果集換掉時要自己把捲動位置拉回頂端，
  // 否則清單捲軸會停在輸入新字前的位置，導致排序第一的項目被捲到畫面外。
  React.useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [search]);

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
      <CommandList ref={setListRef} className="max-h-full min-h-0 flex-1">
        {children}
      </CommandList>
    </Command>
  );

  return (
    <>
      {/*
        Popover 這一層永遠掛著，手機版只是不讓它展開。斷點要等 hydration 之後才
        解析得出來，如果讓它決定 trigger 掛在 PopoverTrigger 還是 SheetTrigger 底下，
        行動裝置每次載入都會把 trigger 卸載重掛一次，連帶斷掉焦點與 form 的 ref。
      */}
      <Popover open={open && !isMobile} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          // 高度綁在 Radix 量到的可用空間上，空間不足時讓選單縮短而不是整個翻面。
          className="flex max-h-[min(20rem,calc(var(--radix-popover-content-available-height)-1rem))] w-[var(--radix-popover-trigger-width)] flex-col overflow-hidden p-0"
          collisionPadding={8}
        >
          {commandBody}
        </PopoverContent>
      </Popover>

      {isMobile && (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent
            side="bottom"
            // 選項列在手機上要撐到可以用手指點：加高列高、放大字級，並讓左緣對齊
            // 標題與搜尋框。沿用 CommandDialog 既有的 cmdk 屬性選取器寫法。
            className="flex flex-col gap-0 overflow-hidden rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)] [&_[cmdk-group]]:p-0 [&_[cmdk-input-wrapper]]:px-4 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:rounded-none [&_[cmdk-item]]:px-4 [&_[cmdk-item]]:py-3 [&_[cmdk-item]]:text-base [&_[cmdk-item]_svg]:size-5"
            // 這兩個值是量到的鍵盤高度即時算出來的，沒有對應的靜態 Tailwind 類別。
            // 同 NotificationBell 的捲軸拇指，屬於動態數值才走 inline style 的既有做法。
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
                className="bg-background-border mx-auto mt-3 h-1 w-10 rounded-full"
                aria-hidden="true"
              />
              <div className="flex items-center justify-between px-4 py-3">
                <SheetTitle className="text-base">{title}</SheetTitle>
                <SheetClose
                  className={cn(
                    'text-text-tertiary hover:text-text-primary rounded-sm p-1',
                    FOCUS_RING_CLASSES
                  )}
                >
                  <X className="size-5" aria-hidden="true" />
                  <span className="sr-only">關閉</span>
                </SheetClose>
              </div>
            </div>
            {commandBody}
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
