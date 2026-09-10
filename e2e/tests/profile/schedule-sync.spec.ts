import { expect, Locator, Page, test } from '@playwright/test';

import { mockApiRoute } from '../../helpers/route';
import { setSignedSessionCookie } from '../../helpers/session';

// Specify timezone locally to guarantee identical time behaviours across local & CI
test.use({ timezoneId: 'Asia/Taipei' });

// Static, valid user IDs from the dev/staging BFF database so that Next.js
// server-side fetches succeed - this is a dedicated seeded test/fixture
// account (see .env.e2e.local's E2E_MENTOR_EMAIL), not a real production
// user.
const REAL_MENTOR_ID = '7482008160728084'; // display name "Mentee", Mentor role (E2E_MENTOR_EMAIL)

// Helper to construct a flat NextAuth JWT Payload
function makeJWTPayload(userId: string, isMentor: boolean) {
  return {
    id: userId,
    name: 'Test Own User',
    isMentor,
    onBoarding: true,
    jobTitle: 'Software Engineer',
    company: 'Own Company',
    personalLinks: [],
    token: 'mock-access-token',
  };
}

/**
 * Sign in and mock next-auth session endpoints for the specified role.
 */
async function setupTestSession(page: Page, isMentor: boolean): Promise<void> {
  const userId = isMentor ? REAL_MENTOR_ID : '123';
  await setSignedSessionCookie(page, makeJWTPayload(userId, isMentor));

  await page.route(/\/api\/auth\/session/, (route) => {
    if (route.request().method() === 'GET') {
      const session = {
        user: {
          id: userId,
          name: 'Test Own User',
          isMentor,
          onBoarding: true,
          jobTitle: 'Software Engineer',
          company: 'Own Company',
          personalLinks: [],
        },
        accessToken: 'mock-access-token',
        expires: '2099-01-01T00:00:00.000Z',
      };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(session),
      });
    }
    return route.continue();
  });
}

function makeProfile(isMentor: boolean) {
  return {
    code: '0',
    msg: 'ok',
    data: {
      user_id: Number(REAL_MENTOR_ID),
      name: 'Test Mentor',
      avatar: '',
      onboarding: true,
      is_mentor: isMentor,
      job_title: 'Software Engineer',
      company: 'Own Company',
      years_of_experience: 'BELOW_ONE_YEAR',
      location: 'TWN',
      personal_statement: 'I am a mentor',
      about: 'About me',
      language: 'zh_TW',
      industry: {
        id: 1,
        subject_group: 'TECH',
        subject: '科技業',
        category: 'INDUSTRY',
        language: 'zh_TW',
      },
      want_position: [],
      want_skill: [],
      want_topic: [],
      have_skill: ['TEST_SKILL'],
      have_topic: ['TEST_TOPIC'],
      expertises: {
        professions: [
          {
            id: 1,
            subject_group: 'DATA',
            subject: '資料分析',
            category: 'EXPERTISE',
            language: 'zh_TW',
          },
        ],
        language: 'zh_TW',
      },
      experiences: [
        {
          id: 1,
          category: 'WORK',
          order: 1,
          mentor_experiences_metadata: {
            data: [
              {
                job: '工程師',
                company: '測試公司',
                job_period_start: '2020',
                job_period_end: '2023',
                industry: 'TECH',
                job_location: 'TWN',
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
                school: '國立臺灣大學',
                major: '資訊工程系',
                degree: 'BACHELOR',
                job_period_start: '2016',
                job_period_end: '2020',
                job_location: 'TWN',
                description: '',
              },
            ],
          },
        },
        {
          id: 3,
          category: 'CUSTOM',
          order: 3,
          mentor_experiences_metadata: {
            data: [
              {
                title: '我能提供什麼',
                description: '提供導師諮詢',
              },
            ],
          },
        },
      ],
    },
  };
}

async function selectCalendarDate(
  page: Page | Locator,
  dateKey: string
): Promise<void> {
  const dayButton = page.getByTestId(`day-${dateKey}`);
  await expect(dayButton).toBeVisible({ timeout: 15_000 });
  await dayButton.click();
}

/**
 * Navigate to a mentor's profile and open the "設定可預約時段" schedule
 * dialog via the "預約設定" button. Shared by every test that needs the
 * dialog open, so the navigation/button-click steps aren't duplicated.
 */
