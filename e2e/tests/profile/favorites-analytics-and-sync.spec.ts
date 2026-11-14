import { expect, type Page, test } from '@playwright/test';

import { captureEvidence } from '../../helpers/evidence';
import { mockApiRoute } from '../../helpers/route';
import {
  clearMockAuthSession,
  seedMockAuthSession,
} from '../../helpers/session';

test.use({ timezoneId: 'Asia/Taipei' });

const TARGET_MENTOR_ID = 7482008160728084;
const TARGET_MENTOR_ID_STR = String(TARGET_MENTOR_ID);
const SECOND_MENTOR_ID = 102;

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

function makePoolMentor(
  id: number,
  overrides: Partial<{
    name: string;
    job_title: string;
    company: string;
    about: string;
    have_topic: string[];
    have_skill: string[];
  }> = {}
) {
  return {
    user_id: id,
    name: overrides.name ?? 'Zahra Mirzakhani',
    avatar: '',
    job_title: overrides.job_title ?? 'Senior UX Designer',
    company: overrides.company ?? 'CreativeUX Design Studio',
    years_of_experience: 'FIVE_TO_TEN',
    location: 'TWN',
    linkedin_profile: '',
    interested_positions: [],
    skills: [],
    topics: [],
    want_position: [],
    want_skill: [],
    want_topic: [],
    have_skill: overrides.have_skill ?? ['產品設計', '設計系統'],
    have_topic: overrides.have_topic ?? ['作品集健檢', '職涯規劃'],
    industry: 'DESIGN',
    language: 'zh_TW',
    personal_statement: '歡迎帶著作品集或職涯問題來交流。',
    about:
      overrides.about ??
      '累積超過七年的數位產品設計經驗，陪伴設計師梳理作品集架構與職涯方向。',
    seniority_level: 'SENIOR',
    expertises: [],
    experiences: [],
    stats: {
      completed_meeting_count: 24,
      rating_count: 10,
      rating_average: 9.6,
    },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
  };
}

function makeMentorProfileResponse(userId: number, isMentor = true) {
  return {
    code: '0',
    msg: 'ok',
    data: {
      user_id: userId,
      name: 'Zahra Mirzakhani',
      avatar: '',
      onboarding: true,
      is_mentor: isMentor,
      job_title: 'Senior UX Designer',
      company: 'CreativeUX Design Studio',
      years_of_experience: 'FIVE_TO_TEN',
      location: 'TWN',
      personal_statement: '歡迎帶著作品集或職涯問題來交流。',
      about:
        '你好，我是 Zahra，累積超過七年的數位產品設計經驗，專注於使用者研究與跨產品設計系統。',
      language: 'zh_TW',
      stats: isMentor
        ? {
            completed_meeting_count: 24,
            rating_count: 10,
            rating_average: 9.6,
          }
        : null,
      industry: {
        id: 1,
        subject_group: 'DESIGN',
        subject: '設計及創意相關業',
        category: 'INDUSTRY',
        language: 'zh_TW',
      },
      want_position: [],
      want_skill: [],
      want_topic: [],
      have_skill: ['產品設計', '設計系統'],
      have_topic: ['作品集健檢', '職涯規劃'],
      experiences: [],
    },
  };
}

async function setupAnalyticsScriptStubs(page: Page) {
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
}

async function setupAuthenticatedViewer(
  page: Page,
  user: { id: string; name: string; isMentor: boolean } = {
    id: '9001',
    name: 'Mentee Viewer',
    isMentor: false,
  }
) {
  await seedMockAuthSession(page, {
    id: user.id,
    name: user.name,
    isMentor: user.isMentor,
    onBoarding: true,
    token: 'mock-auth-token',
  });
}

