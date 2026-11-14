import { expect, Page, test } from '@playwright/test';

import { captureEvidence } from '../../helpers/evidence';
import { mockApiRoute } from '../../helpers/route';
import { seedMockAuthSession } from '../../helpers/session';

const MOCK_COUNTRIES = { code: '0', msg: 'ok', data: { TWN: '台灣' } };

const MOCK_INDUSTRIES = {
  code: '0',
  msg: 'ok',
  data: {
    professions: [
      {
        id: 1,
        subject_group: 'TECH',
        subject: '科技業',
        category: 'INDUSTRY',
        language: 'zh_TW',
        profession_metadata: { desc: '', icon: '' },
      },
    ],
  },
};

function makeInterestBody(subject: string) {
  return {
    code: '0',
    msg: 'ok',
    data: {
      interests: [
        {
          id: 1,
          subject_group: 'TEST_GROUP',
          subject,
          category: 'TEST',
          language: 'zh_TW',
          desc: { icon: '', desc: '' },
        },
      ],
      language: 'zh_TW',
    },
  };
}

async function setupOnboardingCatalogMocks(page: Page) {
  await mockApiRoute(page, /\/v1\/users\/zh_TW\/countries/, {
    body: MOCK_COUNTRIES,
  });
  await mockApiRoute(page, /\/v1\/users\/zh_TW\/industries/, {
    body: MOCK_INDUSTRIES,
  });
  await page.route(/\/v1\/users\/zh_TW\/interests/, (route) => {
    const url = route.request().url();
    if (url.includes('INTERESTED_POSITION')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeInterestBody('測試職位')),
      });
    }
    if (url.includes('SKILL')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeInterestBody('測試技能')),
      });
    }
    if (url.includes('TOPIC')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeInterestBody('測試主題')),
      });
    }
    return route.continue();
  });
}

test.describe('Route Access Policy, Callback Sanitization & Auth Guards (#878)', () => {
  test('未登入訪客造訪受保護路由 /profile/card → Middleware 導向 /auth/signin 並附帶 callbackUrl', async ({
    page,
  }) => {
    await page.goto('/profile/card');

    await expect(page).toHaveURL('/auth/signin?callbackUrl=%2Fprofile%2Fcard', {
      timeout: 15_000,
    });
    await expect(
      page.getByRole('heading', { name: '登入 X-Talent 帳戶' })
    ).toBeVisible();

    await captureEvidence(
      page,
      '878-visitor-profile-card-redirected-to-signin'
    );
  });

  test('已登入但 onBoarding: false 使用者造訪 /auth/signin 與 /auth/signup → 導向 /auth/onboarding 且保留雙欄封面 Shell', async ({
    page,
  }) => {
    const userId = '999981';
    await seedMockAuthSession(page, {
      id: userId,
      name: 'Onboarding User',
      onBoarding: false,
      isMentor: false,
    });
    await setupOnboardingCatalogMocks(page);

    await page.goto('/auth/signin');
    await expect(page).toHaveURL('/auth/onboarding', { timeout: 15_000 });
    await expect(page.locator('input[name="name"]')).toBeVisible({
      timeout: 15_000,
    });

    await captureEvidence(
      page,
      '878-incomplete-onboarding-redirected-from-signin'
    );

    await page.goto('/auth/signup');
    await expect(page).toHaveURL('/auth/onboarding', { timeout: 15_000 });
    await expect(page.locator('input[name="name"]')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('已登入 Mentee (onBoarding: true, isMentor: false) 造訪 /reservation/mentor → Middleware 導向 /reservation/mentee', async ({
    page,
  }) => {
    const userId = '999982';
    await seedMockAuthSession(page, {
      id: userId,
      name: 'Active Mentee',
      onBoarding: true,
      isMentor: false,
      jobTitle: 'Frontend Developer',
      company: 'X-Talent',
    });
    await mockApiRoute(
      page,
      new RegExp(`/v1/users/${userId}/reservations([?]|$)`),
      {
        body: {
          code: '0',
          msg: 'ok',
          data: { reservations: [], next_dtend: 0 },
        },
      }
    );
    await mockApiRoute(page, /\/v1\/users\/\d+\/notifications/, {
      body: {
        code: '0',
        msg: 'ok',
        data: { notifications: [], unread_count: 0 },
      },
    });

    await page.goto('/reservation/mentor');

    await expect(page).toHaveURL('/reservation/mentee', { timeout: 15_000 });
    await expect(page.getByRole('tab').first()).toBeVisible({
      timeout: 15_000,
    });

    await captureEvidence(
      page,
      '878-mentee-mentor-reservation-redirected-to-mentee'
    );
  });

  test('登入時若 ?callbackUrl=/maintenance → sanitizeCallbackUrl 拒絕導回維護頁並安全導向 /mentor-pool', async ({
    page,
  }) => {
    await page.goto('/auth/signin?callbackUrl=%2Fmaintenance');
    await expect(
      page.getByRole('heading', { name: '登入 X-Talent 帳戶' })
    ).toBeVisible();

    await seedMockAuthSession(page, {
      id: '999983',
      name: 'Safe Redirect User',
      email: 'user@example.com',
      onBoarding: true,
      isMentor: false,
    });

    await page.route(/\/api\/auth\/csrf/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ csrfToken: 'mock-csrf-token' }),
      })
    );
    await page.route(/\/api\/auth\/callback\/credentials/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: new URL('/', page.url()).origin }),
      })
    );

    await page.fill('input[name="email"]', 'user@example.com');
    await page.fill('input[name="password"]', 'Password1234');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/mentor-pool', { timeout: 10_000 });
  });
});
