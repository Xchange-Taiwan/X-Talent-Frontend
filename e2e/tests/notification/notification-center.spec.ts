import { expect, Page, test } from '@playwright/test';
import type { Session } from 'next-auth';

import type { components } from '@/types/api';

import { setSignedSessionCookie as setSharedSessionCookie } from '../../helpers/session';

type NotificationVO = components['schemas']['NotificationVO'];

// read_at is a unix timestamp (seconds) per NotificationVO, not an ISO string.
const READ_AT_UNIX = Math.floor(
  new Date('2024-01-01T00:00:00.000Z').getTime() / 1000
);

const USER_ID = '123'; // Matches standard mentee test login ID
const PAGE_URL = '/'; // Notification bell lives in the header of the main/home layout

// --- Mock Payloads ---

const MENTOR_USER_ID = '999000111'; // Fully mocked session identity - no real account needed

function makeSession(isMentor: boolean): Session {
  return {
    user: {
      id: isMentor ? MENTOR_USER_ID : USER_ID,
      name: isMentor ? 'Test Mentor' : 'Test Mentee',
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

function makeNotificationVO(
  id: string,
  type: string,
  unread: boolean,
  counterparty: string,
  role: 'mentor' | 'mentee'
): NotificationVO {
  return {
    id: Number(id),
    type,
    read_at: unread ? null : READ_AT_UNIX,
    created_at: Math.floor(Date.now() / 1000),
    metadata: {
      role,
      counterparty_name: counterparty,
    },
  };
}

// --- Helpers ---

async function loginAs(page: Page, isMentor: boolean) {
  const session = makeSession(isMentor);
  await setSharedSessionCookie(page, {
    ...session.user,
    // makeSession always sets these concretely; they're only optional on
    // Session['user'] because next-auth's own type allows it in general.
    id: session.user.id!,
    name: session.user.name!,
    onBoarding: session.user.onBoarding!,
    isMentor: session.user.isMentor!,
    token: 'mock-access-token',
  });
  await page.route(/\/api\/auth\/session/, (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session),
    });
  });
}

async function mockUnreadCount(page: Page, count: number) {
  await page.route(/\/v1\/users\/.*\/notifications\/unread-count/, (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: '0', msg: 'ok', data: { count } }),
    });
  });
}

async function mockNotificationList(
  page: Page,
  notifications: ReturnType<typeof makeNotificationVO>[]
) {
  await page.route(/\/v1\/users\/.*\/notifications(\?|$)/, (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: '0',
        msg: 'ok',
        data: {
          notifications,
          next_cursor: null,
        },
      }),
    });
  });
}

/**
 * Logs in as a mentee with a single unread "reservation accepted"
 * notification from 'Mentor Wang' already mocked - the setup shared by
 * every test that just needs one notification to interact with.
 */
async function setupMenteeWithNotification(
  page: Page,
  notificationId: string
): Promise<ReturnType<typeof makeNotificationVO>> {
  const notif = makeNotificationVO(
    notificationId,
    'reservation_success',
    true,
    'Mentor Wang',
    'mentee'
  );
  await loginAs(page, false);
  await mockUnreadCount(page, 1);
  await mockNotificationList(page, [notif]);
  return notif;
}

// --- Tests ---

