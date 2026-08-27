import { expect, Page, test } from '@playwright/test';

import { mockApiRoute } from '../../helpers/route';
import { setSignedSessionCookie } from '../../helpers/session';

// Regression test for X-Tracker #651: before the reservation write path
// invalidated its own reads, the dashboard's reservation cache had no
// expiry, so a mentee who opened "my reservations", then booked a slot from
// a mentor's profile, then returned, still saw the pre-booking (stale)
// pending list until a full page reload. This test reproduces that
// sequence through the real UI - client-side navigation only (the header's
// "我的預約" link and the browser back button), never a hard page.goto()
// between the two surfaces - because a hard navigation would itself reset
// the in-memory cache and mask the bug regardless of whether the fix is
// present.
test.use({ timezoneId: 'Asia/Taipei' });

const REAL_MENTOR_ID = '7468899508961767'; // Jonas Lo (Mentor) - shared dev/staging fixture, see reservation-create.spec.ts
const REAL_MENTEE_ID = '7482008160728085'; // testing_visitor (Mentee)

const DATE_KEY = '2026-07-17';
const DTSTART = 1784281200; // 2026-07-17 15:00 Asia/Taipei
const DTEND = 1784284800; // 16:00

const timeFormat: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
  timeZone: 'Asia/Taipei',
};

function makeJWTPayload(userId: string) {
  return {
    id: userId,
    name: 'Test Mentee',
    isMentor: false,
    onBoarding: true,
    jobTitle: 'Software Engineer',
    company: 'Own Company',
    personalLinks: [],
    token: 'mock-access-token',
  };
}

async function setupMenteeSession(page: Page): Promise<void> {
  await setSignedSessionCookie(page, makeJWTPayload(REAL_MENTEE_ID));

  await page.route(/\/api\/auth\/session/, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: REAL_MENTEE_ID,
            name: 'Test Mentee',
            isMentor: false,
            onBoarding: true,
            jobTitle: 'Software Engineer',
            company: 'Own Company',
            personalLinks: [],
          },
          accessToken: 'mock-access-token',
          expires: '2099-01-01T00:00:00.000Z',
        }),
      });
    }
    return route.continue();
  });
}

async function mockMentorSchedule(page: Page): Promise<void> {
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
              id: 101,
              dt_type: 'ALLOW',
              dtstart: DTSTART,
              dtend: DTEND,
              rrule: null,
              exdate: [],
            },
          ],
        },
      },
    }
  );
}

/**
 * Mocks both the reservation list GET (all three MENTEE_* states) and the
 * booking POST for `REAL_MENTEE_ID`, sharing one `booked` flag: MENTEE_PENDING
 * returns empty until the POST succeeds, then returns the freshly booked
 * reservation - so the "before" and "after" the flow reads through the same
 * stateful mock a real backend would produce.
 */
async function mockMenteeReservations(page: Page): Promise<void> {
  let booked = false;

  const bookedReservation = {
    id: 555111,
    sender: {
      user_id: Number(REAL_MENTEE_ID),
      role: 'MENTEE',
      status: 'PENDING',
      name: 'Test Mentee',
      avatar: '',
      job_title: '',
      years_of_experience: '',
    },
    participant: {
      user_id: Number(REAL_MENTOR_ID),
      role: 'MENTOR',
      status: 'PENDING',
      name: 'Jonas Lo',
      avatar: '',
      job_title: '',
      years_of_experience: '',
    },
    schedule_id: 101,
    dtstart: DTSTART,
    dtend: DTEND,
    previous_reserve: null,
    messages: [],
  };

  await page.route(
    new RegExp(`/v1/users/${REAL_MENTEE_ID}/reservations`),
    (route) => {
      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods':
              'GET, POST, PUT, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
      }

      if (route.request().method() === 'POST') {
        booked = true;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ code: '0', msg: 'ok', data: { id: 555111 } }),
        });
      }

      const url = new URL(route.request().url());
      const state = url.searchParams.get('state') ?? '';
      const reservations =
        state === 'MENTEE_PENDING' && booked ? [bookedReservation] : [];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          code: '0',
          msg: 'ok',
          data: { reservations, next_dtend: 0 },
        }),
      });
    }
  );
}

