import { expect, type Page, test } from '@playwright/test';

import { captureEvidence } from '../../helpers/evidence';
import { mockApiRoute } from '../../helpers/route';
import { setSignedSessionCookie } from '../../helpers/session';

test.use({ timezoneId: 'Asia/Taipei' });

const TARGET_MENTOR_ID = 7482008160728084;
const TARGET_MENTOR_ID_STR = String(TARGET_MENTOR_ID);
const SECOND_MENTOR_ID = 102;

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

async function setupAuthenticatedViewer(
  page: Page,
  user: { id: string; name: string; isMentor: boolean } = {
    id: '9001',
    name: 'Mentee Viewer',
    isMentor: false,
  }
) {
  await setSignedSessionCookie(page, {
    id: user.id,
    name: user.name,
    isMentor: user.isMentor,
    onBoarding: true,
    token: 'mock-auth-token',
  });

  await page.route(/\/api\/auth\/session/, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: user.id,
            name: user.name,
            isMentor: user.isMentor,
            onBoarding: true,
          },
          accessToken: 'mock-auth-token',
          expires: '2099-01-01T00:00:00.000Z',
        }),
      });
    }
    return route.continue();
  });
}

async function setupCommonSupportRoutes(page: Page) {
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

  await mockApiRoute(page, /\/v1\/notifications\/unread-count/, {
    body: { code: '0', msg: 'ok', data: { unread_count: 0 } },
  });

  await mockApiRoute(page, /\/v1\/notifications(\?|$)/, {
    body: {
      code: '0',
      msg: 'ok',
      data: { notifications: [], next_cursor: null },
    },
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

test.describe('Mentor 書籤收藏 (#758)', () => {
  test('Mentor Pool 卡片點擊書籤立即切換實心狀態且不觸發整卡導頁，並與導師個人頁同步狀態', async ({
    page,
  }) => {
    const favoritedSet = new Set<number>();
    let putCount = 0;
    let deleteCount = 0;

    await setupAuthenticatedViewer(page);
    await setupCommonSupportRoutes(page);

    await page.route(/\/v1\/me\/favorite-mentors(\?|$)/, (route) => {
      const mentors = Array.from(favoritedSet).map((id) =>
        makePoolMentor(id, {
          name: id === TARGET_MENTOR_ID ? 'Zahra Mirzakhani' : '陳宥廷 Austin',
        })
      );
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: '0',
          msg: 'ok',
          data: { mentors },
        }),
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

    const cardBookmarkBtn = firstCard.getByRole('button', {
      name: '收藏 Zahra Mirzakhani',
    });
    await expect(cardBookmarkBtn).toBeVisible();
    await expect(cardBookmarkBtn).toHaveAttribute('aria-pressed', 'false');

    // Hover 顯示無障礙 Tooltip，且不含任何 Email 或新時段通知文案
    await cardBookmarkBtn.hover();
    await expect(page.getByRole('tooltip')).toHaveText('收藏 Zahra Mirzakhani');
    await expect(page.getByText(/新時段通知/)).toHaveCount(0);

    // 點擊書籤：立即切換為品牌色實心 Bookmark，且不會觸發整卡導頁
    const putPromise = page.waitForResponse(
      (res) =>
        res.url().includes(`/v1/mentors/${TARGET_MENTOR_ID_STR}/favorite`) &&
        res.request().method() === 'PUT'
    );
    await cardBookmarkBtn.click();
    await putPromise;

    await expect(page).toHaveURL(/\/mentor-pool\?q=design$/);
    const activeCardBookmarkBtn = firstCard.getByRole('button', {
      name: '取消收藏 Zahra Mirzakhani',
    });
    await expect(activeCardBookmarkBtn).toBeVisible();
    await expect(activeCardBookmarkBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(activeCardBookmarkBtn.locator('svg')).toHaveClass(
      /fill-current/
    );
    await expect(activeCardBookmarkBtn.locator('svg')).toHaveClass(
      /text-brand-500/
    );
    expect(putCount).toBe(1);

    // 移開滑鼠並解除焦點使卡片畫面乾淨呈現實心書籤 icon，擷取證據圖
    await page.mouse.move(10, 10);
    await activeCardBookmarkBtn.evaluate((el: HTMLElement) => el.blur());
    await expect(activeCardBookmarkBtn).toBeVisible();
    await captureEvidence(page, 'mentor-pool-bookmarked');

    // 點擊卡片本體連結進入導師個人頁，驗證跨頁狀態同步為已收藏
    await firstCard
      .getByRole('link', { name: '前往 Zahra Mirzakhani 的個人頁面' })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/profile/${TARGET_MENTOR_ID_STR}$`)
    );

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

    await captureEvidence(page, 'mentor-profile-bookmarked');

    // 於導師個人頁點擊取消收藏，驗證發送 DELETE 並切換回未收藏線框狀態
    const deletePromise = page.waitForResponse(
      (res) =>
        res.url().includes(`/v1/mentors/${TARGET_MENTOR_ID_STR}/favorite`) &&
        res.request().method() === 'DELETE'
    );
    await profileBookmarkBtn.click();
    await deletePromise;

    await expect(profileBookmarkBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(profileBookmarkBtn).toHaveAttribute(
      'aria-label',
      /^收藏\s+.+/
    );
    expect(deleteCount).toBe(1);
  });

  test('API 失敗時回滾收藏狀態並顯示錯誤 Toast 提示，且 GET 404 靜默降級為空陣列', async ({
    page,
  }) => {
    await setupAuthenticatedViewer(page);
    await setupCommonSupportRoutes(page);

    // 模擬後端 #759 未部署時 GET /v1/me/favorite-mentors 回傳 404
    await page.route(/\/v1\/me\/favorite-mentors(\?|$)/, (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Not Found' }),
      })
    );

    // 模擬 PUT /v1/mentors/:id/favorite 失敗回傳 500
    await page.route(/\/v1\/mentors\/\d+\/favorite$/, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          code: '500',
          msg: 'Internal Server Error',
        }),
      })
    );

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/mentor-pool?q=design');

    const firstCard = page.locator('article').first();
    await expect(firstCard).toBeVisible();

    const bookmarkBtn = firstCard.getByRole('button', {
      name: '收藏 Zahra Mirzakhani',
    });
    await expect(bookmarkBtn).toBeVisible();

    const failedPutPromise = page.waitForResponse(
      (res) =>
        res.url().includes(`/v1/mentors/${TARGET_MENTOR_ID_STR}/favorite`) &&
        res.status() === 500
    );
    await bookmarkBtn.click();
    await failedPutPromise;

    // 狀態回滾回未收藏，並顯示錯誤 Toast
    await expect(
      firstCard.getByRole('button', { name: '收藏 Zahra Mirzakhani' })
    ).toHaveAttribute('aria-pressed', 'false');

    await expect(
      page.getByText('收藏操作失敗，請稍後再試', { exact: true })
    ).toBeVisible();
    await captureEvidence(page, 'mentor-bookmark-error-toast');
  });

  test('導師檢視自己的卡片與個人頁皆隱藏書籤按鈕；未登入訪客點擊導向登入頁', async ({
    page,
  }) => {
    await setupAuthenticatedViewer(page, {
      id: TARGET_MENTOR_ID_STR,
      name: 'Zahra Mirzakhani',
      isMentor: true,
    });
    await setupCommonSupportRoutes(page);

    await page.route(/\/v1\/me\/favorite-mentors(\?|$)/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: '0', msg: 'ok', data: [] }),
      })
    );

    // 1. Mentor Pool：自己的卡片隱藏書籤，其他導師卡片仍顯示書籤
    await page.goto('/mentor-pool?q=design');
    const cards = page.locator('article');
    await expect(cards).toHaveCount(2);

    await expect(
      cards.nth(0).locator('button[data-testid="mentor-bookmark-button"]')
    ).toHaveCount(0);
    await expect(
      cards.nth(1).getByRole('button', { name: '收藏 陳宥廷 Austin' })
    ).toBeVisible();

    // 2. 自己的 Mentor 個人頁：隱藏書籤按鈕
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

    // 3. 清除登入狀態後，未登入訪客點擊卡片書籤導向 /auth/signin?callbackUrl=...
    await page.context().clearCookies();
    await page.unroute(/\/api\/auth\/session/);
    await page.route(/\/api\/auth\/session/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      })
    );

    await page.goto('/mentor-pool?q=design');
    const guestBookmarkBtn = page
      .locator('article')
      .first()
      .getByRole('button', { name: '收藏 Zahra Mirzakhani' });
    await expect(guestBookmarkBtn).toBeVisible();

    await guestBookmarkBtn.click();
    await expect(page).toHaveURL(
      new RegExp(
        String.raw`/auth/signin\?callbackUrl=${encodeURIComponent(`/profile/${TARGET_MENTOR_ID_STR}`)}`
      )
    );
  });
});