async function setupCommonSupportRoutes(
  page: Page,
  sideEffectCounter?: { notificationMutations: number; emailMutations: number }
) {
  await setupAnalyticsScriptStubs(page);

  await mockApiRoute(page, /\/v1\/users\/zh_TW\/countries/, {
    body: { code: '0', msg: 'ok', data: { TWN: '台灣' } },
  });

  await mockApiRoute(page, /\/v1\/users\/zh_TW\/industries/, {
    body: { code: '0', msg: 'ok', data: { professions: [] } },
  });

  await mockApiRoute(page, /\/v1\/users\/zh_TW\/interests/, {
    body: { code: '0', msg: 'ok', data: { interests: [], language: 'zh_TW' } },
  });

  await mockApiRoute(page, /\/v1\/users\/zh_TW\/tags\/catalog/, {
    body: {
      code: '0',
      msg: 'ok',
      data: {
        catalogs: {
          skill: { groups: [] },
          topic: { groups: [] },
          position: { groups: [] },
          industry: { groups: [] },
        },
      },
    },
  });

  await page.route(
    /\/v1\/(?:users\/[^/]+\/)?notifications\/unread-count/,
    (route) => {
      if (route.request().method() !== 'GET' && sideEffectCounter) {
        sideEffectCounter.notificationMutations += 1;
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: '0',
          msg: 'ok',
          data: { unread_count: 0 },
        }),
      });
    }
  );

  await page.route(/\/v1\/(?:users\/[^/]+\/)?notifications(\?|$)/, (route) => {
    if (route.request().method() !== 'GET' && sideEffectCounter) {
      sideEffectCounter.notificationMutations += 1;
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: '0',
        msg: 'ok',
        data: { notifications: [], next_cursor: null },
      }),
    });
  });

  await page.route(/\/v1\/.*(?:email|subscribe|alert)/i, (route) => {
    if (sideEffectCounter) {
      sideEffectCounter.emailMutations += 1;
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: '0', msg: 'ok', data: null }),
    });
  });

  await mockApiRoute(
    page,
    /\/v1\/users\/[^/]+\/reservations\/pending-feedback$/,
    {
      body: { code: '0', msg: 'ok', data: { reservations: [] } },
    }
  );

  await mockApiRoute(
    page,
    new RegExp(`/v1/(?:mentors|users)/${TARGET_MENTOR_ID_STR}/zh_TW/profile`),
    {
      body: makeMentorProfileResponse(TARGET_MENTOR_ID, true),
    }
  );

  await mockApiRoute(
    page,
    new RegExp(
      String.raw`/v1/mentors/${TARGET_MENTOR_ID_STR}/schedule/y/\d+/m/\d+`
    ),
    {
      body: { code: '0', msg: 'ok', data: { dtstart: [] } },
    }
  );

  await mockApiRoute(
    page,
    new RegExp(String.raw`/v1/mentors/${TARGET_MENTOR_ID_STR}/feedback(\?|$)`),
    {
      body: {
        code: '0',
        msg: 'ok',
        data: {
          items: [],
          total_rating_count: 10,
          rating_average: 9.6,
          completed_meeting_count: 24,
          page: 1,
          page_size: 10,
        },
      },
    }
  );

  await mockApiRoute(page, /\/v1\/reservations(\?|$)/, {
    body: {
      code: '0',
      msg: 'ok',
      data: { reservations: [], next_cursor: null },
    },
  });

  await mockApiRoute(page, /\/v1\/mentors(\?|$)/, {
    body: {
      code: '0',
      msg: 'ok',
      data: {
        mentors: [
          makePoolMentor(TARGET_MENTOR_ID, { name: 'Zahra Mirzakhani' }),
          makePoolMentor(SECOND_MENTOR_ID, {
            name: '陳宥廷 Austin',
            job_title: 'Senior Product Manager',
            company: 'Google',
          }),
        ],
        next_id: 0,
        next_cursor: null,
      },
    },
  });
}

