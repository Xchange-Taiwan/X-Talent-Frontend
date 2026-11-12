import { expect, type Page, test } from '@playwright/test';

import { captureEvidence } from '../../helpers/evidence';

interface NormalizedGaEvent {
  name: string;
  params: Record<string, unknown>;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function getDataLayerEvents(page: Page): Promise<NormalizedGaEvent[]> {
  const rawEntries = await page.evaluate(() => {
    function isArrayLikeEntry(val: unknown): val is ArrayLike<unknown> {
      return (
        typeof val === 'object' &&
        val !== null &&
        '0' in val &&
        'length' in val &&
        typeof val.length === 'number'
      );
    }

    const layer = window.dataLayer ?? [];
    return layer.map((entry) => {
      if (Array.isArray(entry)) {
        return entry;
      }
      if (isArrayLikeEntry(entry)) {
        return Array.from(entry);
      }
      return entry;
    });
  });

  const normalized: NormalizedGaEvent[] = [];
  for (const item of rawEntries) {
    if (
      Array.isArray(item) &&
      item[0] === 'event' &&
      typeof item[1] === 'string'
    ) {
      normalized.push({
        name: item[1],
        params: isPlainRecord(item[2]) ? item[2] : {},
      });
    } else if (isPlainRecord(item) && typeof item.event === 'string') {
      const { event, ...rest } = item;
      normalized.push({
        name: event,
        params: rest,
      });
    }
  }
  return normalized;
}

test.describe('GA4 基礎事件追蹤：初次進站 page_view、SPA 換頁、scroll_depth 與個資防護 (#865)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('https://www.googletagmanager.com/**', (route) =>
      route.fulfill({
        status: 204,
        contentType: 'application/javascript',
        body: '',
      })
    );
    await page.route('https://www.clarity.ms/**', (route) =>
      route.fulfill({
        status: 204,
        contentType: 'application/javascript',
        body: '',
      })
    );
  });

  test('驗證初次進站與 SPA 換頁 page_view、分段滾動單一 scroll_depth (percent_scrolled) 與導覽點擊埋點', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('homepage-cta-hero')).toBeVisible();

    // 1. 初次進站：window.dataLayer 收到單筆首頁 page_view
    await expect
      .poll(async () => {
        const events = await getDataLayerEvents(page);
        return events.filter(
          (e) => e.name === 'page_view' && e.params.page_path === '/'
        ).length;
      })
      .toBe(1);

    // 2. 滾動深度：先滾動至約 35% 可捲動高度，觸發 scroll_depth (percent_scrolled: 25)
    await page.evaluate(() => {
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, Math.ceil(scrollable * 0.35));
    });

    await expect
      .poll(async () => {
        const events = await getDataLayerEvents(page);
        return events
          .filter((e) => e.name === 'scroll_depth')
          .map((e) => e.params.percent_scrolled);
      })
      .toEqual([25]);

    // 快速滾動跨越至約 80% 可捲動高度：依序補齊 50 與 75 門檻（單一事件名稱 scroll_depth）
    await page.evaluate(() => {
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, Math.ceil(scrollable * 0.8));
    });

    await expect
      .poll(async () => {
        const events = await getDataLayerEvents(page);
        return events
          .filter((e) => e.name === 'scroll_depth')
          .map((e) => e.params.percent_scrolled);
      })
      .toEqual([25, 50, 75]);

    // 往回微幅滾動不會重複送出已達標的 scroll_depth（等待兩個動畫幀確保節流回呼已執行）
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const scrollable =
            document.documentElement.scrollHeight - window.innerHeight;
          window.scrollTo(0, Math.ceil(scrollable * 0.28));
          window.requestAnimationFrame(() =>
            window.requestAnimationFrame(() => resolve())
          );
        })
    );

    const scrollEventsAfterRescroll = (await getDataLayerEvents(page)).filter(
      (e) => e.name === 'scroll_depth'
    );
    expect(scrollEventsAfterRescroll).toHaveLength(3);

    // 3. 點擊 Header 導覽連結進行 SPA 換頁至 /about：同時驗證低侵入式按鈕埋點與 SPA page_view
    const aboutNavLink = page
      .getByRole('link', { name: '關於 X-Talent' })
      .first();
    await expect(aboutNavLink).toBeVisible();
    await aboutNavLink.click();

    await expect(page).toHaveURL('/about');
    await expect(
      page.getByRole('heading', { level: 1, name: /關於\s*X-Talent/ })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'X-Talent 的核心價值' })
    ).toBeVisible();

    await expect
      .poll(async () => {
        const events = await getDataLayerEvents(page);
        return {
          aboutPageViews: events.filter(
            (e) => e.name === 'page_view' && e.params.page_path === '/about'
          ).length,
          aboutButtonClicks: events.filter(
            (e) =>
              e.name === 'button_click' &&
              e.params.button_id === 'header_nav_about'
          ).length,
        };
      })
      .toEqual({
        aboutPageViews: 1,
        aboutButtonClicks: 1,
      });

    // 4. 個資安全檢查：確認整份 dataLayer 不含任何 Email、Token 或密碼欄位
    const serializedDataLayer = JSON.stringify(await getDataLayerEvents(page));
    expect(serializedDataLayer).not.toMatch(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
    );
    expect(serializedDataLayer).not.toContain('access_token');
    expect(serializedDataLayer).not.toContain('password');

    await captureEvidence(page, 'ga4-analytics-verified');
  });

  test('URL 帶有敏感參數或巢狀 callbackUrl 時自動過濾，不寫入 window.dataLayer', async ({
    page,
  }) => {
    await page.goto(
      '/about?token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.secretSignature&email=private.user@example.com&callbackUrl=%2Fauth%2Fverify%3Ftoken%3DnestedSecret%26source%3Demail&utm_source=digest'
    );

    await expect(
      page.getByRole('heading', { level: 1, name: /關於\s*X-Talent/ })
    ).toBeVisible();

    await expect
      .poll(async () => {
        const events = await getDataLayerEvents(page);
        return events.find((e) => e.name === 'page_view');
      })
      .toMatchObject({
        name: 'page_view',
        params: {
          page_path:
            '/about?callbackUrl=%2Fauth%2Fverify%3Fsource%3Demail&utm_source=digest',
        },
      });

    const serialized = JSON.stringify(await getDataLayerEvents(page));
    expect(serialized).not.toContain('private.user@example.com');
    expect(serialized).not.toContain('secretSignature');
    expect(serialized).not.toContain('nestedSecret');
  });
});
