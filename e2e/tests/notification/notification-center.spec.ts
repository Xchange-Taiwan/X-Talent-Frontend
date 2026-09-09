import { expect, Page, test } from '@playwright/test';

import { setSignedSessionCookie as setSharedSessionCookie } from '../../helpers/session';

const USER_ID = '123'; // Matches standard mentee test login ID
const PAGE_URL = '/'; // Notification bell lives in the header of the main/home layout

// --- Mock Payloads ---

const MENTOR_USER_ID = '999000111'; // Fully mocked session identity - no real account needed

function makeSession(isMentor: boolean) {
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
) {
  return {
    id,
    type,
    read_at: unread ? null : '2024-01-01T00:00:00.000Z',
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
    const mockNotif = makeNotificationVO(
      '101',
      'reservation_success',
      true,
      'Mentor Wang',
      'mentee'
    );
    await loginAs(page, false);
    await mockUnreadCount(page, 1);
    await mockNotificationList(page, [mockNotif]);

    // Mock individual read API
    await page.route(/\/v1\/users\/.*\/notifications\/101/, (route) => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: { ...mockNotif, read_at: '2024-01-01T00:00:00.000Z' },
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

    // Verify optimistic update clears the badge or decrements it
    await expect(badge).not.toBeVisible();
  });

  test('On API failure (500), verify unread state rolls back cleanly and shows error toast', async ({
    page,
  }) => {
    const mockNotif = makeNotificationVO(
      '102',
      'reservation_success',
      true,
      'Mentor Wang',
      'mentee'
    );
    await loginAs(page, false);
    await mockUnreadCount(page, 1);
    await mockNotificationList(page, [mockNotif]);

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
    const mockNotif = makeNotificationVO(
      '103',
      'reservation_success',
      true,
      'Mentor Wang',
      'mentee'
    );
    await loginAs(page, false);
    await mockUnreadCount(page, 1);
    await mockNotificationList(page, [mockNotif]);

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
