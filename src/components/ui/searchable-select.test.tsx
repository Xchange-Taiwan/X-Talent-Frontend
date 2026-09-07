import { render, screen, waitFor } from '@testing-library/react';
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
function stubViewport({ mobile }: { mobile: boolean }): void {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: mobile,
        media: query,
        onchange: null,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList
  );
}

/**
 * 模擬軟鍵盤：layout viewport 維持 800px，visual viewport 縮到 500px，
 * 也就是底部有 300px 被鍵盤蓋住。
 */
function stubKeyboard({ keyboardHeight }: { keyboardHeight: number }): void {
  const layoutHeight = 800;
  vi.stubGlobal('innerHeight', layoutHeight);
  vi.stubGlobal('visualViewport', {
    height: layoutHeight - keyboardHeight,
    offsetTop: 0,
    addEventListener() {},
    removeEventListener() {},
  });
}

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
});