test.describe('Notification Center E2E Tests', () => {
  test('Empty state when zero notifications', async ({ page }) => {
    await loginAs(page, false);
    await mockUnreadCount(page, 0);
    await mockNotificationList(page, []);

    await page.goto(PAGE_URL);

    const bell = page.getByRole('button', { name: '開啟通知選單' });
    await expect(bell).toBeVisible();
    await bell.click();

    await expect(page.getByText('尚無新通知')).toBeVisible();
  });

  test('Unread badge count optimistic updates when marking as read', async ({
    page,
  }) => {
    const mockNotif = await setupMenteeWithNotification(page, '101');

    // Hold the PUT response pending indefinitely until the test explicitly
    // releases it. This is what actually distinguishes "optimistic update"
    // from "waited for the response": with a fixed delay, expect(...).not
    // .toBeVisible()'s own retry window (5s) would swallow the difference
    // and pass either way once the delay elapses.
    let releasePut!: () => void;
    const putHeld = new Promise<void>((resolve) => {
      releasePut = resolve;
    });
    await page.route(/\/v1\/users\/.*\/notifications\/101/, async (route) => {
      if (route.request().method() === 'PUT') {
        await putHeld;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: { ...mockNotif, read_at: READ_AT_UNIX },
          }),
        });
      }
      return route.continue();
    });

    await page.goto(PAGE_URL);

    const bell = page.getByRole('button', { name: '開啟通知選單' });
    await expect(bell).toBeVisible();

    const badge = page.locator('[aria-label*="則未讀通知"]').first();
    await expect(badge).toHaveText('1');

    await bell.click();

    const markReadRequest = page.waitForRequest(
      (req) =>
        req.url().includes('/notifications/101') && req.method() === 'PUT'
    );
    await page.getByText('Mentor Wang 已接受您的預約').click();
    await markReadRequest;

    try {
      // The PUT response is still genuinely pending here - if the badge is
      // already gone, that can only be an optimistic update, since the real
      // response can never arrive until releasePut() is called.
      await expect(badge).not.toBeVisible();
    } finally {
      // Always release, even on assertion failure - otherwise the held
      // route never resolves and leaves a dangling pending request.
      releasePut();
    }
  });

  test('On API failure (500), verify unread state rolls back cleanly and shows error toast', async ({
    page,
  }) => {
    await setupMenteeWithNotification(page, '102');

    await page.route(/\/v1\/users\/.*\/notifications\/102/, (route) => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Internal Server Error' }),
        });
      }
      return route.continue();
    });

    await page.goto(PAGE_URL);

    const bell = page.getByRole('button', { name: '開啟通知選單' });
    await bell.click();
    await page.getByText('Mentor Wang 已接受您的預約').click();

    // Toast message for error with first() to avoid strict mode violations on duplicate elements
    await expect(
      page.getByText('無法將通知標示為已讀，請稍後再試').first()
    ).toBeVisible();

    // Verify the unread badge rolled back and is visible again
    const badge = page.locator('[aria-label*="則未讀通知"]').first();
    await expect(badge).toHaveText('1');
  });

  test('Clicking a notification redirects to correct reservation endpoint', async ({
    page,
  }) => {
    await setupMenteeWithNotification(page, '103');

    await page.route(/\/v1\/users\/.*\/notifications\/103/, (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{}',
      });
    });

    await page.goto(PAGE_URL);
    await page.getByRole('button', { name: '開啟通知選單' }).click();
    await page.getByText('Mentor Wang 已接受您的預約').click();

    // Verify redirect endpoint
    await expect(page).toHaveURL(/\/reservation\/mentee\?tab=upcoming/);
  });

  test('Role switching logic functions cleanly', async ({ page }) => {
    // 1. Mentee mode notification
    const menteeNotif = makeNotificationVO(
      '104',
      'reservation_success',
      true,
      'Mentor Wang',
      'mentee'
    );
    await loginAs(page, false); // Mentee
    await mockUnreadCount(page, 1);
    await mockNotificationList(page, [menteeNotif]);

    await page.goto(PAGE_URL);
    await page.getByRole('button', { name: '開啟通知選單' }).click();
    await expect(page.getByText('Mentor Wang 已接受您的預約')).toBeVisible();

    // 2. Mentor mode notification
    const mentorNotif = makeNotificationVO(
      '105',
      'reservation_requested',
      true,
      'Mentee Lin',
      'mentor'
    );
    await loginAs(page, true); // Mentor
    await mockUnreadCount(page, 1);
    await mockNotificationList(page, [mentorNotif]);

    await page.goto(PAGE_URL);
    await page.getByRole('button', { name: '開啟通知選單' }).click();

    // The old (mentee) role's notification must not flash before the new
    // (mentor) role's content renders - a stale-content leak between roles.
    await expect(
      page.getByText('Mentor Wang 已接受您的預約')
    ).not.toBeVisible();
    await expect(page.getByText('您有新的預約')).toBeVisible();
  });
});
