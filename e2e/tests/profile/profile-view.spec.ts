import { expect, Page, test } from '@playwright/test';

import { mockApiRoute } from '../../helpers/route';
import { setSignedSessionCookie } from '../../helpers/session';

// Static, valid user IDs from the dev/staging BFF database so that Next.js
// server-side fetches succeed, preventing 404s and keeping tests fully isolated.
const REAL_MENTOR_ID = '7468899508961767'; // Jonas Lo
const REAL_MENTEE_ID = '7462904718734737'; // Visitor (is_mentor: false)

function makeSession(userId: string, isMentor: boolean) {
  return {
    user: {
      id: userId,
      name: 'Test Own User',
      isMentor,
      onBoarding: true,
      jobTitle: 'Software Engineer',
      company: 'Own Company',
      personalLinks: [],
    },
    accessToken: 'mock-token',
    expires: '2099-01-01T00:00:00.000Z',
  };
}

function makeMockProfile(userId: number, name: string, isMentor: boolean) {
  return {
    code: '0',
    msg: 'ok',
    data: {
      user_id: userId,
      name,
      avatar: '',
      onboarding: true,
      is_mentor: isMentor,
      job_title: isMentor ? 'Software Engineer' : 'Mentee Dev',
      company: isMentor ? 'Test Mentor Company' : 'Test Mentee Company',
      years_of_experience: 'THREE_TO_FIVE_YEARS',
      location: 'TWN',
      personal_statement: 'Personal statement here',
      about: 'About me description',
      language: 'zh_TW',
      industry: {
        id: 1,
        subject_group: 'TECH',
        subject: '科技業',
        category: 'INDUSTRY',
        language: 'zh_TW',
        profession_metadata: { desc: '', icon: '' },
      },
      want_position: ['TEST_POS'],
      want_skill: ['TEST_SKILL'],
      want_topic: ['TEST_TOPIC'],
      have_skill: isMentor ? ['TEST_SKILL'] : [],
      have_topic: isMentor ? ['TEST_TOPIC'] : [],
      experiences: isMentor
        ? [
            {
              id: 1,
              category: 'WORK',
              order: 1,
              mentor_experiences_metadata: {
                data: [
                  {
                    job: 'Software Engineer',
                    company: 'Test Mentor Company',
                    job_period_start: '2020',
                    job_period_end: '2023',
                    industry: 'TECH',
                    job_location: 'TWN',
                    description: 'Work description',
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
                    school: 'Test University',
                    subject: 'Computer Science',
                    education_period_start: '2016',
                    education_period_end: '2020',
                  },
                ],
              },
            },
          ]
        : [],
    },
  };
}

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

// ─── Tests ───────────────────────────────────────────────────────────────────

test('檢視他人的 mentor 個人檔案 → 基本資訊、可預約時段區塊可見', async ({
  page,
}) => {
  const mentorId = REAL_MENTOR_ID;

  // Implement strict API mocking for full testing isolation during client-side hydration
  await mockApiRoute(
    page,
    new RegExp(`\\/v1\\/mentors\\/${mentorId}\\/zh_TW\\/profile`),
    {
      body: makeMockProfile(Number(mentorId), 'Jonas Lo', true),
    }
  );

  await page.goto(`/profile/${mentorId}`);

  // Assert Name & Basic Info region using semantic locator (checking the user-facing text)
  const nameElement = page.getByText('Jonas Lo');
  await expect(nameElement).toBeVisible({ timeout: 15_000 });

  // Assert schedule calendar / booking section is visible
  await expect(page.getByText('可預約日期')).toBeVisible();
});

test('檢視他人的 mentee 個人檔案 → 預約區塊不存在', async ({ page }) => {
  const menteeId = REAL_MENTEE_ID;

  // Implement strict API mocking for full testing isolation during client-side hydration
  await mockApiRoute(
    page,
    new RegExp(`\\/v1\\/mentors\\/${menteeId}\\/zh_TW\\/profile`),
    {
      body: makeMockProfile(Number(menteeId), 'Visitor', false),
    }
  );

  await page.goto(`/profile/${menteeId}`);

  // Assert name is visible using the correct semantic locator
  const nameElement = page.getByText('Visitor');
  await expect(nameElement).toBeVisible({ timeout: 15_000 });

  // Assert the schedule calendar / booking section is collapsed (not visible)
  await expect(page.getByText('可預約日期')).not.toBeVisible();
});

test('檢視不存在的 pageUserId → notFound() (404 頁面)', async ({ page }) => {
  // Implement API mocking for full testing isolation
  await mockApiRoute(page, /\/v1\/mentors\/9999999999\/zh_TW\/profile/, {
    status: 404,
    body: {
      code: '40400',
      msg: 'No such user with id: 9999999999',
      data: null,
    },
  });

  // Navigate to an invalid/non-existent user ID
  await page.goto('/profile/9999999999');

  // Next.js standard 404 page shows 404 heading, select the first match to comply with strict mode
  await expect(page.getByText('404').first()).toBeVisible({ timeout: 15_000 });
});

test('檢視自己的個人檔案（isOwnMentorProfile 為 true 時）→ 顯示「預約設定」而非「預約時間」', async ({
  page,
}) => {
  const mentorId = REAL_MENTOR_ID;

  // Sign in and set signed session cookie matching the pageUserId (own profile)
  await setSignedSessionCookie(page, {
    ...makeSession(mentorId, true).user,
    token: 'mock-access-token',
  });
  await mockSessionGet(page, makeSession(mentorId, true));

  // Intercept browser-side user profile calls for complete isolation
  await mockApiRoute(
    page,
    new RegExp(`\\/v1\\/mentors\\/${mentorId}\\/zh_TW\\/profile`),
    {
      body: makeMockProfile(Number(mentorId), 'Jonas Lo', true),
    }
  );

  await page.goto(`/profile/${mentorId}`);

  // Assert booking form button text says "預約設定" (booking settings) instead of "預約時間"
  const bookingButton = page.getByRole('button', { name: '預約設定' });
  await expect(bookingButton).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: '預約時間' })).toHaveCount(0);
});