async function openScheduleDialog(
  page: Page,
  mentorId: string
): Promise<Locator> {
  await page.goto(`/profile/${mentorId}`);

  const openButton = page.getByRole('button', { name: '預約設定' });
  await expect(openButton).toBeVisible({ timeout: 20_000 });
  await openButton.click();

  const scheduleDialog = page.getByRole('dialog', { name: '設定可預約時段' });
  await expect(scheduleDialog).toBeVisible({ timeout: 10_000 });

  return scheduleDialog;
}

/**
 * Open the "新增可預約時段" dialog from the schedule dialog, pick an
 * hour/minute, and confirm creation. Shared by every test that needs to add
 * a slot so the UI interaction steps aren't duplicated per test.
 */
async function createTimeSlot(
  page: Page,
  scheduleDialog: Locator,
  hourLabel: string,
  minuteLabel: string
): Promise<void> {
  await scheduleDialog.locator('button:has(svg.lucide-plus)').click();

  const addDialog = page.getByRole('dialog', { name: '新增可預約時段' });
  await expect(addDialog).toBeVisible({ timeout: 10_000 });

  const comboboxes = addDialog.getByRole('combobox');
  await comboboxes.nth(0).click();
  await page.getByRole('option', { name: hourLabel, exact: true }).click();
  await comboboxes.nth(1).click();
  await page.getByRole('option', { name: minuteLabel, exact: true }).click();

  await addDialog.getByRole('button', { name: '30 分' }).click();
  await addDialog.getByRole('button', { name: '建立' }).click();
  await expect(addDialog).not.toBeVisible({ timeout: 5_000 });
}

