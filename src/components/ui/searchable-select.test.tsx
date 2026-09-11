import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Button } from '@/components/ui/button';
import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { SearchableSelect } from '@/components/ui/searchable-select';

const SCHOOLS = ['臺灣大學', '政治大學', '成功大學'];

/**
 * jsdom 的 matchMedia 由 src/test/setup.ts 補上，預設一律回報不成立（桌機分支）。
 * 這裡改成只讓傳進來的 query 成立，用來把元件推到手機分支。
 */
function stubViewport({ mobile }: { mobile: boolean }) {
  const listeners = new Set<() => void>();
  let matches = mobile;

  const list = {
    get matches() {
      return matches;
    },
    onchange: null,
    addEventListener(_type: string, listener: () => void) {
      listeners.add(listener);
    },
    removeEventListener(_type: string, listener: () => void) {
      listeners.delete(listener);
    },
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  };

  vi.stubGlobal(
    'matchMedia',
    (query: string) => ({ ...list, media: query }) as unknown as MediaQueryList
  );

  return {
    /** 模擬視窗跨過 sm 斷點，例如手機版在 hydration 之後才解析出真實寬度。 */
    setMobile(next: boolean): void {
      matches = next;
      act(() => {
        listeners.forEach((listener) => listener());
      });
    },
  };
}

const LAYOUT_HEIGHT = 800;

/**
 * 模擬軟鍵盤。layout viewport 固定為 800px，visual viewport 則縮掉鍵盤高度 ——
 * 這正是 Android Chrome 與 iOS Safari 在鍵盤升起時的行為。
 *
 * 這個 stub 會真的保存註冊進來的 listener，讓測試可以在渲染之後改變鍵盤高度並
 * 派送事件，藉此覆蓋 useKeyboardInset 的動態更新路徑。
 */
function stubKeyboard({ keyboardHeight }: { keyboardHeight: number }) {
  const listeners = new Set<() => void>();
  const viewport = {
    height: LAYOUT_HEIGHT - keyboardHeight,
    offsetTop: 0,
    addEventListener(_type: string, listener: () => void) {
      listeners.add(listener);
    },
    removeEventListener(_type: string, listener: () => void) {
      listeners.delete(listener);
    },
  };

  vi.stubGlobal('innerHeight', LAYOUT_HEIGHT);
  vi.stubGlobal('visualViewport', viewport);

  return {
    /**
     * 改變鍵盤高度並派送 visualViewport 事件，模擬鍵盤升起或收起。
     */
    setKeyboardHeight(next: number): void {
      viewport.height = LAYOUT_HEIGHT - next;
      act(() => {
        listeners.forEach((listener) => listener());
      });
    },
  };
}

/**
 * 面板高度 = 剩餘可視高度的 SHEET_VIEWPORT_RATIO（0.85）。
 */
const sheetHeightFor = (keyboardHeight: number): string =>
  `${Math.round((LAYOUT_HEIGHT - keyboardHeight) * 0.85)}px`;

function Harness({ open = true }: { open?: boolean }) {
  return (
    <SearchableSelect
      open={open}
      onOpenChange={() => {}}
      title="選擇學校"
      searchPlaceholder="搜尋學校..."
      trigger={<Button>請選擇學校</Button>}
    >
      <CommandEmpty>找不到相符的學校</CommandEmpty>
      <CommandGroup>
        {SCHOOLS.map((school) => (
          <CommandItem key={school} value={school}>
            {school}
          </CommandItem>
        ))}
      </CommandGroup>
    </SearchableSelect>
  );
}

