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
};

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

/**
 * Returns a future Date object in the current month.
 * This ensures the slot occurs after Date.now() and is not filtered out as a past slot,
 * whilst keeping it within the current calendar month view.
 */
function getFutureTimestamp(): Date {
  const now = new Date();
  const lastDayOfCurrentMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0
  ).getDate();

  let targetDate = now.getDate() + 1;
  let targetHour = 15; // 3:00 PM

  if (targetDate > lastDayOfCurrentMonth) {
    // Today is the last day of the month. Use today but 2 hours in the future.
    targetDate = now.getDate();
    targetHour = now.getHours() + 2;
    if (targetHour >= 24) {
      targetHour = 23; // Clamp to end of day
    }
  }

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    targetDate,
    targetHour,
    0,
    0
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('從個人檔案頁建立預約流程', () => {
  test('Mentee 選擇一個可預約時段並送出 → 顯示成功狀態且重置輸入', async ({
    page,
  }) => {
    const futureDate = getFutureTimestamp();
    const year = futureDate.getFullYear();
    const month = futureDate.getMonth() + 1;

    const dtstart = Math.floor(futureDate.getTime() / 1000);
    const dtend = dtstart + 3600; // 1 hour slot

    // Sign in as mentee
    await setSignedSessionCookie(page, makeJWTPayload(REAL_MENTEE_ID, false));
    await mockSessionGet(page, false);

    // Mock schedule API
    const mockScheduleData = {
      segments: [
        {
          id: 101,
          dt_type: 'ALLOW',
          dtstart,
          dtend,
          rrule: null,
          exdate: [],
        },
      ],
    };
    await mockApiRoute(
      page,
      new RegExp(`/v1/mentors/${REAL_MENTOR_ID}/schedule/y/${year}/m/${month}`),
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

    // Select the date on calendar (evaluating in browser context to get exact local string format)
    const dataDayValue = await page.evaluate((ms) => {
      return new Date(ms).toLocaleDateString();
    }, futureDate.getTime());
    const dayButton = page.locator(`button[data-day="${dataDayValue}"]`);
    await expect(dayButton).toBeVisible({ timeout: 15_000 });
    await dayButton.click();

    // Find slot button and click
    const startStr = futureDate.toLocaleTimeString('en-US', timeFormat);
    const endStr = new Date(
      futureDate.getTime() + 3600 * 1000
    ).toLocaleTimeString('en-US', timeFormat);
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
    const futureDate = getFutureTimestamp();
    const year = futureDate.getFullYear();
    const month = futureDate.getMonth() + 1;

    // First slot: ALLOW only (available, so the day itself remains enabled)
    const dtstart = Math.floor(futureDate.getTime() / 1000);
    const dtend = dtstart + 3600;

    // Second slot: ALLOW + BOOKED (already booked, should show as disabled in timeslot list)
    const dtstart2 = dtstart + 7200; // 2 hours later
    const dtend2 = dtstart2 + 3600;

    // Sign in as mentee
    await setSignedSessionCookie(page, makeJWTPayload(REAL_MENTEE_ID, false));
    await mockSessionGet(page, false);

    // Mock schedule API
    const mockScheduleData = {
      segments: [
        {
          id: 101,
          dt_type: 'ALLOW',
          dtstart,
          dtend,
          rrule: null,
          exdate: [],
        },
        {
          id: 102,
          dt_type: 'ALLOW',
          dtstart: dtstart2,
          dtend: dtend2,
          rrule: null,
          exdate: [],
        },
        {
          id: 103,
          dt_type: 'BOOKED',
          dtstart: dtstart2,
          dtend: dtend2,
          rrule: null,
          exdate: [],
        },
      ],
    };
    await mockApiRoute(
      page,
      new RegExp(`/v1/mentors/${REAL_MENTOR_ID}/schedule/y/${year}/m/${month}`),
      { body: { code: '0', msg: 'ok', data: mockScheduleData } }
    );

    // Navigate to mentor profile
    await page.goto(`/profile/${REAL_MENTOR_ID}`);

    // Click on date (evaluating in browser context to get exact local string format)
    const dataDayValue = await page.evaluate((ms) => {
      return new Date(ms).toLocaleDateString();
    }, futureDate.getTime());
    const dayButton = page.locator(`button[data-day="${dataDayValue}"]`);
    await expect(dayButton).toBeVisible({ timeout: 15_000 });
    await dayButton.click();

    // Verify the booked slot button is disabled
    const startStr = new Date(dtstart2 * 1000).toLocaleTimeString(
      'en-US',
      timeFormat
    );
    const endStr = new Date(dtend2 * 1000).toLocaleTimeString(
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
    const futureDate = getFutureTimestamp();
    const year = futureDate.getFullYear();
    const month = futureDate.getMonth() + 1;

    const dtstart = Math.floor(futureDate.getTime() / 1000);
    const dtend = dtstart + 3600; // 1 hour slot

    // Sign in as mentee
    await setSignedSessionCookie(page, makeJWTPayload(REAL_MENTEE_ID, false));
    await mockSessionGet(page, false);

    // Mock schedule API
    const mockScheduleData = {
      segments: [
        {
          id: 101,
          dt_type: 'ALLOW',
          dtstart,
          dtend,
          rrule: null,
          exdate: [],
        },
      ],
    };
    await mockApiRoute(
      page,
      new RegExp(`/v1/mentors/${REAL_MENTOR_ID}/schedule/y/${year}/m/${month}`),
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

    // Select date (evaluating in browser context to get exact local string format)
    const dataDayValue = await page.evaluate((ms) => {
      return new Date(ms).toLocaleDateString();
    }, futureDate.getTime());
    const dayButton = page.locator(`button[data-day="${dataDayValue}"]`);
    await expect(dayButton).toBeVisible({ timeout: 15_000 });
    await dayButton.click();

    // Find slot button and click
    const startStr = futureDate.toLocaleTimeString('en-US', timeFormat);
    const endStr = new Date(
      futureDate.getTime() + 3600 * 1000
    ).toLocaleTimeString('en-US', timeFormat);
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
    const futureDate = getFutureTimestamp();
    const year = futureDate.getFullYear();
    const month = futureDate.getMonth() + 1;

    // Sign in as mentor (own profile)
    await setSignedSessionCookie(page, makeJWTPayload(REAL_MENTOR_ID, true));
    await mockSessionGet(page, true);

    // Mock schedule API
    const mockScheduleData = {
      segments: [],
    };
    await mockApiRoute(
      page,
      new RegExp(`/v1/mentors/${REAL_MENTOR_ID}/schedule/y/${year}/m/${month}`),
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