test.describe('導師時段儲存與衝突攔截 E2E 測試', () => {
  test.beforeEach(async ({ page }) => {
    // Freeze environment time to July 15, 2026
    await page.clock.setFixedTime(new Date('2026-07-15T10:00:00+08:00'));

    // Mock own profile GET call
    await mockApiRoute(page, new RegExp(`/v1/users/${REAL_MENTOR_ID}`), {
      body: makeProfile(true),
    });

    // Mock reservations call
    await mockApiRoute(
      page,
      new RegExp(`/v1/users/${REAL_MENTOR_ID}/reservations`),
      { body: { code: '0', msg: 'ok', data: { reservations: [] } } }
    );
  });

  test('導師調整時段並儲存成功後看到更新後的時段', async ({ page }) => {
    await setupTestSession(page, true);

    // Initial empty schedule segments for July 2026
    await mockApiRoute(
      page,
      new RegExp(`/v1/mentors/${REAL_MENTOR_ID}/schedule/y/2026/m/7`),
      { body: { code: '0', msg: 'ok', data: { segments: [] } } }
    );

    // Mock successful save (PUT schedule)
    let savedBody: { timeslots: { dtstart: number }[] } | null = null;
    await page.route(
      new RegExp(`/v1/mentors/${REAL_MENTOR_ID}/schedule`),
      async (route) => {
        if (route.request().method() === 'PUT') {
          savedBody = await route.request().postDataJSON();
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ code: '0', msg: 'ok', data: null }),
          });
        }
        // Hand off to the mockApiRoute GET handler registered above for this
        // same path prefix - route.continue() would instead send it to the
        // real network, since Playwright checks routes newest-first.
        return route.fallback();
      }
    );

    const scheduleDialog = await openScheduleDialog(page, REAL_MENTOR_ID);

    // Select date 2026-07-17
    await selectCalendarDate(scheduleDialog, '2026-07-17');

    // Add slot
    await createTimeSlot(page, scheduleDialog, '15', '00');

    // Click "儲存"
    await scheduleDialog.getByRole('button', { name: '儲存' }).click();

    // Dialog should close on success
    await expect(scheduleDialog).not.toBeVisible({ timeout: 15_000 });

    // Verify that the payload contains the added slot
    expect(savedBody).not.toBeNull();
    expect(savedBody!.timeslots).toHaveLength(1);
    expect(savedBody!.timeslots[0].dtstart).toBe(1784271600); // 2026-07-17 15:00:00 Asia/Taipei
  });

  test('儲存時段遇到衝突時顯示衝突提示且時段不被清空', async ({ page }) => {
    await setupTestSession(page, true);

    // Initial empty schedule segments
    await mockApiRoute(
      page,
      new RegExp(`/v1/mentors/${REAL_MENTOR_ID}/schedule/y/2026/m/7`),
      { body: { code: '0', msg: 'ok', data: { segments: [] } } }
    );

    // Mock failed save with CONFLICT error code and message
    await page.route(
      new RegExp(`/v1/mentors/${REAL_MENTOR_ID}/schedule`),
      async (route) => {
        if (route.request().method() === 'PUT') {
          return route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              code: 'CONFLICT',
              message: 'Conflict overlap error',
            }),
          });
        }
        return route.fallback();
      }
    );

    const scheduleDialog = await openScheduleDialog(page, REAL_MENTOR_ID);

    await selectCalendarDate(scheduleDialog, '2026-07-17');

    await createTimeSlot(page, scheduleDialog, '15', '00');

    // Click "儲存" which will fail due to conflict
    await scheduleDialog.getByRole('button', { name: '儲存' }).click();

    // Verify conflict error toast is shown
    const toast = page.getByText('此時段與既有預約衝突,請新增新時段後再試');
    await expect(toast).toBeVisible({ timeout: 10_000 });

    // Dialog should NOT close
    await expect(scheduleDialog).toBeVisible();

    // Clean up
    await scheduleDialog.getByRole('button', { name: '取消' }).click();
    await expect(scheduleDialog).not.toBeVisible();
  });

  test('導師刪除既有時段並新增另一時段後儲存成功', async ({ page }) => {
    await setupTestSession(page, true);

    const EXISTING_SLOT_ID = 99;
    const EXISTING_DTSTART = 1784253600; // 2026-07-17 10:00:00 Asia/Taipei
    const EXISTING_DTEND = 1784255400; // 2026-07-17 10:30:00 Asia/Taipei

    // Initial schedule already has one existing slot on 2026-07-17
    await mockApiRoute(
      page,
      new RegExp(`/v1/mentors/${REAL_MENTOR_ID}/schedule/y/2026/m/7`),
      {
        body: {
          code: '0',
          msg: 'ok',
          data: {
            segments: [
              {
                id: EXISTING_SLOT_ID,
                user_id: Number(REAL_MENTOR_ID),
                dt_type: 'ALLOW',
                dt_year: 2026,
                dt_month: 7,
                dtstart: EXISTING_DTSTART,
                dtend: EXISTING_DTEND,
                timezone: 'UTC',
              },
            ],
          },
        },
      }
    );

    let savedBody: { timeslots: { dtstart: number }[] } | null = null;
    let deleteRequestUrl: string | null = null;
    await page.route(
      new RegExp(`/v1/mentors/${REAL_MENTOR_ID}/schedule`),
      async (route) => {
        const method = route.request().method();
        if (method === 'PUT') {
          savedBody = await route.request().postDataJSON();
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ code: '0', msg: 'ok', data: null }),
          });
        }
        if (method === 'DELETE') {
          deleteRequestUrl = route.request().url();
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ code: '0', msg: 'ok', data: null }),
          });
        }
        return route.fallback();
      }
    );

    const scheduleDialog = await openScheduleDialog(page, REAL_MENTOR_ID);

    await selectCalendarDate(scheduleDialog, '2026-07-17');

    // Delete the existing 10:00 – 10:30 slot
    const existingSlotContainer = scheduleDialog
      .locator('[role="button"]')
      .filter({ hasText: '10:00 – 10:30' });
    await existingSlotContainer.locator('button:has(svg.lucide-x)').click();

    // Add a new slot at 15:00
    await createTimeSlot(page, scheduleDialog, '15', '00');

    // Click "儲存"
    await scheduleDialog.getByRole('button', { name: '儲存' }).click();

    // Dialog should close on success
    await expect(scheduleDialog).not.toBeVisible({ timeout: 15_000 });

    // The new slot was saved
    expect(savedBody).not.toBeNull();
    expect(savedBody!.timeslots).toHaveLength(1);
    expect(savedBody!.timeslots[0].dtstart).toBe(1784271600); // 2026-07-17 15:00:00 Asia/Taipei

    // The existing slot was deleted
    expect(deleteRequestUrl).not.toBeNull();
    expect(deleteRequestUrl).toContain(
      `/v1/mentors/${REAL_MENTOR_ID}/schedule/${EXISTING_SLOT_ID}`
    );
  });
});