function ControlledHarness({
  search,
  results,
  open = true,
}: {
  search: string;
  results: string[];
  open?: boolean;
}) {
  return (
    <SearchableSelect
      open={open}
      onOpenChange={() => {}}
      title="選擇學校"
      searchPlaceholder="搜尋學校..."
      search={search}
      onSearchChange={() => {}}
      trigger={<Button>請選擇學校</Button>}
    >
      <CommandEmpty>找不到相符的學校</CommandEmpty>
      <CommandGroup>
        {results.map((school) => (
          <CommandItem key={school} value={school}>
            {school}
          </CommandItem>
        ))}
      </CommandGroup>
    </SearchableSelect>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SearchableSelect', () => {
  // Radix 的 PopoverContent 本身也帶 role="dialog"，所以兩個分支要靠面板專屬的
  // 標題列來區分，不能只看 role。
  it('renders a bare popover, with no sheet chrome, above the mobile breakpoint', () => {
    stubViewport({ mobile: false });
    render(<Harness />);

    expect(screen.getByPlaceholderText('搜尋學校...')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: '選擇學校' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '關閉' })
    ).not.toBeInTheDocument();
  });

  it('renders a titled bottom sheet below the mobile breakpoint', () => {
    stubViewport({ mobile: true });
    render(<Harness />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '選擇學校' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '關閉' })).toBeInTheDocument();
  });

  it('does not focus the search box when the sheet opens, so the keyboard stays down', async () => {
    stubViewport({ mobile: true });
    render(<Harness />);

    const searchBox = screen.getByPlaceholderText('搜尋學校...');
    await waitFor(() => {
      expect(searchBox).not.toHaveFocus();
    });

    // 使用者主動點擊時才聚焦，鍵盤也才升起。
    await userEvent.click(searchBox);
    expect(searchBox).toHaveFocus();
  });

  it('lifts the sheet above the software keyboard and sizes it to what is left', async () => {
    stubViewport({ mobile: true });
    stubKeyboard({ keyboardHeight: 300 });
    render(<Harness />);

    const sheet = screen.getByRole('dialog');
    await waitFor(() => {
      // 抬高 300px，避開鍵盤
      expect(sheet).toHaveStyle({ bottom: '300px' });
      // 剩下 500px 可視高度，取 85% = 425px
      expect(sheet).toHaveStyle({ height: '425px' });
    });
  });

  it('follows the keyboard up and back down as it opens and closes', async () => {
    stubViewport({ mobile: true });
    const keyboard = stubKeyboard({ keyboardHeight: 0 });
    render(<Harness />);

    const sheet = screen.getByRole('dialog');
    await waitFor(() => {
      expect(sheet).toHaveStyle({ bottom: '0px' });
      expect(sheet).toHaveStyle({ height: sheetHeightFor(0) });
    });

    keyboard.setKeyboardHeight(300);
    await waitFor(() => {
      expect(sheet).toHaveStyle({ bottom: '300px' });
      expect(sheet).toHaveStyle({ height: sheetHeightFor(300) });
    });

    keyboard.setKeyboardHeight(0);
    await waitFor(() => {
      expect(sheet).toHaveStyle({ bottom: '0px' });
      expect(sheet).toHaveStyle({ height: sheetHeightFor(0) });
    });
  });

  it('keeps the sheet the same size while filtering, so the search box never moves', async () => {
    stubViewport({ mobile: true });
    stubKeyboard({ keyboardHeight: 300 });
    render(<Harness />);

    const sheet = screen.getByRole('dialog');
    await waitFor(() => {
      expect(sheet).toHaveStyle({ height: '425px' });
    });

    await userEvent.type(screen.getByPlaceholderText('搜尋學校...'), '政治');

    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(1);
    });
    // 過濾掉兩筆選項之後，面板高度與位置都沒有跟著變。
    expect(sheet).toHaveStyle({ height: '425px' });
    expect(sheet).toHaveStyle({ bottom: '300px' });
  });

  // 斷點要等 hydration 之後才解析得出來。如果 trigger 掛在哪個 Radix Trigger 底下
  // 是由斷點決定的，行動裝置每次載入都會把它卸載重掛一次，焦點與 form ref 都會斷。
  it('keeps the same trigger element when the breakpoint resolves after hydration', () => {
    const viewport = stubViewport({ mobile: false });
    render(<Harness open={false} />);

    const triggerBefore = screen.getByRole('button', { name: '請選擇學校' });

    viewport.setMobile(true);

    expect(screen.getByRole('button', { name: '請選擇學校' })).toBe(
      triggerBefore
    );
  });

  it('keeps the search box outside the scrolling list in both branches', () => {
    for (const mobile of [false, true]) {
      stubViewport({ mobile });
      const { unmount } = render(<Harness />);

      const searchBox = screen.getByPlaceholderText('搜尋學校...');
      const list = screen.getByRole('listbox');

      expect(list).not.toContainElement(searchBox);
      unmount();
    }
  });

  // cmdk 在 shouldFilter=false（受控 search）時不會自己重新排序或捲動清單，
  // 所以結果集換掉時若不主動把捲動拉回頂端，排序第一的項目可能被捲到畫面外，
  // 使用者只看得到清單尾端的內容。
  it('resets the list scroll position back to top when the filtered results change', () => {
    stubViewport({ mobile: false });
    const scrollTopWrites: number[] = [];
    // jsdom 把 scrollTop 定義在 Element.prototype 上，不是 HTMLElement.prototype，
    // 所以要往上找到實際擁有這個屬性的 prototype，restore 時才能真的還原、而不是
    // 讓 mock 永遠留在 HTMLElement.prototype 上污染後面的測試。
    const scrollTopOwner = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollTop'
    )
      ? HTMLElement.prototype
      : Element.prototype;
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      scrollTopOwner,
      'scrollTop'
    );

    Object.defineProperty(scrollTopOwner, 'scrollTop', {
      configurable: true,
      get() {
        return 0;
      },
      set(value: number) {
        scrollTopWrites.push(value);
      },
    });

    try {
      const { rerender } = render(
        <ControlledHarness
          search="台"
          results={['國立臺灣大學', '臺北醫學大學']}
        />
      );
      scrollTopWrites.length = 0; // 只看 search 變更之後觸發的那一次

      rerender(<ControlledHarness search="台大" results={['國立臺灣大學']} />);

      expect(scrollTopWrites).toContain(0);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(scrollTopOwner, 'scrollTop', originalDescriptor);
      } else {
        delete (scrollTopOwner as { scrollTop?: number }).scrollTop;
      }
    }
  });

  // 選單真正關閉（open 變 false）時要把 ref 清空，否則會一直抓著已經卸載的
  // 舊節點（memory leak）。重新開啟時要能正確抓到新掛載的節點，捲動重置邏輯
  // 才不會因為 ref 停留在舊的已卸載節點上而變成沒有效果的 no-op。
  it('re-acquires the list ref after closing and reopening, so scroll reset still works', () => {
    stubViewport({ mobile: false });
    const scrollTopOwner = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollTop'
    )
      ? HTMLElement.prototype
      : Element.prototype;
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      scrollTopOwner,
      'scrollTop'
    );
    const scrollTopWrites: number[] = [];

    Object.defineProperty(scrollTopOwner, 'scrollTop', {
      configurable: true,
      get() {
        return 0;
      },
      set(value: number) {
        scrollTopWrites.push(value);
      },
    });

    try {
      const { rerender } = render(
        <ControlledHarness
          open
          search="台"
          results={['國立臺灣大學', '臺北醫學大學']}
        />
      );
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      // 關閉：呼叫端（例如 SchoolComboboxField）在關閉時會把 search 重置成空字串，
      // CommandList 隨之卸載，listRef 應該被清空，不再指向舊節點。
      rerender(
        <ControlledHarness
          open={false}
          search=""
          results={['國立臺灣大學', '臺北醫學大學']}
        />
      );
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

      // 重新開啟（search 沿用關閉時已重置的空字串，跟真實使用情境一樣不會在
      // 這一步同時變更 search）：新節點掛載，ref 要能正確重新抓到它。
      rerender(
        <ControlledHarness
          open
          search=""
          results={['國立臺灣大學', '臺北醫學大學']}
        />
      );
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      // 使用者接著才開始打字：這是重新開啟之後、另外一次的 render，此時 ref
      // 早就掛好了，捲動重置的 effect 應該要能正常作用在目前的節點上。
      scrollTopWrites.length = 0;
      rerender(
        <ControlledHarness open search="台大" results={['國立臺灣大學']} />
      );

      expect(scrollTopWrites).toContain(0);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(scrollTopOwner, 'scrollTop', originalDescriptor);
      } else {
        delete (scrollTopOwner as { scrollTop?: number }).scrollTop;
      }
    }
  });

  // 桌機 Popover 與手機 Sheet 共用同一個 listRef。斷點跨越時（例如旋轉平板），
  // desktop 分支關閉、mobile 分支開啟幾乎同時發生，callback ref 必須忽略舊分支
  // 卸載時傳入的 null，否則捲動重置的功能會在切換斷點之後跟著失效。
  it('keeps scroll reset working after the breakpoint switches while the dropdown is open', () => {
    const viewport = stubViewport({ mobile: false });
    const scrollTopOwner = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollTop'
    )
      ? HTMLElement.prototype
      : Element.prototype;
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      scrollTopOwner,
      'scrollTop'
    );
    const scrollTopWrites: number[] = [];

    Object.defineProperty(scrollTopOwner, 'scrollTop', {
      configurable: true,
      get() {
        return 0;
      },
      set(value: number) {
        scrollTopWrites.push(value);
      },
    });

    try {
      const { rerender } = render(
        <ControlledHarness
          open
          search="台"
          results={['國立臺灣大學', '臺北醫學大學']}
        />
      );
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      // 跨過斷點：desktop 的 Popover 關閉、mobile 的 Sheet 開啟。search 維持不變，
      // 跟真實情境一樣不會在同一步驟裡又同時變更 search。
      viewport.setMobile(true);
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      // 斷點切換之後才打字（另外一次、分開的 render）：驗證 ref 仍然指向目前
      // 可見（mobile）的節點，而不是被切換前那個已經關閉的 desktop 節點卡住。
      scrollTopWrites.length = 0;
      rerender(
        <ControlledHarness open search="台大" results={['國立臺灣大學']} />
      );

      expect(scrollTopWrites).toContain(0);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(scrollTopOwner, 'scrollTop', originalDescriptor);
      } else {
        delete (scrollTopOwner as { scrollTop?: number }).scrollTop;
      }
    }
  });
});
