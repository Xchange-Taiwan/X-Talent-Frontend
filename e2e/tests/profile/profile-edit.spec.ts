import { expect, Page, test } from '@playwright/test';

import { mockApiRoute } from '../../helpers/route';
import { setSignedSessionCookie } from '../../helpers/session';

const USER_ID = '1';
const PAGE_URL = `/profile/${USER_ID}/edit`;

// ─── Mock payloads ───────────────────────────────────────────────────────────

function makeSession(isMentor: boolean) {
  return {
    user: {
      id: USER_ID,
      name: 'Test User',
      isMentor,
      onBoarding: true,
      jobTitle: '',
      company: '',
      personalLinks: [],
    },
    accessToken: 'mock-token',
    expires: '2099-01-01T00:00:00.000Z',
  };
}

function makeProfile(name: string, isMentor: boolean) {
  return {
    code: '0',
    msg: 'ok',
    data: {
      user_id: Number(USER_ID),
      name,
      avatar: '',
      onboarding: true,
      is_mentor: isMentor,
      job_title: '',
      company: '',
      years_of_experience: 'BELOW_ONE_YEAR',
      location: 'TWN',
      personal_statement: '',
      about: isMentor ? '我是 mentor' : '',
      language: 'zh_TW',
      industry: {
        id: 1,
        subject_group: 'TECH',
        subject: '科技業',
        category: 'INDUSTRY',
        language: 'zh_TW',
        profession_metadata: { desc: '', icon: '' },
      },
      interested_positions: {
        interests: [
          {
            id: 1,
            subject_group: 'TEST_POS',
            subject: '測試職位',
            category: 'INTERESTED_POSITION',
            language: 'zh_TW',
            desc: { icon: '', desc: '' },
          },
        ],
        language: 'zh_TW',
      },
      skills: {
        interests: [
          {
            id: 2,
            subject_group: 'TEST_SKILL',
            subject: '測試技能',
            category: 'SKILL',
            language: 'zh_TW',
            desc: { icon: '', desc: '' },
          },
        ],
        language: 'zh_TW',
      },
      topics: {
        interests: [
          {
            id: 3,
            subject_group: 'TEST_TOPIC',
            subject: '測試主題',
            category: 'TOPIC',
            language: 'zh_TW',
            desc: { icon: '', desc: '' },
          },
        ],
        language: 'zh_TW',
      },
      expertises: {
        professions: isMentor
          ? [
              {
                id: 1,
                subject_group: 'DATA',
                subject: '資料分析',
                category: 'EXPERTISE',
                language: 'zh_TW',
                profession_metadata: { desc: '', icon: '' },
              },
            ]
          : [],
        language: 'zh_TW',
      },
      // Mentor requires at least one work experience, education, and what_i_offer.
      experiences: isMentor
        ? [
            {
              id: 1,
              category: 'WORK',
              order: 1,
              mentor_experiences_metadata: {
                data: [
                  {
                    job: '工程師',
                    company: '測試公司',
                    jobPeriodStart: '2020',
                    jobPeriodEnd: '2023',
                    industry: 'TECH',
                    jobLocation: 'TWN',
                    description: '工作內容',
                  },
                ],
              },
            },
            {
              id: 2,
              category: 'EDUCATION',
              order: 2,
              mentor_experiences_metadata: {
                data: [
                  {
                    school: '測試大學',
                    subject: '資訊工程',
                    educationPeriodStart: '2016',
                    educationPeriodEnd: '2020',
                  },
                ],
              },
            },
            {
              id: 4,
              category: 'WHAT_I_OFFER',
              order: 4,
              mentor_experiences_metadata: {
                data: [{ subject_group: 'CAREER_PLANNING' }],
              },
            },
          ]
        : [],
    },
  };
}

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

const MOCK_EXPERTISES = {
  code: '0',
  msg: 'ok',
  data: {
    professions: [
      {
        id: 1,
        subject_group: 'DATA',
        subject: '資料分析',
        category: 'EXPERTISE',
        language: 'zh_TW',
        profession_metadata: { desc: '', icon: '' },
      },
    ],
  },
};

function makeInterest(subject: string) {
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Mock GET /api/auth/session so useSession() returns the desired session.
 * Non-GET requests are passed through (or fall back) to allow PUT mocks
 * registered later to handle updateSession calls.
 */
async function mockSessionGet(page: Page, session: object): Promise<void> {
  await page.route(/\/api\/auth\/session/, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(session),
      });
    }
    return route.continue();
  });
}

/**
 * Mock all dropdown option endpoints used by the profile edit page.
 */
