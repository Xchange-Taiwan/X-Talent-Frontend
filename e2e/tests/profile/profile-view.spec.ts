import { expect, Page, test } from '@playwright/test';

import { mockApiRoute } from '../../helpers/route';
import { setSignedSessionCookie } from '../../helpers/session';

// Real user IDs from the dev/staging BFF database so that Next.js server-side fetches succeed
let REAL_MENTOR_ID = '7468899508961767'; // Jonas Lo
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

// ─── Setup Dynamic Mentor ID ──────────────────────────────────────────────────

async function resolveRealMentorId(page: Page): Promise<string> {
  try {
    await page.goto('/mentor-pool');
    const card = page.locator('article').first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    const href = await card.locator('a').first().getAttribute('href');
    if (href) {
      const parts = href.split('/');
      const extractedId = parts[parts.length - 1];
      if (extractedId && /^\d+$/.test(extractedId)) {
        REAL_MENTOR_ID = extractedId;
      }
    }
  } catch (error) {
    console.warn(
      'Failed to dynamically resolve mentor ID from pool, using static fallback:',
      error
    );
  }
  return REAL_MENTOR_ID;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('檢視他人的 mentor 個人檔案 → 基本資訊、可預約時段區塊可見', async ({
  page,
}) => {
  const mentorId = await resolveRealMentorId(page);
  await page.goto(`/profile/${mentorId}`);

  // Assert Name & Basic Info region using the correct <p> locator instead of <h1>
  const nameElement = page.locator('p.text-2xl.font-semibold');
  await expect(nameElement).toBeVisible({ timeout: 15_000 });
  const nameText = await nameElement.textContent();
  expect(nameText?.trim().length).toBeGreaterThan(0);

  // Assert schedule calendar / booking section is visible
  await expect(page.getByText('可預約日期')).toBeVisible();
});

test('檢視他人的 mentee 個人檔案 → 預約區塊不存在', async ({ page }) => {
  // Navigate directly to the real mentee ID
  await page.goto(`/profile/${REAL_MENTEE_ID}`);

  // Assert name is visible using the correct <p> locator
  const nameElement = page.locator('p.text-2xl.font-semibold');
  await expect(nameElement).toBeVisible({ timeout: 15_000 });

  // Assert the schedule calendar / booking section is collapsed (not visible)
  await expect(page.getByText('可預約日期')).not.toBeVisible();
});

test('檢視不存在的 pageUserId → notFound() (404 頁面)', async ({ page }) => {
  // Navigate to an invalid/non-existent user ID
  await page.goto('/profile/9999999999');

  // Next.js standard 404 page shows 404 heading, select the first match to comply with strict mode
  await expect(page.getByText('404').first()).toBeVisible({ timeout: 15_000 });
});

test('檢視自己的個人檔案（isOwnMentorProfile 為 true 時）→ 顯示「預約設定」而非「預約時間」', async ({
  page,
}) => {
  const mentorId = await resolveRealMentorId(page);

  // Sign in and set signed session cookie matching the pageUserId (own profile)
  await setSignedSessionCookie(page, {
    ...makeSession(mentorId, true).user,
    token: 'mock-access-token',
  });
  await mockSessionGet(page, makeSession(mentorId, true));

  // Intercept browser-side user profile calls
  await mockApiRoute(
    page,
    new RegExp(`\\/v1\\/mentors\\/${mentorId}\\/zh_TW\\/profile`),
    {
      body: makeMockProfile(Number(mentorId), 'Test Own User', true),
    }
  );

  await page.goto(`/profile/${mentorId}`);

  // Assert booking form button text says "預約設定" (booking settings) instead of "預約時間"
  const bookingButton = page.getByRole('button', { name: '預約設定' });
  await expect(bookingButton).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: '預約時間' })).toHaveCount(0);
});
