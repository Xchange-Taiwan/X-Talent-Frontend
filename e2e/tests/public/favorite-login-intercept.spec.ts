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

async function setupCommonSupportRoutes(page: Page) {
  await mockApiRoute(page, /\/v1\/users\/zh_TW\/countries/, {
    body: { code: '0', msg: 'ok', data: { TWN: '台灣' } },
  });

  await mockApiRoute(page, /\/v1\/users\/zh_TW\/industries/, {
    body: {
      code: '0',
      msg: 'ok',
      data: {
        professions: [
          {
            id: 1,
            subject_group: 'DESIGN',
            subject: '設計業',
            category: 'INDUSTRY',
            language: 'zh_TW',
            profession_metadata: { desc: '', icon: '' },
          },
        ],
      },
    },
  });

  await mockApiRoute(page, /\/v1\/users\/zh_TW\/interests/, {
    body: {
      code: '0',
      msg: 'ok',
      data: {
        interests: [
          {
            id: 1,
            subject_group: 'TEST_GROUP',
            subject: '產品設計',
            category: 'TEST',
            language: 'zh_TW',
            desc: { icon: '', desc: '' },
          },
        ],
        language: 'zh_TW',
      },
    },
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

test.describe('收藏登入攔截與狀態同步 (#756)', () => {
  test('未登入於 Mentor Pool 點擊書籤導向登入頁，登入後統一導向 /profile/:id 自動完成收藏並跨頁同步狀態', async ({
    page,
  }) => {
    const favoritedSet = new Set<number>();
    let putCount = 0;
    let deleteCount = 0;
    let activeSession: Record<string, unknown> = {};

    await setupCommonSupportRoutes(page);

    await page.route(/\/api\/auth\/session/, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(activeSession),
        });
      }
      return route.continue();
    });

    await page.route(/\/api\/auth\/callback\/credentials/, async (route) => {
      await setSignedSessionCookie(page, {
        id: '9001',
        name: 'Mentee Viewer',
        onBoarding: true,
        isMentor: false,
        token: 'mock-auth-token',
      });
      activeSession = {
        user: {
          id: '9001',
          name: 'Mentee Viewer',
          onBoarding: true,
          isMentor: false,
          jobTitle: '',
          company: '',
          personalLinks: [],
        },
        accessToken: 'mock-auth-token',
        expires: '2099-01-01T00:00:00.000Z',
      };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'http://localhost:3000' }),
      });
    });

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

    // 1. 未登入訪客點擊 Mentor Pool 卡片書籤 -> 寫入 pendingFavorite 並導向登入頁
    const firstCard = page.locator('article').first();
    await expect(firstCard).toBeVisible();
    const guestBookmarkBtn = firstCard.getByRole('button', {
      name: '收藏 Zahra Mirzakhani',
    });
    await expect(guestBookmarkBtn).toBeVisible();
    await guestBookmarkBtn.click();

    await expect(page).toHaveURL(
      new RegExp(
        String.raw`/auth/signin\?callbackUrl=${encodeURIComponent(`/profile/${TARGET_MENTOR_ID_STR}`)}`
      )
    );
    expect(putCount).toBe(0);

    // 2. 完成登入 -> 自動導向 /profile/:id 並自動呼叫 PUT 完成收藏
    const putPromise = page.waitForResponse(
      (res) =>
        res.url().includes(`/v1/mentors/${TARGET_MENTOR_ID_STR}/favorite`) &&
        res.request().method() === 'PUT'
    );

    await page.fill('input[name="email"]', 'mentee@example.com');
    await page.fill('input[name="password"]', 'Password1234');
    await page.click('button[type="submit"]');

    await putPromise;
    await expect(page).toHaveURL(
      new RegExp(`/profile/${TARGET_MENTOR_ID_STR}$`)
    );

    const profileBookmarkBtn = page.locator(
      'button[data-analytics-event="mentor_bookmark_toggle"]'
    );
    await expect(profileBookmarkBtn).toBeVisible();
    await expect(profileBookmarkBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(profileBookmarkBtn).toHaveAttribute(
      'aria-label',
      /^取消收藏\s+.+/
    );
    await expect(profileBookmarkBtn.locator('svg')).toHaveClass(/fill-current/);
    await expect(profileBookmarkBtn.locator('svg')).toHaveClass(
      /text-brand-500/
    );
    expect(putCount).toBe(1);

    await captureEvidence(page, 'favorite-login-redirect-success');

    // 3. 返回 Mentor Pool 驗證狀態一致同步為已收藏，且取消收藏後同步反映
    await page.goto('/mentor-pool?q=design');
    const syncedCardBtn = page
      .locator('article')
      .first()
      .getByRole('button', { name: '取消收藏 Zahra Mirzakhani' });
    await expect(syncedCardBtn).toBeVisible();
    await expect(syncedCardBtn).toHaveAttribute('aria-pressed', 'true');

    const deletePromise = page.waitForResponse(
      (res) =>
        res.url().includes(`/v1/mentors/${TARGET_MENTOR_ID_STR}/favorite`) &&
        res.request().method() === 'DELETE'
    );
    await syncedCardBtn.click();
    await deletePromise;
    expect(deleteCount).toBe(1);
    await expect(
      page
        .locator('article')
        .first()
        .getByRole('button', { name: '收藏 Zahra Mirzakhani' })
    ).toHaveAttribute('aria-pressed', 'false');
  });

  test('未登入點擊自己導師個人頁書籤，登入後導向 /profile/:id 不呼叫收藏 API 並顯示「無法收藏自己」Toast', async ({
    page,
  }) => {
    let putCount = 0;
    let activeSession: Record<string, unknown> = {};

    await setupCommonSupportRoutes(page);

    await page.route(/\/api\/auth\/session/, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(activeSession),
        });
      }
      return route.continue();
    });

    await page.route(/\/api\/auth\/callback\/credentials/, async (route) => {
      await setSignedSessionCookie(page, {
        id: TARGET_MENTOR_ID_STR,
        name: 'Zahra Mirzakhani',
        onBoarding: true,
        isMentor: true,
        token: 'mock-mentor-self-token',
      });
      activeSession = {
        user: {
          id: TARGET_MENTOR_ID_STR,
          name: 'Zahra Mirzakhani',
          onBoarding: true,
          isMentor: true,
          jobTitle: 'Senior UX Designer',
          company: 'CreativeUX Design Studio',
          personalLinks: [],
        },
        accessToken: 'mock-mentor-self-token',
        expires: '2099-01-01T00:00:00.000Z',
      };
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
        body: JSON.stringify({ code: '0', msg: 'ok', data: { mentors: [] } }),
      })
    );

    await page.route(/\/v1\/mentors\/\d+\/favorite$/, (route) => {
      if (route.request().method() === 'PUT') {
        putCount += 1;
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: '0', msg: 'ok', data: null }),
      });
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/profile/${TARGET_MENTOR_ID_STR}`);

    const guestProfileBookmarkBtn = page.locator(
      'button[data-analytics-event="mentor_bookmark_toggle"]'
    );
    await expect(guestProfileBookmarkBtn).toBeVisible();
    await guestProfileBookmarkBtn.click();

    await expect(page).toHaveURL(
      new RegExp(
        String.raw`/auth/signin\?callbackUrl=${encodeURIComponent(`/profile/${TARGET_MENTOR_ID_STR}`)}`
      )
    );

    await page.fill('input[name="email"]', 'zahra@example.com');
    await page.fill('input[name="password"]', 'Password1234');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(
      new RegExp(`/profile/${TARGET_MENTOR_ID_STR}$`)
    );
    await expect(
      page.getByRole('button', { name: '編輯個人資訊' })
    ).toBeVisible();
    await expect(
      page.locator('button[data-analytics-event="mentor_bookmark_toggle"]')
    ).toHaveCount(0);

    const selfBlockedToast = page.getByText('無法收藏自己', { exact: true });
    await expect(selfBlockedToast).toBeVisible();
    expect(putCount).toBe(0);

    await captureEvidence(page, 'favorite-self-blocked-toast');
  });

  test('新註冊帳號點擊書籤後完成 5 步驟 Onboarding，導回原導師個人頁 /profile/:id 並自動完成收藏', async ({
    page,
  }) => {
    const favoritedSet = new Set<number>();
    let putCount = 0;
    let activeSession: Record<string, unknown> = {};

    await setupCommonSupportRoutes(page);

    await mockApiRoute(page, /\/v1\/mentors\/9002\/profile$/, {
      body: { code: '0', msg: 'ok', data: null },
    });

    await page.route(/\/api\/auth\/session/, async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(activeSession),
        });
      }
      if (method === 'POST') {
        await setSignedSessionCookie(page, {
          id: '9002',
          name: 'New Mentee',
          onBoarding: true,
          isMentor: false,
          token: 'mock-new-mentee-token',
        });
        activeSession = {
          user: {
            id: '9002',
            name: 'New Mentee',
            onBoarding: true,
            isMentor: false,
            jobTitle: '',
            company: '',
            personalLinks: [],
          },
          accessToken: 'mock-new-mentee-token',
          expires: '2099-01-01T00:00:00.000Z',
        };
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(activeSession),
        });
      }
      return route.continue();
    });

    await page.route(/\/api\/auth\/callback\/credentials/, async (route) => {
      await setSignedSessionCookie(page, {
        id: '9002',
        name: 'New Mentee',
        onBoarding: false,
        isMentor: false,
        token: 'mock-new-mentee-token',
      });
      activeSession = {
        user: {
          id: '9002',
          name: 'New Mentee',
          onBoarding: false,
          isMentor: false,
          jobTitle: '',
          company: '',
          personalLinks: [],
        },
        accessToken: 'mock-new-mentee-token',
        expires: '2099-01-01T00:00:00.000Z',
      };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'http://localhost:3000' }),
      });
    });

    await page.route(/\/v1\/me\/favorite-mentors(\?|$)/, (route) => {
      const mentors = Array.from(favoritedSet).map((id) =>
        makePoolMentor(id, { name: 'Zahra Mirzakhani' })
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
      return route.continue();
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/mentor-pool?q=design');

    // 1. 訪客點擊收藏書籤 -> 導向登入頁並保存收藏意圖
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

    // 2. 新註冊帳號首次登入（onBoarding: false）-> 導向 /auth/onboarding 且不提前清掉 pendingFavorite
    await page.fill('input[name="email"]', 'new-mentee@example.com');
    await page.fill('input[name="password"]', 'Password1234');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/auth\/onboarding$/, { timeout: 10_000 });
    expect(putCount).toBe(0);

    // 3. 依序完成 5 步驟新手引導
    const nameInput = page.locator('input[name="name"]');
    await expect(nameInput).toHaveValue('New Mentee');
    await page.getByRole('button', { name: '下一步' }).click();

    await expect(page.getByText('步驟 2 / 5')).toBeVisible();
    await page.getByText('請選擇您的年資區間').click();
    await page.getByRole('option', { name: '1 年以下' }).click();
    await page.getByRole('button', { name: '下一步' }).click();

    await expect(page.getByText('步驟 3 / 5')).toBeVisible();
    await page.getByRole('checkbox').first().click();
    await page.getByRole('button', { name: '下一步' }).click();

    await expect(page.getByText('步驟 4 / 5')).toBeVisible();
    await page.getByRole('checkbox').first().click();
    await page.getByRole('button', { name: '下一步' }).click();

    await expect(page.getByText('步驟 5 / 5')).toBeVisible();
    await page.getByRole('checkbox').first().click();

    const putPromise = page.waitForResponse(
      (res) =>
        res.url().includes(`/v1/mentors/${TARGET_MENTOR_ID_STR}/favorite`) &&
        res.request().method() === 'PUT'
    );
    await page.getByRole('button', { name: '提交' }).click();

    // 4. Onboarding 完成後自動導回原導師個人頁 /profile/:id 並完成收藏
    await putPromise;
    await expect(page).toHaveURL(
      new RegExp(`/profile/${TARGET_MENTOR_ID_STR}$`),
      { timeout: 15_000 }
    );

    const profileBookmarkBtn = page.locator(
      'button[data-analytics-event="mentor_bookmark_toggle"]'
    );
    await expect(profileBookmarkBtn).toBeVisible();
    await expect(profileBookmarkBtn).toHaveAttribute('aria-pressed', 'true');
    expect(putCount).toBe(1);

    await captureEvidence(page, 'favorite-onboarding-redirect-success');
  });
});