async function mockDropdowns(page: Page): Promise<void> {
  await mockApiRoute(page, /\/v1\/users\/zh_TW\/countries/, {
    body: MOCK_COUNTRIES,
  });
  await mockApiRoute(page, /\/v1\/users\/zh_TW\/industries/, {
    body: MOCK_INDUSTRIES,
  });
  await mockApiRoute(page, /\/v1\/mentors\/zh_TW\/expertises/, {
    body: MOCK_EXPERTISES,
  });
  await page.route(/\/v1\/users\/zh_TW\/interests/, (route) => {
    const url = route.request().url();
    if (url.includes('INTERESTED_POSITION')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeInterest('測試職位')),
      });
    }
    if (url.includes('SKILL')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeInterest('測試技能')),
      });
    }
    if (url.includes('TOPIC')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeInterest('測試主題')),
      });
    }
    return route.continue();
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('未授權使用者（userId 不符）→ 重導向至 /', async ({ page }) => {
  await setSignedSessionCookie(page, {
    id: '999',
    name: 'Other User',
    isMentor: false,
    onBoarding: true,
    jobTitle: '',
    company: '',
    personalLinks: [],
    token: 'mock-access-token',
  });
  await mockSessionGet(page, {
    user: {
      id: '999',
      name: 'Other User',
      isMentor: false,
      onBoarding: true,
      jobTitle: '',
      company: '',
      personalLinks: [],
    },
    accessToken: 'mock-token',
    expires: '2099-01-01T00:00:00.000Z',
  });

  await page.goto(PAGE_URL);

  await expect(page).toHaveURL('/', { timeout: 10_000 });
});

test('Mentor 使用者載入編輯頁 → mentor 專屬區塊（我能提供的服務、專業能力）可見', async ({
  page,
}) => {
  await setSignedSessionCookie(page, {
    ...makeSession(true).user,
    token: 'mock-access-token',
  });
  await mockSessionGet(page, makeSession(true));
  await mockApiRoute(page, /\/v1\/mentors\/1\/zh_TW\/profile/, {
    body: makeProfile('Test User', true),
  });
  await mockDropdowns(page);

  await page.goto(PAGE_URL);

  await expect(page.getByText('我能提供的服務')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('專業能力')).toBeVisible();
});

test('Mentee 使用者載入編輯頁 → mentor 專屬區塊不存在', async ({ page }) => {
  await setSignedSessionCookie(page, {
    ...makeSession(false).user,
    token: 'mock-access-token',
  });
  await mockSessionGet(page, makeSession(false));
  await mockApiRoute(page, /\/v1\/mentors\/1\/zh_TW\/profile/, {
    body: makeProfile('Test User', false),
  });
  await mockDropdowns(page);

  await page.goto(PAGE_URL);

  // Wait for the loading state to clear before asserting absence
  await expect(page.locator('input[name="name"]')).toHaveValue('Test User', {
    timeout: 15_000,
  });
  await expect(page.getByText('我能提供的服務')).not.toBeVisible();
  await expect(page.getByText('專業能力')).not.toBeVisible();
});

test('編輯姓名並儲存 → 重導向至 /profile/:userId', async ({ page }) => {
  await setSignedSessionCookie(page, {
    ...makeSession(false).user,
    token: 'mock-access-token',
  });
  await mockSessionGet(page, makeSession(false));

  // First GET (initial load) returns the original name.
  // Subsequent GETs (pollUntilSynced) return the updated name so isProfileSynced
  // resolves on the first poll and the test doesn't wait the full 60-second timeout.
  let getProfileCallCount = 0;
  await page.route(/\/v1\/mentors\/1\/zh_TW\/profile/, (route) => {
    getProfileCallCount++;
    const name = getProfileCallCount === 1 ? 'Test User' : 'Updated Name';
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeProfile(name, false)),
    });
  });

  await mockDropdowns(page);

  // PUT /v1/mentors/1/profile (no zh_TW segment) → updateProfile success.
  // This pattern does not match the GET zh_TW URL, so the counter handler above
  // remains the sole handler for GET profile calls.
  await mockApiRoute(page, /\/v1\/mentors\/1\/profile/, {
    body: { code: '0', msg: 'ok', data: null },
  });

  // PUT /api/auth/session → updateSession after save.
  // GET requests fall back to the handler registered by mockSessionGet above.
  await page.route(/\/api\/auth\/session/, (route) => {
    if (route.request().method() === 'PUT') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...makeSession(false),
          user: { ...makeSession(false).user, name: 'Updated Name' },
        }),
      });
    }
    return route.fallback();
  });

  await page.goto(PAGE_URL);

  // Wait for the form to be pre-filled with data from the initial profile fetch
  await expect(page.locator('input[name="name"]')).toHaveValue('Test User', {
    timeout: 15_000,
  });

  // Edit the name field
  await page.fill('input[name="name"]', 'Updated Name');

  // Submit the form
  await page.getByRole('button', { name: '儲存' }).click();

  await expect(page).toHaveURL(`/profile/${USER_ID}`, { timeout: 30_000 });
});
