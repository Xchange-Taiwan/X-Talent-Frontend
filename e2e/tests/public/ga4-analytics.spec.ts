import { expect, type Page, test } from '@playwright/test';

import { captureEvidence } from '../../helpers/evidence';
import { blockUnmockedExternalApi, mockApiRoute } from '../../helpers/route';
import { setSignedSessionCookie } from '../../helpers/session';

interface NormalizedGaEvent {
  name: string;
  params: Record<string, unknown>;
}

const MOCK_INTERESTS = {
  code: '0',
  msg: 'ok',
  data: { interests: [], language: 'zh_TW' },
};

const MOCK_TAG_CATALOG = {
  code: '0',
  msg: 'ok',
  data: {
    catalogs: {
      skill: {
        groups: [
          {
            subject_group: 'SKILL_GROUP',
            subject: '技術能力',
            language: 'zh_TW',
            leaves: [
              {
                tag_id: 1,
                subject_group: 'FRONTEND',
                subject: '前端開發',
                language: 'zh_TW',
              },
            ],
          },
        ],
      },
      topic: { groups: [] },
      position: { groups: [] },
      industry: { groups: [] },
    },
  },
};

const MOCK_MENTORS_RESPONSE = {
  code: '0',
  msg: 'ok',
  data: {
    mentors: [
      {
        user_id: 7482008160728084,
        name: '王小明',
        avatar: '',
        job_title: 'Senior Frontend Engineer',
        company: 'XChange',
        years_of_experience: 'THREE_TO_FIVE_YEARS',
        location: 'TWN',
        linkedin_profile: '',
        interested_positions: [],
        skills: ['FRONTEND'],
        topics: [],
        want_position: [],
        want_skill: [],
        want_topic: [],
        have_skill: ['FRONTEND'],
        have_topic: [],
        industry: 'Technology',
        language: 'zh_TW',
        personal_statement: '專注於大型前端架構與職涯發展分享。',
        about: '專注於大型前端架構與職涯發展分享。',
        seniority_level: 'SENIOR',
        expertises: [],
        experiences: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      },
    ],
    next_id: 0,
    next_cursor: null,
  },
};

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

