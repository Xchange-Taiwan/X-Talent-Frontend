import { expect, Page, test } from '@playwright/test';

import { mockApiRoute } from '../../helpers/route';
import { setRawSessionCookie } from '../../helpers/session';

// ─── Mock payloads ───────────────────────────────────────────────────────────

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

const MOCK_USER_PROFILE = {
  code: '0',
  msg: 'ok',
  data: {
    user_id: 1,
    name: 'Test User',
    avatar: '',
    onboarding: true,
    is_mentor: false,
    job_title: '',
    company: '',
    years_of_experience: 'BELOW_ONE_YEAR',
    location: 'TWN',
    language: 'zh_TW',
    interested_positions: { interests: [], language: null },
    skills: { interests: [], language: null },
    topics: { interests: [], language: null },
    industry: {
      id: 0,
      category: '',
      language: 'zh_TW',
      subject_group: '',
      subject: '',
      profession_metadata: { desc: '', icon: '' },
    },
  },
};

const MOCK_CLIENT_SESSION = {
  user: {
    id: '1',
    name: 'Test User',
    onBoarding: false,
    isMentor: false,
    jobTitle: '',
    company: '',
    personalLinks: [],
  },
  accessToken: 'mock-token',
  expires: '2099-01-01T00:00:00.000Z',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Onboarding middleware only checks for cookie existence. The server-side
// layout guard calls getServerSession(), which tries to decode the cookie;
// decode failure returns null and the guard does NOT redirect.
async function setFakeSessionCookie(page: Page): Promise<void> {
  await setRawSessionCookie(page, 'e2e-fake-session-token');
}

/**
 * Mock the client-side session endpoint and the five option-list APIs so
 * dropdowns and checkbox lists are populated without a real backend.
 */
async function setupPageMocks(page: Page): Promise<void> {
  // useSession() polls GET /api/auth/session — return the client-side view
  await page.route(/\/api\/auth\/session/, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_CLIENT_SESSION),
      });
    }
    return route.continue();
  });

  await mockApiRoute(page, /\/v1\/users\/zh_TW\/countries/, {
    body: MOCK_COUNTRIES,
  });
  await mockApiRoute(page, /\/v1\/users\/zh_TW\/industries/, {
    body: MOCK_INDUSTRIES,
  });

  // Three interest types share one endpoint; differentiate by query param.
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

/**
 * Set up the forged session cookie + page mocks, then navigate to
 * `/auth/onboarding`. Combines `setOnboardingSession` + `setupPageMocks`.
 */
async function gotoOnboarding(page: Page): Promise<void> {
  await setFakeSessionCookie(page);
  await setupPageMocks(page);
  await page.goto('/auth/onboarding');
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('submit Step 1 with empty name → inline validation error shown, does NOT advance to Step 2', async ({
  page,
}) => {
  await gotoOnboarding(page);

  // The session mock pre-fills the name field with 'Test User' via useEffect.
  // Wait for that reset to settle, then clear the field so validation fires.
  await expect(page.locator('input[name="name"]')).toHaveValue('Test User');
  await page.fill('input[name="name"]', '');
  await page.getByRole('button', { name: '下一步' }).click();

  await expect(page.getByText('請輸入姓名')).toBeVisible();
  await expect(page.getByText('步驟 1 / 5')).toBeVisible();
});

test('complete all 5 steps (happy path) → redirects to /profile/card', async ({
  page,
}) => {
  await gotoOnboarding(page);

  // GET /v1/mentors/:id/zh_TW/profile — fetchUser after submit
  await mockApiRoute(page, /\/v1\/mentors\/[^/]+\/zh_TW\/profile/, {
    body: MOCK_USER_PROFILE,
  });

  // PUT /v1/mentors/:id/profile — updateProfile (no /zh_TW/ segment)
  await mockApiRoute(page, /\/v1\/mentors\/[^/]+\/profile/, {
    body: { code: '0', msg: 'ok', data: null },
  });

  // Override /api/auth/session for both GET and POST so that:
  //   GET  → useSession() / getSession() inside updateProfile and fetchUser
  //          return a valid session (userId present, no real-server decode needed)
  //   POST → NextAuth's update() call after onboarding; mocking prevents the
  //          server from trying to decode the fake cookie and clearing it via
  //          Set-Cookie, which would strip the session cookie and break the
  //          middleware auth check when router.push('/profile/card') fires.
  // This handler is registered after setupPageMocks, so it is tried first
  // (Playwright routes are LIFO) and shadows the GET-only handler above.
  await page.route(/\/api\/auth\/session/, (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_CLIENT_SESSION),
      });
    }
    if (method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...MOCK_CLIENT_SESSION,
          user: { ...MOCK_CLIENT_SESSION.user, onBoarding: true },
        }),
      });
    }
    return route.continue();
  });

  // Step 1 — fill name
  await page.fill('input[name="name"]', 'Test User');
  await page.getByRole('button', { name: '下一步' }).click();

  // Step 2 — select years_of_experience
  await expect(page.getByText('步驟 2 / 5')).toBeVisible();
  await page.getByText('請選擇您的年資區間').click();
  await page.getByRole('option', { name: '1 年以下' }).click();
  await page.getByRole('button', { name: '下一步' }).click();

  // Step 3 — select one interested position
  await expect(page.getByText('步驟 3 / 5')).toBeVisible();
  await page.getByText('測試職位').click();
  await page.getByRole('button', { name: '下一步' }).click();

  // Step 4 — select one skill
  await expect(page.getByText('步驟 4 / 5')).toBeVisible();
  await page.getByText('測試技能').click();
  await page.getByRole('button', { name: '下一步' }).click();

  // Step 5 — select one topic and submit
  await expect(page.getByText('步驟 5 / 5')).toBeVisible();
  await page.getByText('測試主題').click();
  await page.getByRole('button', { name: '提交' }).click();

  await expect(page).toHaveURL('/profile/card', { timeout: 15_000 });
});

test('click 上一步 on Step 3 → returns to Step 2, previously entered Step 2 data is preserved', async ({
  page,
}) => {
  await gotoOnboarding(page);

  // Step 1
  await page.fill('input[name="name"]', 'Test User');
  await page.getByRole('button', { name: '下一步' }).click();

  // Step 2 — select years_of_experience so we have data to verify later
  await expect(page.getByText('步驟 2 / 5')).toBeVisible();
  await page.getByText('請選擇您的年資區間').click();
  await page.getByRole('option', { name: '1 年以下' }).click();
  await page.getByRole('button', { name: '下一步' }).click();

  // Step 3 — click the back arrow (ChevronLeft icon)
  await expect(page.getByText('步驟 3 / 5')).toBeVisible();
  await page.locator('.lucide-chevron-left').click();

  // Back on Step 2 — years_of_experience value should still be shown in the
  // combobox trigger. Use getByRole to avoid strict-mode violation from the
  // hidden <option> element that also contains the same text.
  await expect(page.getByText('步驟 2 / 5')).toBeVisible();
  await expect(page.getByRole('combobox', { name: '經驗' })).toContainText(
    '1 年以下'
  );
});
