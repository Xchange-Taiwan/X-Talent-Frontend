import { expect, type Page, type Route, test } from '@playwright/test';

import { captureEvidence } from '../../helpers/evidence';
import { mockApiRoute } from '../../helpers/route';
import { setSignedSessionCookie } from '../../helpers/session';

test.use({ timezoneId: 'Asia/Taipei' });

const FIRST_MENTOR_ID = 7482008160728084;
const FIRST_MENTOR_ID_STR = String(FIRST_MENTOR_ID);
const SECOND_MENTOR_ID = 102;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function fulfillCorsOptions(route: Route) {
  return route.fulfill({
    status: 204,
    headers: CORS_HEADERS,
  });
}

function fulfillJsonWithCors(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  });
}

function makeFavoriteMentor(
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
    have_skill: overrides.have_skill ?? ['product_design', 'design_system'],
    have_topic: overrides.have_topic ?? ['portfolio_review', 'career_planning'],
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

function makeMentorProfileResponse(userId: number) {
  return {
    code: '0',
    msg: 'ok',
    data: {
      user_id: userId,
      name: 'Zahra Mirzakhani',
      avatar: '',
      onboarding: true,
      is_mentor: true,
      job_title: 'Senior UX Designer',
      company: 'CreativeUX Design Studio',
      years_of_experience: 'FIVE_TO_TEN',
      location: 'TWN',
      personal_statement: '歡迎帶著作品集或職涯問題來交流。',
      about:
        '你好，我是 Zahra，累積超過七年的數位產品設計經驗，專注於使用者研究與跨產品設計系統。',
      language: 'zh_TW',
      stats: {
        completed_meeting_count: 24,
        rating_count: 10,
        rating_average: 9.6,
      },
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

async function setupAuthenticatedViewer(page: Page) {
  if (!process.env.NEXTAUTH_SECRET) {
    process.env.NEXTAUTH_SECRET = 'secret';
  }

  await setSignedSessionCookie(page, {
    id: '9001',
    name: 'Mentee Viewer',
    isMentor: false,
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
            id: '9001',
            name: 'Mentee Viewer',
            isMentor: false,
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
          skill: {
            groups: [
              {
                subject_group: 'design_group',
                subject: '設計',
                language: 'zh_TW',
                leaves: [
                  {
                    tag_id: 1,
                    subject_group: 'product_design',
                    subject: '產品設計',
                    language: 'zh_TW',
                  },
                  {
                    tag_id: 2,
                    subject_group: 'design_system',
                    subject: '設計系統',
                    language: 'zh_TW',
                  },
                ],
              },
            ],
          },
          topic: {
            groups: [
              {
                subject_group: 'career_group',
                subject: '職涯發展',
                language: 'zh_TW',
                leaves: [
                  {
                    tag_id: 11,
                    subject_group: 'portfolio_review',
                    subject: '作品集健檢',
                    language: 'zh_TW',
                  },
                  {
                    tag_id: 12,
                    subject_group: 'career_planning',
                    subject: '職涯規劃',
                    language: 'zh_TW',
                  },
                ],
              },
            ],
          },
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
    new RegExp(`/v1/(?:mentors|users)/${FIRST_MENTOR_ID_STR}/zh_TW/profile`),
    {
      body: makeMentorProfileResponse(FIRST_MENTOR_ID),
    }
  );

  await mockApiRoute(
    page,
    new RegExp(
      String.raw`/v1/mentors/${FIRST_MENTOR_ID_STR}/schedule/y/\d+/m/\d+`
    ),
    {
      body: { code: '0', msg: 'ok', data: { dtstart: [] } },
    }
  );

  await mockApiRoute(
    page,
    new RegExp(String.raw`/v1/mentors/${FIRST_MENTOR_ID_STR}/feedback(\?|$)`),
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
          makeFavoriteMentor(FIRST_MENTOR_ID, { name: 'Zahra Mirzakhani' }),
        ],
        next_id: 0,
        next_cursor: null,
      },
    },
  });
}

test.describe('我的收藏頁 /favorites (#755)', () => {
  test('未登入訪客造訪 /favorites 時導向 /auth/signin?callbackUrl=%2Ffavorites', async ({
    page,
  }) => {
    await setupCommonSupportRoutes(page);

    await page.goto('/favorites');
    await expect(page).toHaveURL(/\/auth\/signin\?callbackUrl=%2Ffavorites$/);
  });

  test('呈現已收藏導師清單與計數、點卡片進個人頁、取消收藏立即移出、最後一筆切換空狀態並可導向尋找導師', async ({
    page,
  }) => {
    const favoritedOrder = [FIRST_MENTOR_ID, SECOND_MENTOR_ID];
    let deleteCount = 0;

    await setupAuthenticatedViewer(page);
    await setupCommonSupportRoutes(page);

    await page.route(/\/v1\/me\/favorite-mentors(\?|$)/, (route) => {
      if (route.request().method() === 'OPTIONS') {
        return fulfillCorsOptions(route);
      }
      const mentors = favoritedOrder.map((id) =>
        id === FIRST_MENTOR_ID
          ? makeFavoriteMentor(FIRST_MENTOR_ID, {
              name: 'Zahra Mirzakhani',
            })
          : makeFavoriteMentor(SECOND_MENTOR_ID, {
              name: '陳宥廷 Austin',
              job_title: 'Senior Product Manager',
              company: 'Google',
              about:
                '超過八年跨國數位產品與搜尋體驗管理經驗，協助產品經理建立清晰的產品策略與職涯地圖。',
              have_topic: ['career_planning'],
              have_skill: ['product_design'],
            })
      );
      return fulfillJsonWithCors(route, 200, {
        code: '0',
        msg: 'ok',
        data: { mentors },
      });
    });

    await page.route(/\/v1\/mentors\/\d+\/favorite$/, (route) => {
      const method = route.request().method();
      if (method === 'OPTIONS') {
        return fulfillCorsOptions(route);
      }

      const match = route
        .request()
        .url()
        .match(/\/v1\/mentors\/(\d+)\/favorite$/);
      const mentorId = Number(match?.[1] ?? 0);

      if (method === 'DELETE') {
        deleteCount += 1;
        const idx = favoritedOrder.indexOf(mentorId);
        if (idx !== -1) {
          favoritedOrder.splice(idx, 1);
        }
        return fulfillJsonWithCors(route, 200, {
          code: '0',
          msg: 'ok',
          data: null,
        });
      }

      return route.continue();
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/favorites');

    const heading = page.getByRole('heading', { level: 1, name: '我的收藏' });
    await expect(heading).toBeVisible();
    await expect(page.getByText('已收藏 2 位導師')).toBeVisible();

    // 不顯示 Email、新時段或通知設定文案
    await expect(page.getByText(/新時段/)).toHaveCount(0);
    await expect(page.getByText(/通知設定/)).toHaveCount(0);

    const cards = page.locator('article');
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toBeVisible();
    await expect(
      cards.first().getByTestId('display-container').getByText('作品集健檢')
    ).toBeVisible();

    const firstBookmarkBtn = cards
      .first()
      .getByRole('button', { name: '取消收藏 Zahra Mirzakhani' });
    await expect(firstBookmarkBtn).toBeVisible();
    await expect(firstBookmarkBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(firstBookmarkBtn.locator('svg')).toHaveClass(/fill-current/);
    await expect(firstBookmarkBtn.locator('svg')).toHaveClass(/text-brand-500/);

    await captureEvidence(page, 'favorites-list-populated');

    // 點擊卡片進入 Mentor 個人頁
    await cards
      .first()
      .getByRole('link', { name: '前往 Zahra Mirzakhani 的個人頁面' })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/profile/${FIRST_MENTOR_ID_STR}$`)
    );

    // 返回我的收藏頁，驗證取消收藏立即移出清單
    await page.goto('/favorites');
    await expect(page.getByText('已收藏 2 位導師')).toBeVisible();

    const firstDeletePromise = page.waitForResponse(
      (res) =>
        res.url().includes(`/v1/mentors/${FIRST_MENTOR_ID_STR}/favorite`) &&
        res.request().method() === 'DELETE'
    );
    await page
      .getByRole('button', { name: '取消收藏 Zahra Mirzakhani' })
      .click();
    await firstDeletePromise;

    await expect(page).toHaveURL(/\/favorites$/);
    await expect(page.getByText('已收藏 1 位導師')).toBeVisible();
    await expect(cards).toHaveCount(1);
    expect(deleteCount).toBe(1);

    // 最後一筆移除後立即切換為空狀態
    const secondDeletePromise = page.waitForResponse(
      (res) =>
        res.url().includes(`/v1/mentors/${SECOND_MENTOR_ID}/favorite`) &&
        res.request().method() === 'DELETE'
    );
    await page.getByRole('button', { name: '取消收藏 陳宥廷 Austin' }).click();
    await secondDeletePromise;

    await expect(page.getByText('已收藏 0 位導師')).toBeVisible();
    const emptyMessage = page.getByText('還沒有收藏的導師');
    await expect(emptyMessage).toBeVisible();
    const findMentorCta = page
      .locator('main')
      .getByRole('link', { name: '尋找導師' });
    await expect(findMentorCta).toBeVisible();
    expect(deleteCount).toBe(2);

    await captureEvidence(page, 'favorites-empty-state');

    // 空狀態 CTA 正確導向 /mentor-pool
    await findMentorCta.click();
    await expect(page).toHaveURL(/\/mentor-pool$/);
  });

  test('後端 GET /v1/me/favorite-mentors 回傳 404 時自動視為 0 筆並呈現空狀態', async ({
    page,
  }) => {
    await setupAuthenticatedViewer(page);
    await setupCommonSupportRoutes(page);

    await mockApiRoute(page, /\/v1\/me\/favorite-mentors(\?|$)/, {
      status: 404,
      body: { detail: 'Not Found' },
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/favorites');

    await expect(
      page.getByRole('heading', { level: 1, name: '我的收藏' })
    ).toBeVisible();
    await expect(page.getByText('已收藏 0 位導師')).toBeVisible();
    await expect(page.getByText('還沒有收藏的導師')).toBeVisible();
    const emptyStateCta = page
      .locator('main')
      .getByRole('link', { name: '尋找導師' });
    await expect(emptyStateCta).toBeVisible();
    await expect(emptyStateCta).toHaveAttribute('href', '/mentor-pool');
  });
});