test.describe('GA4 事件追蹤：page_view、scroll_depth [25,50,75,100]、核心業務埋點與個資防護 (#865)', () => {
  test.beforeEach(async ({ page }) => {
    await blockUnmockedExternalApi(page);
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
    await page.route(/\/v1\/users\/zh_TW\/interests/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_INTERESTS),
      })
    );
    await page.route(/\/v1\/users\/zh_TW\/tags\/catalog/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_TAG_CATALOG),
      })
    );
    await page.route(/\/v1\/mentors/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_MENTORS_RESPONSE),
      })
    );
  });

  test('驗證初次進站與 SPA 換頁 page_view、分段滾動單一 scroll_depth [25,50,75,100] 與桌機導覽埋點', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('homepage-cta-hero')).toBeVisible();

    // 確認桌機版 Header「成為導師」連結具備宣告式埋點屬性
    const becomeMentorNavLink = page
      .locator('header nav a[data-analytics-click="header_nav_become_mentor"]')
      .last();
    await expect(becomeMentorNavLink).toHaveAttribute(
      'data-analytics-feature',
      'onboarding'
    );

    // 1. 初次進站：window.dataLayer 收到單筆首頁 page_view，且訪客附帶 user_role: 'guest'、不含 user_id
    await expect
      .poll(async () => {
        const events = await getDataLayerEvents(page);
        return events.filter(
          (e) => e.name === 'page_view' && e.params.page_path === '/'
        ).length;
      })
      .toBe(1);

    const initialHomePageView = (await getDataLayerEvents(page)).find(
      (e) => e.name === 'page_view' && e.params.page_path === '/'
    );
    expect(initialHomePageView?.params.user_role).toBe('guest');
    expect(initialHomePageView?.params.user_id).toBeUndefined();

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

    // 快速滾動跨越至約 80% 可捲動高度：依序補齊 50 與 75 門檻
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

    // 滾動到底部 100%：觸發 100 門檻並自動解除 scroll 監聽器
    await page.evaluate(() => {
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, scrollable);
    });

    await expect
      .poll(async () => {
        const events = await getDataLayerEvents(page);
        return events
          .filter((e) => e.name === 'scroll_depth')
          .map((e) => e.params.percent_scrolled);
      })
      .toEqual([25, 50, 75, 100]);

    // 往回微幅滾動不會重複送出已達標的 scroll_depth
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
    expect(scrollEventsAfterRescroll).toHaveLength(4);

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

  test('驗證導師池篩選標籤、導師卡片 mentor_id 與行動版導覽選單埋點及截圖證據', async ({
    page,
  }) => {
    await page.goto('/mentor-pool');

    // 1. 驗證導師卡片具備 mentor_card_click 與純數值 mentor_id，點擊後不外洩導師姓名
    const firstMentorCardLink = page
      .locator('a[data-analytics-click="mentor_card"]')
      .first();
    await expect(firstMentorCardLink).toBeVisible({ timeout: 15_000 });
    const cardMentorId = await firstMentorCardLink.getAttribute(
      'data-analytics-param-mentor-id'
    );
    expect(cardMentorId).toMatch(/^\d+$/);

    // 攔截連結預設跳轉以留在當前頁繼續驗證篩選標籤，同時讓 document Capture-phase 委派正常觸發
    await firstMentorCardLink.evaluate((el) => {
      el.addEventListener('click', (e) => e.preventDefault(), { once: true });
    });
    await firstMentorCardLink.click();

    await expect
      .poll(async () => {
        const events = await getDataLayerEvents(page);
        return events.find((e) => e.name === 'mentor_card_click');
      })
      .toMatchObject({
        name: 'mentor_card_click',
        params: {
          feature: 'mentor_pool',
          mentor_id: cardMentorId,
          button_id: 'mentor_card',
          button_location: 'mentor_pool_list',
        },
      });

    // 2. 點擊熱門職位快篩標籤：驗證 mentor_pool_filter_apply 攜帶 filter_type 與 filter_value，且 ?q= 不外洩進 page_path
    const firstChip = page
      .locator('[data-analytics-click="mentor_pool_popular_chip"]')
      .first();
    await expect(firstChip).toBeVisible({ timeout: 15_000 });
    const chipLabel = (await firstChip.textContent())?.trim() ?? '';
    await firstChip.click();

    await expect
      .poll(async () => {
        const events = await getDataLayerEvents(page);
        return events.find((e) => e.name === 'mentor_pool_filter_apply');
      })
      .toMatchObject({
        name: 'mentor_pool_filter_apply',
        params: {
          feature: 'mentor_pool',
          filter_type: 'popular_position',
          filter_value: chipLabel,
          button_id: 'mentor_pool_popular_chip',
          button_location: 'popular_positions',
        },
      });

    await captureEvidence(page, 'ga4-analytics-mentor-pool-desktop');

    // 3. 切換至行動版視窗開啟漢堡選單：驗證 mobile_menu_open 與行動版導覽埋點屬性
    await page.setViewportSize({ width: 390, height: 844 });
    const hamburgerBtn = page.getByRole('button', { name: '開啟導航選單' });
    await expect(hamburgerBtn).toBeVisible();
    await hamburgerBtn.click();

    await expect(
      page.locator('[data-analytics-click="mobile_nav_become_mentor"]')
    ).toBeVisible();
    await expect
      .poll(async () => {
        const events = await getDataLayerEvents(page);
        return events.some(
          (e) =>
            e.name === 'button_click' &&
            e.params.button_id === 'mobile_menu_open'
        );
      })
      .toBe(true);

    await captureEvidence(page, 'ga4-analytics-mobile-menu');
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

  test('已登入會員初次進站 page_view 等待 Session 解析附帶內部 user_id 與 user_role，且登出後恢復 guest (#866)', async ({
    page,
  }) => {
    await mockApiRoute(page, /\/v1\/users\/.*\/notifications\/unread-count/, {
      body: { code: '0', msg: 'ok', data: { unread_count: 0 } },
    });
    await page.route(/\/api\/auth\/backend-logout/, async (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({ status: 204, body: '' });
      }
      return route.continue();
    });

    await setSignedSessionCookie(page, {
      id: '999998',
      name: 'Alice Chen',
      onBoarding: true,
      isMentor: true,
      jobTitle: 'Staff Engineer',
      company: 'XChange',
      token: 'mock-secret-access-token',
    });

    await page.goto('/mentor-pool');
    await expect(
      page.locator('a[data-analytics-click="mentor_card"]').first()
    ).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () => {
        const events = await getDataLayerEvents(page);
        return events.find(
          (e) => e.name === 'page_view' && e.params.page_path === '/mentor-pool'
        );
      })
      .toMatchObject({
        name: 'page_view',
        params: {
          page_path: '/mentor-pool',
          user_id: '999998',
          user_role: 'mentor',
        },
      });

    const menuTrigger = page.getByRole('button', { name: '開啟用戶選單' });
    await expect(menuTrigger).toBeVisible({ timeout: 15_000 });
    await menuTrigger.click();

    const logoutMenuItem = page.getByRole('menuitem', { name: '登出' });
    await expect(logoutMenuItem).toBeVisible();
    await captureEvidence(page, 'ga4-user-id-bound-account-menu');

    const serializedLoggedIn = JSON.stringify(await getDataLayerEvents(page));
    expect(serializedLoggedIn).not.toContain('Alice Chen');
    expect(serializedLoggedIn).not.toContain('mock-secret-access-token');

    await logoutMenuItem.click();
    await expect(menuTrigger).toBeHidden({ timeout: 15_000 });

    const signInHeaderLink = page
      .getByTestId('desktop-header-right')
      .getByRole('link', { name: '登入' });
    await expect(signInHeaderLink).toBeVisible({ timeout: 15_000 });

    const aboutNavLink = page
      .getByRole('link', { name: '關於 X-Talent' })
      .first();
    await aboutNavLink.click();
    await expect(page).toHaveURL('/about');

    await expect
      .poll(async () => {
        const events = await getDataLayerEvents(page);
        return events.find(
          (e) => e.name === 'page_view' && e.params.page_path === '/about'
        );
      })
      .toMatchObject({
        name: 'page_view',
        params: {
          page_path: '/about',
          user_role: 'guest',
        },
      });

    const aboutPageView = (await getDataLayerEvents(page)).find(
      (e) => e.name === 'page_view' && e.params.page_path === '/about'
    );
    expect(aboutPageView?.params.user_id).toBeUndefined();
  });
});
