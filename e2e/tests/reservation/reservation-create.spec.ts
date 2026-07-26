import { expect, Page, test } from '@playwright/test';

import { mockApiRoute } from '../../helpers/route';
import { setSignedSessionCookie } from '../../helpers/session';

// Static, valid user IDs from the dev/staging BFF database
const REAL_MENTOR_ID = '7468899508961767'; // Jonas Lo (Mentor)
const REAL_MENTEE_ID = '7462904718734737'; // Visitor (Mentee)

const timeFormat: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
  timeZone: 'Asia/Taipei',
};

// Deterministic mock schedule parameters using frozen clock in July 2026
const DATE_KEY = '2026-07-17';
// 2026-07-17 15:00:00 in Asia/Taipei timezone is 1784281200 unix seconds
const DTSTART = 1784281200;
const DTEND = 1784284800; // 1 hour slot, 16:00:00

// Second slot: 2026-07-17 17:00:00 in Asia/Taipei (1784288400)
const DTSTART2 = 1784288400;
const DTEND2 = 1784292000; // 1 hour slot, 18:00:00

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

async function mockSessionGet(page: Page, isMentor: boolean): Promise<void> {
  await page.route(/\/api\/auth\/session/, (route) => {
    if (route.request().method() === 'GET') {
      const userId = isMentor ? REAL_MENTOR_ID : REAL_MENTEE_ID;
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

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('從個人檔案頁建立預約流程', () => {
  test.beforeEach(async ({ page }) => {
    // Freeze environment time to July 15, 2026 to prevent end-of-month and timezone flakiness
    await page.clock.setFixedTime(new Date('2026-07-15T10:00:00+08:00'));
  });

  test('Mentee 選擇一個可預約時段並送出 → 顯示成功狀態且重置輸入', async ({
    page,
  }) => {
    // Sign in as mentee
    await setSignedSessionCookie(page, makeJWTPayload(REAL_MENTEE_ID, false));
    await mockSessionGet(page, false);

    // Mock schedule API
    const mockScheduleData = {
      segments: [
        {
          id: 101,
          dt_type: 'ALLOW',
          dtstart: DTSTART,
          dtend: DTEND,
          rrule: null,
          exdate: [],
        },
      ],
    };
    await mockApiRoute(
      page,
      new RegExp(`/v1/mentors/${REAL_MENTOR_ID}/schedule/y/2026/m/7`),
      { body: { code: '0', msg: 'ok', data: mockScheduleData } }
    );

    // Mock reservation POST API
    await mockApiRoute(
      page,
      new RegExp(`/v1/users/${REAL_MENTEE_ID}/reservations`),
      { body: { code: '0', msg: 'ok', data: {} } }
    );

    // Navigate to mentor profile
    await page.goto(`/profile/${REAL_MENTOR_ID}`);

    // Select the date on calendar (utilizing precise, stable YYYY-MM-DD custom attribute)
    const dayButton = page.locator(`button[data-day="${DATE_KEY}"]`);
    await expect(dayButton).toBeVisible({ timeout: 15_000 });
    await dayButton.click();

    // Find slot button and click
    const startStr = new Date(DTSTART * 1000).toLocaleTimeString(
      'en-US',
      timeFormat
    );
    const endStr = new Date(DTEND * 1000).toLocaleTimeString(
      'en-US',
      timeFormat
    );
    const slotText = `${startStr} – ${endStr}`;
    const slotButton = page.getByRole('button', { name: slotText });
    await expect(slotButton).toBeVisible();
    await slotButton.click();

    // Fill in question and submit
    const textarea = page.locator('textarea#booking-question');
    await expect(textarea).toBeVisible();
    await textarea.fill('Hello mentor, I have a question about Career path.');

    const submitButton = page.getByRole('button', { name: '預約時間' });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Assert success toast is visible (use .first() to avoid strict-mode violation with aria-live role)
    await expect(
      page.getByText('預約已送出，等待導師回復').first()
    ).toBeVisible();

    // Textarea should be reset
    await expect(textarea).toHaveValue('');
  });

  test('已被預約的時段（isBooked: true）在日曆/時段列表中不可選', async ({
    page,
  }) => {
    // Sign in as mentee
    await setSignedSessionCookie(page, makeJWTPayload(REAL_MENTEE_ID, false));
    await mockSessionGet(page, false);

    // Mock schedule API with an available slot (ALLOW) and a booked slot (ALLOW + BOOKED)
    const mockScheduleData = {
      segments: [
        {
          id: 101,
          dt_type: 'ALLOW',
          dtstart: DTSTART,
          dtend: DTEND,
          rrule: null,
          exdate: [],
        },
        {
          id: 102,
          dt_type: 'ALLOW',
          dtstart: DTSTART2,
          dtend: DTEND2,
          rrule: null,
          exdate: [],
        },
        {
          id: 103,
          dt_type: 'BOOKED',
          dtstart: DTSTART2,
          dtend: DTEND2,
          rrule: null,
          exdate: [],
        },
      ],
    };
    await mockApiRoute(
      page,
      new RegExp(`/v1/mentors/${REAL_MENTOR_ID}/schedule/y/2026/m/7`),
      { body: { code: '0', msg: 'ok', data: mockScheduleData } }
    );

    // Navigate to mentor profile
    await page.goto(`/profile/${REAL_MENTOR_ID}`);

    // Click on date
    const dayButton = page.locator(`button[data-day="${DATE_KEY}"]`);
    await expect(dayButton).toBeVisible({ timeout: 15_000 });
    await dayButton.click();

    // Verify the booked slot button is disabled
    const startStr = new Date(DTSTART2 * 1000).toLocaleTimeString(
      'en-US',
      timeFormat
    );
    const endStr = new Date(DTEND2 * 1000).toLocaleTimeString(
      'en-US',
      timeFormat
    );
    const slotText = `${startStr} – ${endStr}`;

    const slotButton = page.getByRole('button', { name: slotText });
    await expect(slotButton).toBeVisible();
    await expect(slotButton).toBeDisabled();
  });

  test('建立失敗（API 回傳非 code: "0"）→ 顯示錯誤提示且表單維持原狀', async ({
    page,
  }) => {
    // Sign in as mentee
    await setSignedSessionCookie(page, makeJWTPayload(REAL_MENTEE_ID, false));
    await mockSessionGet(page, false);

    // Mock schedule API
    const mockScheduleData = {
      segments: [
        {
          id: 101,
          dt_type: 'ALLOW',
          dtstart: DTSTART,
          dtend: DTEND,
          rrule: null,
          exdate: [],
        },
      ],
    };
    await mockApiRoute(
      page,
      new RegExp(`/v1/mentors/${REAL_MENTOR_ID}/schedule/y/2026/m/7`),
      { body: { code: '0', msg: 'ok', data: mockScheduleData } }
    );

    // Mock reservation POST API returning error
    await mockApiRoute(
      page,
      new RegExp(`/v1/users/${REAL_MENTEE_ID}/reservations`),
      {
        status: 400,
        body: { code: '400', msg: 'API error placeholder message', data: null },
      }
    );

    // Navigate to mentor profile
    await page.goto(`/profile/${REAL_MENTOR_ID}`);

    // Select date
    const dayButton = page.locator(`button[data-day="${DATE_KEY}"]`);
    await expect(dayButton).toBeVisible({ timeout: 15_000 });
    await dayButton.click();

    // Find slot button and click
    const startStr = new Date(DTSTART * 1000).toLocaleTimeString(
      'en-US',
      timeFormat
    );
    const endStr = new Date(DTEND * 1000).toLocaleTimeString(
      'en-US',
      timeFormat
    );
    const slotText = `${startStr} – ${endStr}`;
    const slotButton = page.getByRole('button', { name: slotText });
    await expect(slotButton).toBeVisible();
    await slotButton.click();

    // Fill in question and submit
    const textarea = page.locator('textarea#booking-question');
    await expect(textarea).toBeVisible();
    await textarea.fill('Hello mentor, testing error flow.');

    const submitButton = page.getByRole('button', { name: '預約時間' });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Assert error toast is visible (use .first() to avoid strict-mode violation with aria-live role)
    await expect(page.getByText('預約失敗').first()).toBeVisible();

    // Textarea should NOT be reset
    await expect(textarea).toHaveValue('Hello mentor, testing error flow.');
  });

  test('Mentor 檢視自己的個人頁 → 按鈕文案為「預約設定」且開啟的是 MentorScheduleDialog', async ({
    page,
  }) => {
    // Sign in as mentor (own profile)
    await setSignedSessionCookie(page, makeJWTPayload(REAL_MENTOR_ID, true));
    await mockSessionGet(page, true);

    // Mock schedule API
    const mockScheduleData = {
      segments: [],
    };
    await mockApiRoute(
      page,
      new RegExp(`/v1/mentors/${REAL_MENTOR_ID}/schedule/y/2026/m/7`),
      { body: { code: '0', msg: 'ok', data: mockScheduleData } }
    );

    // Navigate to own profile
    await page.goto(`/profile/${REAL_MENTOR_ID}`);

    // Button text should be "預約設定"
    const bookingButton = page.getByRole('button', { name: '預約設定' });
    await expect(bookingButton).toBeVisible({ timeout: 15_000 });

    // Click "預約設定"
    await bookingButton.click();

    // Verify that MentorScheduleDialog is open (should contain text "設定可預約時段")
    await expect(page.getByText('設定可預約時段')).toBeVisible();
  });
});