test.describe('收藏功能跨畫面狀態同步、GA4 追蹤與無障礙整合驗證 (#757)', () => {
  test('Mentor Pool 與導師個人頁跨頁收藏同步、GA4 mentor_bookmark_toggle 無 PII 埋點與零通知/Email 副作用', async ({
    page,
  }) => {
    const favoritedSet = new Set<number>();
    const sideEffects = { notificationMutations: 0, emailMutations: 0 };
    let putCount = 0;
    let deleteCount = 0;

    await setupAuthenticatedViewer(page, {
      id: '9001',
      name: 'Mentee Viewer',
      isMentor: false,
    });
    await setupCommonSupportRoutes(page, sideEffects);

    await page.route(/\/v1\/me\/favorite-mentors(\?|$)/, (route) => {
      const mentors = Array.from(favoritedSet).map((id) =>
        makePoolMentor(id, {
          name: id === TARGET_MENTOR_ID ? 'Zahra Mirzakhani' : '陳宥廷 Austin',
        })
      );
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: '0', msg: 'ok', data: { mentors } }),
      });
    });

    await page.route(/\/v1\/mentors\/\d+\/favorite$/, (route) => {
      const method = route.request().method();
      const match = route
        .request()
        .url()
        .match(/\/v1\/mentors\/(\d+)\/favorite$/);
      const mentorId = Number(match?.[1] ?? 0);

      if (method === 'PUT') {
        putCount += 1;
        favoritedSet.add(mentorId);
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: '0', msg: 'ok', data: null }),
        });
      }

      if (method === 'DELETE') {
        deleteCount += 1;
        favoritedSet.delete(mentorId);
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: '0', msg: 'ok', data: null }),
        });
      }

      return route.continue();
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/mentor-pool?q=design');

    const firstCard = page.locator('article').first();
    await expect(firstCard).toBeVisible();

    const poolAddBtn = firstCard.getByRole('button', {
      name: '收藏 Zahra Mirzakhani',
    });
    await expect(poolAddBtn).toBeVisible();
    await expect(poolAddBtn).toHaveAttribute('aria-pressed', 'false');

    // 1. Mentor Pool 點擊加入收藏 -> 驗證 API PUT、實心狀態與 GA4 mentor_bookmark_toggle (add)
    const putPromise = page.waitForResponse(
      (res) =>
        res.url().includes(`/v1/mentors/${TARGET_MENTOR_ID_STR}/favorite`) &&
        res.request().method() === 'PUT'
    );
    await poolAddBtn.click();
    await putPromise;
    expect(putCount).toBe(1);

    const poolRemoveBtn = firstCard.getByRole('button', {
      name: '取消收藏 Zahra Mirzakhani',
    });
    await expect(poolRemoveBtn).toBeVisible();
    await expect(poolRemoveBtn).toHaveAttribute('aria-pressed', 'true');

    await expect
      .poll(async () => {
        const events = await getDataLayerEvents(page);
        return events.filter((e) => e.name === 'mentor_bookmark_toggle').length;
      })
      .toBe(1);

    const addToggleEvent = (await getDataLayerEvents(page)).find(
      (e) => e.name === 'mentor_bookmark_toggle'
    );
    expect(String(addToggleEvent?.params.mentor_id)).toBe(TARGET_MENTOR_ID_STR);
    expect(addToggleEvent?.params.action).toBe('add');
    expect(addToggleEvent?.params.feature).toBe('mentor_pool');
    expect(addToggleEvent?.params.button_location).toBe('mentor_pool_list');
    expect(addToggleEvent?.params.user_id).toBe('9001');
    expect(addToggleEvent?.params.user_role).toBe('mentee');

    // 2. 點擊導師卡片進入個人頁 -> 驗證 mentor_card_click 與跨頁狀態同步為已收藏並擷取證據圖
    await firstCard
      .getByRole('link', { name: '前往 Zahra Mirzakhani 的個人頁面' })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/profile/${TARGET_MENTOR_ID_STR}$`)
    );

    await expect
      .poll(async () => {
        const events = await getDataLayerEvents(page);
        return events.find((e) => e.name === 'mentor_card_click');
      })
      .toMatchObject({
        name: 'mentor_card_click',
        params: {
          mentor_id: TARGET_MENTOR_ID_STR,
          feature: 'mentor_pool',
          button_location: 'mentor_pool_list',
        },
      });

    const profileBookmarkBtn = page.locator(
      'button[data-testid="mentor-bookmark-button"]'
    );
    await expect(profileBookmarkBtn).toBeVisible();
    await expect(profileBookmarkBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(profileBookmarkBtn).toHaveAttribute(
      'aria-label',
      /^取消收藏\s+.+/
    );
    await expect(profileBookmarkBtn.locator('svg')).toHaveClass(/fill-current/);

    // 驗證完全不含任何新時段通知、Email 訂閱提示或站內通知副作用
    await expect(
      page.getByText(/新時段通知|Email\s*通知|寄送通知|開啟通知/)
    ).toHaveCount(0);
    expect(sideEffects.notificationMutations).toBe(0);
    expect(sideEffects.emailMutations).toBe(0);

    await captureEvidence(page, 'favorites-cross-page-ga4-verified');

    // 3. 於個人頁點擊取消收藏 -> 驗證 DELETE 與 GA4 mentor_bookmark_toggle (remove)
    const deletePromise = page.waitForResponse(
      (res) =>
        res.url().includes(`/v1/mentors/${TARGET_MENTOR_ID_STR}/favorite`) &&
        res.request().method() === 'DELETE'
    );
    await profileBookmarkBtn.click();
    await deletePromise;
    expect(deleteCount).toBe(1);
    await expect(profileBookmarkBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(profileBookmarkBtn).toHaveAttribute(
      'aria-label',
      /^收藏\s+.+/
    );

    await expect
      .poll(async () => {
        const events = await getDataLayerEvents(page);
        return events
          .filter((e) => e.name === 'mentor_bookmark_toggle')
          .map((e) => ({
            mentor_id: String(e.params.mentor_id),
            action: e.params.action,
            feature: e.params.feature,
            button_location: e.params.button_location,
          }));
      })
      .toEqual([
        {
          mentor_id: TARGET_MENTOR_ID_STR,
          action: 'add',
          feature: 'mentor_pool',
          button_location: 'mentor_pool_list',
        },
        {
          mentor_id: TARGET_MENTOR_ID_STR,
          action: 'remove',
          feature: 'profile',
          button_location: 'profile_header',
        },
      ]);

    // 4. 個資（Zero-PII）檢查：確認整份 dataLayer 絕不含導師姓名、會員姓名、Email 或 Token
    const serializedDataLayer = JSON.stringify(await getDataLayerEvents(page));
    expect(serializedDataLayer).not.toContain('Zahra Mirzakhani');
    expect(serializedDataLayer).not.toContain('Mentee Viewer');
    expect(serializedDataLayer).not.toContain('mock-auth-token');
    expect(serializedDataLayer).not.toMatch(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
    );

    // 5. 返回 Mentor Pool 確認狀態同步回復為未收藏，且全程零通知副作用
    await page.goto('/mentor-pool?q=design');
    await expect(
      page
        .locator('article')
        .first()
        .getByRole('button', { name: '收藏 Zahra Mirzakhani' })
    ).toHaveAttribute('aria-pressed', 'false');
    expect(sideEffects.notificationMutations).toBe(0);
    expect(sideEffects.emailMutations).toBe(0);
  });

  test('無障礙鍵盤 Tab 聚焦、Tooltip 顯示、Enter 與 Space 操作切換書籤', async ({
    page,
  }) => {
    const favoritedSet = new Set<number>();
    let putCount = 0;
    let deleteCount = 0;

    await setupAuthenticatedViewer(page);
    await setupCommonSupportRoutes(page);

    await page.route(/\/v1\/me\/favorite-mentors(\?|$)/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: '0',
          msg: 'ok',
          data: {
            mentors: Array.from(favoritedSet).map((id) =>
              makePoolMentor(id, { name: 'Zahra Mirzakhani' })
            ),
          },
        }),
      })
    );

    await page.route(/\/v1\/mentors\/\d+\/favorite$/, (route) => {
      const method = route.request().method();
      if (method === 'PUT') {
        putCount += 1;
        favoritedSet.add(TARGET_MENTOR_ID);
      } else if (method === 'DELETE') {
        deleteCount += 1;
        favoritedSet.delete(TARGET_MENTOR_ID);
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: '0', msg: 'ok', data: null }),
      });
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/mentor-pool?q=design');

    const firstCard = page.locator('article').first();
    await expect(firstCard).toBeVisible();

    const cardLink = firstCard.getByRole('link', {
      name: '前往 Zahra Mirzakhani 的個人頁面',
    });
    const bookmarkBtn = firstCard.locator(
      'button[data-testid="mentor-bookmark-button"]'
    );
    await expect(bookmarkBtn).toBeVisible();
    await expect(bookmarkBtn).toHaveAttribute(
      'aria-label',
      '收藏 Zahra Mirzakhani'
    );
    await expect(bookmarkBtn).toHaveAttribute('aria-pressed', 'false');

    // 1. 透過鍵盤 Tab 聚焦至書籤按鈕，驗證焦點狀態與無障礙 Tooltip 文案
    await cardLink.focus();
    await page.keyboard.press('Tab');
    await expect(bookmarkBtn).toBeFocused();
    await expect(page.getByRole('tooltip')).toHaveText('收藏 Zahra Mirzakhani');
    await expect(page.getByText(/新時段通知|Email/i)).toHaveCount(0);

    await captureEvidence(page, 'favorites-a11y-keyboard-tooltip');

    // 2. 鍵盤按下 Enter 觸發收藏，不會誤觸卡片連結導頁
    await bookmarkBtn.focus();
    await expect(bookmarkBtn).toBeFocused();
    const enterPutPromise = page.waitForResponse(
      (res) =>
        res.url().includes(`/v1/mentors/${TARGET_MENTOR_ID_STR}/favorite`) &&
        res.request().method() === 'PUT'
    );
    await page.keyboard.press('Enter');
    await enterPutPromise;

    await expect(page).toHaveURL(/\/mentor-pool\?q=design$/);
    await expect(bookmarkBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(bookmarkBtn).toHaveAttribute(
      'aria-label',
      '取消收藏 Zahra Mirzakhani'
    );
    expect(putCount).toBe(1);

    // 3. 鍵盤按下 Space 觸發取消收藏，狀態與 aria-label 即時更新
    await bookmarkBtn.focus();
    await expect(bookmarkBtn).toBeFocused();
    const spaceDeletePromise = page.waitForResponse(
      (res) =>
        res.url().includes(`/v1/mentors/${TARGET_MENTOR_ID_STR}/favorite`) &&
        res.request().method() === 'DELETE'
    );
    await page.keyboard.press('Space');
    await spaceDeletePromise;

    await expect(bookmarkBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(bookmarkBtn).toHaveAttribute(
      'aria-label',
      '收藏 Zahra Mirzakhani'
    );
    expect(deleteCount).toBe(1);
  });

  test('快速連點冪等防重複（in-flight 鎖定）與 API 500 錯誤回滾及 Toast 提示', async ({
    page,
  }) => {
    let putCount = 0;
    let deleteCount = 0;
    let shouldFailWith500 = false;
    const firstPutGate: { release: (() => void) | null } = { release: null };

    await setupAuthenticatedViewer(page);
    await setupCommonSupportRoutes(page);

    await page.route(/\/v1\/me\/favorite-mentors(\?|$)/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: '0', msg: 'ok', data: { mentors: [] } }),
      })
    );

    await page.route(/\/v1\/mentors\/\d+\/favorite$/, async (route) => {
      const method = route.request().method();

      if (shouldFailWith500) {
        if (method === 'PUT') putCount += 1;
        if (method === 'DELETE') deleteCount += 1;
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ code: '500', msg: 'Internal Server Error' }),
        });
      }

      if (method === 'PUT') {
        putCount += 1;
        if (putCount === 1) {
          await new Promise<void>((resolve) => {
            firstPutGate.release = resolve;
          });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: '0', msg: 'ok', data: null }),
        });
      }

      if (method === 'DELETE') {
        deleteCount += 1;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: '0', msg: 'ok', data: null }),
        });
      }

      return route.continue();
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/mentor-pool?q=design');

    const firstCard = page.locator('article').first();
    const bookmarkBtn = firstCard.locator(
      'button[data-testid="mentor-bookmark-button"]'
    );
    await expect(bookmarkBtn).toBeVisible();

    // 1. 第一次點擊進入 in-flight 狀態，立即樂觀更新且設定 aria-busy="true"
    const firstPutResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes(`/v1/mentors/${TARGET_MENTOR_ID_STR}/favorite`) &&
        res.request().method() === 'PUT'
    );
    await bookmarkBtn.click();

    await expect(bookmarkBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(bookmarkBtn).toHaveAttribute('aria-busy', 'true');
    await expect.poll(() => firstPutGate.release !== null).toBe(true);

    // 在請求尚未完成期間快速連點兩次 -> 應被 pending 鎖定攔截，不重送 API 亦不重複觸發 GA4
    await bookmarkBtn.click();
    await bookmarkBtn.click();
    expect(putCount).toBe(1);
    expect(deleteCount).toBe(0);

    firstPutGate.release?.();
    await firstPutResponsePromise;

    await expect(bookmarkBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(bookmarkBtn).not.toHaveAttribute('aria-busy', 'true');

    const bookmarkEventsAfterRapidClicks = (
      await getDataLayerEvents(page)
    ).filter((e) => e.name === 'mentor_bookmark_toggle');
    expect(bookmarkEventsAfterRapidClicks).toHaveLength(1);
    expect(bookmarkEventsAfterRapidClicks[0]?.params.action).toBe('add');

    // 2. 模擬後續 DELETE 回傳 HTTP 500 -> 驗證樂觀取消後自動回滾回已收藏並顯示錯誤 Toast
    shouldFailWith500 = true;
    const failedDeletePromise = page.waitForResponse(
      (res) =>
        res.url().includes(`/v1/mentors/${TARGET_MENTOR_ID_STR}/favorite`) &&
        res.request().method() === 'DELETE' &&
        res.status() === 500
    );
    await bookmarkBtn.click();
    await failedDeletePromise;

    await expect(bookmarkBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByText('收藏操作失敗，請稍後再試', { exact: true })
    ).toBeVisible();
  });

  test('未登入訪客收藏登入返回自動同步埋點，且導師本人檢視不可見自己的收藏按鈕或收藏名單', async ({
    page,
  }) => {
    const favoritedSet = new Set<number>();
    let putCount = 0;

    await clearMockAuthSession(page);
    await setupCommonSupportRoutes(page);

    await page.route(/\/api\/auth\/callback\/credentials/, async (route) => {
      await seedMockAuthSession(page, {
        id: '9001',
        name: 'Mentee Viewer',
        onBoarding: true,
        isMentor: false,
        token: 'mock-auth-token',
      });
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'http://localhost:3000' }),
      });
    });

    await page.route(/\/v1\/me\/favorite-mentors(\?|$)/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: '0',
          msg: 'ok',
          data: {
            mentors: Array.from(favoritedSet).map((id) =>
              makePoolMentor(id, { name: 'Zahra Mirzakhani' })
            ),
          },
        }),
      })
    );

    await page.route(/\/v1\/mentors\/\d+\/favorite$/, (route) => {
      if (route.request().method() === 'PUT') {
        putCount += 1;
        favoritedSet.add(TARGET_MENTOR_ID);
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: '0', msg: 'ok', data: null }),
      });
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/mentor-pool?q=design');

    // 1. 未登入訪客點擊收藏 -> 不發送 PUT 與 mentor_bookmark_toggle，導向登入頁
    await page
      .locator('article')
      .first()
      .getByRole('button', { name: '收藏 Zahra Mirzakhani' })
      .click();

    await expect(page).toHaveURL(
      new RegExp(
        String.raw`/auth/signin\?callbackUrl=${encodeURIComponent(`/profile/${TARGET_MENTOR_ID_STR}`)}`
      )
    );
    expect(putCount).toBe(0);
    const guestBookmarkEvents = (await getDataLayerEvents(page)).filter(
      (e) => e.name === 'mentor_bookmark_toggle'
    );
    expect(guestBookmarkEvents).toHaveLength(0);

    // 2. 完成登入返回 /profile/:id -> 自動完成收藏並觸發單筆 mentor_bookmark_toggle (add) 且無 PII
    const autoPutPromise = page.waitForResponse(
      (res) =>
        res.url().includes(`/v1/mentors/${TARGET_MENTOR_ID_STR}/favorite`) &&
        res.request().method() === 'PUT'
    );
    await page.fill('input[name="email"]', 'mentee@example.com');
    await page.fill('input[name="password"]', 'Password1234');
    await page.click('button[type="submit"]');

    await autoPutPromise;
    await expect(page).toHaveURL(
      new RegExp(`/profile/${TARGET_MENTOR_ID_STR}$`)
    );
    expect(putCount).toBe(1);

    const profileBookmarkBtn = page.locator(
      'button[data-testid="mentor-bookmark-button"]'
    );
    await expect(profileBookmarkBtn).toHaveAttribute('aria-pressed', 'true');

    await expect
      .poll(async () => {
        const events = await getDataLayerEvents(page);
        return events.find((e) => e.name === 'mentor_bookmark_toggle');
      })
      .toMatchObject({
        name: 'mentor_bookmark_toggle',
        params: {
          feature: 'profile',
          action: 'add',
          button_location: 'profile_header',
        },
      });

    const postLoginSerialized = JSON.stringify(await getDataLayerEvents(page));
    expect(postLoginSerialized).not.toContain('mentee@example.com');
    expect(postLoginSerialized).not.toContain('Zahra Mirzakhani');

    // 返回 Mentor Pool 確認跨頁同步為已收藏
    await page.goto('/mentor-pool?q=design');
    await expect(
      page
        .locator('article')
        .first()
        .getByRole('button', { name: '取消收藏 Zahra Mirzakhani' })
    ).toHaveAttribute('aria-pressed', 'true');

    // 3. 切換為導師本人身分檢視：Mentor Pool 自己的卡片與個人頁皆不顯示收藏按鈕或任何收藏者名單
    await seedMockAuthSession(page, {
      id: TARGET_MENTOR_ID_STR,
      name: 'Zahra Mirzakhani',
      isMentor: true,
      onBoarding: true,
      token: 'mock-mentor-token',
    });

    await page.goto('/mentor-pool?q=design');
    const cards = page.locator('article');
    await expect(cards).toHaveCount(2);
    await expect(
      cards.nth(0).locator('button[data-testid="mentor-bookmark-button"]')
    ).toHaveCount(0);
    await expect(
      cards.nth(1).getByRole('button', { name: '收藏 陳宥廷 Austin' })
    ).toBeVisible();

    const selfProfileRes = await page.goto(`/profile/${TARGET_MENTOR_ID_STR}`);
    if (selfProfileRes && selfProfileRes.status() >= 400) {
      await page.reload();
    }
    await expect(
      page.getByRole('button', { name: '編輯個人資訊' })
    ).toBeVisible();
    await expect(
      page.locator('button[data-testid="mentor-bookmark-button"]')
    ).toHaveCount(0);
    await expect(page.getByText(/收藏名單|誰收藏了我|收藏人數/)).toHaveCount(0);
  });
});