async function openUserMenu(page: Page): Promise<void> {
  await page.getByRole('button', { name: /開啟用戶選單/ }).click();
}

async function goToMyReservations(page: Page): Promise<void> {
  await openUserMenu(page);
  await page.getByRole('menuitem', { name: '我的預約' }).click();
  await expect(page).toHaveURL(/\/reservation\/mentee/);
}

async function selectCalendarDate(page: Page, dateKey: string): Promise<void> {
  const dayButton = page.getByTestId(`day-${dateKey}`);
  await expect(dayButton).toBeVisible({ timeout: 15_000 });
  await dayButton.click();
}

test.describe('預約流程：從個人檔案頁預約後返回「我的預約」', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-07-15T10:00:00+08:00'));
  });

  test('Mentee 開啟我的預約（空）→ 於導師頁完成預約 → 返回我的預約 → pending 列表立即顯示新預約', async ({
    page,
  }) => {
    await setupMenteeSession(page);
    await mockMentorSchedule(page);
    await mockMenteeReservations(page);

    // Land on the mentor's profile first - a hard navigation, but nothing is
    // cached yet at this point so it can't mask anything. Tag the JS realm so
    // every subsequent hop can assert it's still the same one: the whole
    // point of this test is that the bug (and the fix) only exist across
    // client-side navigation, so a hidden fallback to a hard reload anywhere
    // below must fail loudly here instead of silently passing for the wrong
    // reason.
    await page.goto(`/profile/${REAL_MENTOR_ID}`);
    await page.evaluate(() => {
      (
        window as unknown as { __e2eSessionMarker?: string }
      ).__e2eSessionMarker = 'alive';
    });
    await selectCalendarDate(page, DATE_KEY);

    // Client-side navigate to the dashboard: this is what actually primes
    // the in-memory MENTEE_PENDING cache with the pre-booking (empty) page.
    await goToMyReservations(page);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { __e2eSessionMarker?: string })
              .__e2eSessionMarker
        )
      )
      .toBe('alive');
    await expect(page.getByRole('tab', { name: /等待回復/ })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('tab', { name: /等待回復/ }).click();
    await expect(page.getByText('目前尚無資料')).toBeVisible({
      timeout: 10_000,
    });

    // Browser back is a same-document, client-side transition here (the
    // dashboard was reached via router.push, not page.goto), so the cache
    // primed above survives this hop too.
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/profile/${REAL_MENTOR_ID}`));
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { __e2eSessionMarker?: string })
              .__e2eSessionMarker
        )
      )
      .toBe('alive');
    await selectCalendarDate(page, DATE_KEY);

    const startStr = new Date(DTSTART * 1000).toLocaleTimeString(
      'en-US',
      timeFormat
    );
    const endStr = new Date(DTEND * 1000).toLocaleTimeString(
      'en-US',
      timeFormat
    );
    const slotButton = page.getByRole('button', {
      name: `${startStr} – ${endStr}`,
    });
    await expect(slotButton).toBeVisible();
    await slotButton.click();

    const textarea = page.locator('textarea#booking-question');
    await expect(textarea).toBeVisible();
    await textarea.fill('Hello mentor, testing the booking-then-return flow.');

    const submitButton = page.getByRole('button', { name: '預約時間' });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    await expect(
      page.getByText('預約已送出，等待導師回復').first()
    ).toBeVisible();

    // Return to the dashboard the same way the mentee would - through the
    // header, not a fresh page load - and the previously-empty pending tab
    // must now reflect the booking without a manual reload.
    await goToMyReservations(page);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { __e2eSessionMarker?: string })
              .__e2eSessionMarker
        )
      )
      .toBe('alive');
    await page.getByRole('tab', { name: /等待回復/ }).click();
    await expect(page.getByText('Jonas Lo')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('目前尚無資料')).not.toBeVisible();
  });
});
