import { expect, Page, test } from '@playwright/test';
import dayjs from 'dayjs';

import type { components } from '@/types/api';

import { captureEvidence } from '../../helpers/evidence';
import { seedMockAuthSession } from '../../helpers/session';

type NotificationVO = components['schemas']['NotificationVO'];

// read_at is a unix timestamp (seconds) per NotificationVO, not an ISO string.
const READ_AT_UNIX = Math.floor(
  new Date('2024-01-01T00:00:00.000Z').getTime() / 1000
);

const USER_ID = '123'; // Matches standard mentee test login ID
const PAGE_URL = '/'; // Notification bell lives in the header of the main/home layout

// --- Mock Payloads ---

const MENTOR_USER_ID = '999000111'; // Fully mocked session identity - no real account needed

function makeNotificationVO(
  id: string,
  type: string,
  unread: boolean,
  counterparty: string,
  role: 'mentor' | 'mentee',
  extraMetadata: {
    actor_role?: 'mentor' | 'mentee' | 'system';
    dtstart?: number;
    dtend?: number;
  } = {}
): NotificationVO {
  return {
    id: Number(id),
    type,
    read_at: unread ? null : READ_AT_UNIX,
    created_at: Math.floor(Date.now() / 1000),
    metadata: {
      role,
      counterparty_name: counterparty,
      ...extraMetadata,
    },
  };
}

// --- Helpers ---

async function seedNotificationRole(page: Page, isMentor: boolean) {
  await seedMockAuthSession(page, {
    id: isMentor ? MENTOR_USER_ID : USER_ID,
    name: isMentor ? 'Test Mentor' : 'Test Mentee',
    isMentor,
    onBoarding: true,
  });
}

async function mockUnreadCount(page: Page, count: number) {
  await page.route(/\/v1\/users\/.*\/notifications\/unread-count/, (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: '0',
        msg: 'ok',
        data: { unread_count: count },
      }),
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
  await seedNotificationRole(page, false);
  await mockUnreadCount(page, 1);
  await mockNotificationList(page, [notif]);
  return notif;
}

// --- Tests ---

test.describe('Notification Center E2E Tests', () => {
  test('Empty state when zero notifications', async ({ page }) => {
    await seedNotificationRole(page, false);
    await mockUnreadCount(page, 0);
    await mockNotificationList(page, []);

    await page.goto(PAGE_URL);

    const bell = page.getByRole('button', { name: '開啟通知選單' });
    await expect(bell).toBeVisible();
    await bell.click();

    await expect(page.getByText('尚無新通知')).toBeVisible();
  });

  test('Deduplicates unread-count bootstrap across desktop/mobile Header bells and recovers via unified retry (#879)', async ({
    page,
  }) => {
    const recoveredNotif = makeNotificationVO(
      '100',
      'reservation_success',
      true,
      'Mentor Wang',
      'mentee'
    );
    await seedNotificationRole(page, false);

    let unreadCountRequests = 0;
    let listRequests = 0;

    await page.route(
      /\/v1\/users\/.*\/notifications\/unread-count/,
      (route) => {
        unreadCountRequests += 1;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: { unread_count: 1 },
          }),
        });
      }
    );

    await page.route(/\/v1\/users\/.*\/notifications(\?|$)/, (route) => {
      listRequests += 1;
      if (listRequests === 1) {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Temporary Server Error' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: '0',
          msg: 'ok',
          data: {
            notifications: [recoveredNotif],
            next_cursor: null,
          },
        }),
      });
    });

    await page.goto(PAGE_URL);

    const bell = page.getByRole('button', { name: '開啟通知選單' });
    await expect(bell).toBeVisible();
    const badge = bell.locator('[aria-label*="則未讀通知"]');
    await expect(badge).toHaveText('1');

    // Desktop + mobile NotificationBell instances share NotificationStoreManager:
    // mount bootstrap fires unread-count exactly once and defers list fetch until open.
    expect(unreadCountRequests).toBe(1);
    expect(listRequests).toBe(0);

    await bell.click();
    await expect(page.getByText('載入失敗，請重試')).toBeVisible();

    await page.getByRole('button', { name: '重新嘗試' }).click();
    await expect(page.getByText('Mentor Wang 已接受您的預約')).toBeVisible();

    await captureEvidence(page, 'notification-bell-open');
  });

  test('Unread badge count optimistic updates when marking as read', async ({
    page,
  }) => {
    const mockNotif = await setupMenteeWithNotification(page, '101');

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

    const badge = bell.locator('[aria-label*="則未讀通知"]');
    await expect(badge).toHaveText('1');

    try {
      await bell.click();

      const markReadRequest = page.waitForRequest(
        (req) =>
          req.url().includes('/notifications/101') && req.method() === 'PUT'
      );
      await page.getByText('Mentor Wang 已接受您的預約').click();
      await markReadRequest;

      await expect(badge).not.toBeVisible();
    } finally {
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

    await expect(
      page.getByText('無法將通知標示為已讀，請稍後再試').first()
    ).toBeVisible();

    let releaseRefresh!: () => void;
    const refreshHeld = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    await page.route(/\/v1\/users\/.*\/notifications(\?|$)/, async (route) => {
      await refreshHeld;
      return route.fallback();
    });

    try {
      await bell.click();
      await expect(page.getByText('Mentor Wang 已接受您的預約')).toHaveClass(
        /font-bold/
      );
    } finally {
      releaseRefresh();
    }
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

    await expect(page).toHaveURL(/\/reservation\/mentee\?tab=upcoming/);
  });

  test('Role switching logic functions cleanly', async ({ page }) => {
    const menteeNotif = makeNotificationVO(
      '104',
      'reservation_success',
      true,
      'Mentor Wang',
      'mentee'
    );
    await seedNotificationRole(page, false); // Mentee
    await mockUnreadCount(page, 1);
    await mockNotificationList(page, [menteeNotif]);

    await page.goto(PAGE_URL);
    await page.getByRole('button', { name: '開啟通知選單' }).click();
    await expect(page.getByText('Mentor Wang 已接受您的預約')).toBeVisible();

    const mentorNotif = makeNotificationVO(
      '105',
      'reservation_requested',
      true,
      'Mentee Lin',
      'mentor'
    );
    await seedNotificationRole(page, true); // Mentor
    await mockUnreadCount(page, 1);
    await mockNotificationList(page, [mentorNotif]);

    await page.goto(PAGE_URL);
    await page.getByRole('button', { name: '開啟通知選單' }).click();

    await expect(
      page.getByText('Mentor Wang 已接受您的預約')
    ).not.toBeVisible();
    await expect(page.getByText('您有新的預約')).toBeVisible();
  });

  test('reservation_upcoming notification with metadata.dtstart renders formatted meeting time (YYYY/MM/DD HH:mm)', async ({
    page,
  }) => {
    const dtstart = 1755000000;
    const formattedTime = dayjs.unix(dtstart).format('YYYY/MM/DD HH:mm');
    const upcomingNotif = makeNotificationVO(
      '106',
      'reservation_upcoming',
      true,
      'Mentor Wang',
      'mentee',
      { dtstart, dtend: dtstart + 1800 }
    );

    await seedNotificationRole(page, false);
    await mockUnreadCount(page, 1);
    await mockNotificationList(page, [upcomingNotif]);

    await page.goto(PAGE_URL);
    await page.getByRole('button', { name: '開啟通知選單' }).click();

    await expect(
      page.getByText('您與 Mentor Wang 的預約即將到來')
    ).toBeVisible();
    await expect(
      page.getByText(
        `您與 Mentor Wang 的會議即將在 ${formattedTime} 開始，請準時上線`
      )
    ).toBeVisible();
  });

  test('reservation_canceled with actor_role system renders mentee auto-cancel copy and redirects to /mentor-pool', async ({
    page,
  }) => {
    const menteeAutoCancelNotif = makeNotificationVO(
      '107',
      'reservation_canceled',
      true,
      'Mentor Chen',
      'mentee',
      { actor_role: 'system' }
    );

    await seedNotificationRole(page, false);
    await mockUnreadCount(page, 1);
    await mockNotificationList(page, [menteeAutoCancelNotif]);

    await page.route(/\/v1\/users\/.*\/notifications\/107/, (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: '0',
          msg: 'ok',
          data: { ...menteeAutoCancelNotif, read_at: READ_AT_UNIX },
        }),
      });
    });

    await page.goto(PAGE_URL);
    await page.getByRole('button', { name: '開啟通知選單' }).click();

    await expect(
      page.getByText('您與 Mentor Chen 的預約已自動取消')
    ).toBeVisible();
    await expect(
      page.getByText(
        '因導師未於預約開始前 24 小時前確認，系統已自動取消此預約，歡迎重新預約'
      )
    ).toBeVisible();

    await page.getByText('您與 Mentor Chen 的預約已自動取消').click();
    await expect(page).toHaveURL(/\/mentor-pool/);
  });

  test('reservation_canceled with actor_role system renders mentor auto-cancel copy and redirects to /reservation/mentor?tab=history', async ({
    page,
  }) => {
    const mentorAutoCancelNotif = makeNotificationVO(
      '108',
      'reservation_canceled',
      true,
      'Mentee Lin',
      'mentor',
      { actor_role: 'system' }
    );

    await seedNotificationRole(page, true);
    await mockUnreadCount(page, 1);
    await mockNotificationList(page, [mentorAutoCancelNotif]);

    await page.route(/\/v1\/users\/.*\/notifications\/108/, (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: '0',
          msg: 'ok',
          data: { ...mentorAutoCancelNotif, read_at: READ_AT_UNIX },
        }),
      });
    });

    await page.goto(PAGE_URL);
    await page.getByRole('button', { name: '開啟通知選單' }).click();

    await expect(
      page.getByText('您與 Mentee Lin 的預約已自動取消')
    ).toBeVisible();
    await expect(
      page.getByText('因您未於預約開始前 24 小時前確認，系統已自動取消此預約')
    ).toBeVisible();

    await page.getByText('您與 Mentee Lin 的預約已自動取消').click();
    await expect(page).toHaveURL(/\/reservation\/mentor\?tab=history/);
  });

  test('reservation_canceled (non-system) renders mentor-perspective copy for mentor and mentee rebooking copy for mentee (#858)', async ({
    page,
  }) => {
    const mentorCancelNotif = makeNotificationVO(
      '110',
      'reservation_canceled',
      true,
      'Mentee Lin',
      'mentor',
      { actor_role: 'mentee' }
    );

    await seedNotificationRole(page, true);
    await mockUnreadCount(page, 1);
    await mockNotificationList(page, [mentorCancelNotif]);

    await page.route(/\/v1\/users\/.*\/notifications\/110/, (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: '0',
          msg: 'ok',
          data: { ...mentorCancelNotif, read_at: READ_AT_UNIX },
        }),
      });
    });

    await page.goto(PAGE_URL);
    await page.getByRole('button', { name: '開啟通知選單' }).click();

    await expect(
      page.getByText('您與 Mentee Lin 的預約已被取消')
    ).toBeVisible();
    await expect(
      page.getByText('學員已取消此次預約，點擊查看預約紀錄')
    ).toBeVisible();
    await expect(
      page.getByText('您的預約已被取消，歡迎重新預約')
    ).not.toBeVisible();

    await page.getByText('您與 Mentee Lin 的預約已被取消').click();
    await expect(page).toHaveURL(/\/reservation\/mentor\?tab=history/);

    const menteeCancelNotif = makeNotificationVO(
      '111',
      'reservation_canceled',
      true,
      'Mentor Chen',
      'mentee',
      { actor_role: 'mentor' }
    );
    await seedNotificationRole(page, false);
    await mockUnreadCount(page, 1);
    await mockNotificationList(page, [menteeCancelNotif]);

    await page.goto(PAGE_URL);
    await page.getByRole('button', { name: '開啟通知選單' }).click();

    await expect(
      page.getByText('您與 Mentor Chen 的預約已被取消')
    ).toBeVisible();
    await expect(
      page.getByText('您的預約已被取消，歡迎重新預約')
    ).toBeVisible();
  });

  test('Mobile viewport (375x812) opens notification popover with responsive width and without truncating content (#807)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await setupMenteeWithNotification(page, '109');

    await page.goto(PAGE_URL);

    const mobileHeader = page.getByTestId('mobile-header-right');
    await expect(mobileHeader).toBeVisible();

    const bell = mobileHeader.getByRole('button', { name: '開啟通知選單' });
    await expect(bell).toBeVisible();
    await bell.click();

    const popover = page.getByRole('dialog');
    await expect(popover).toBeVisible();
    await expect(popover.getByText('通知', { exact: true })).toBeVisible();

    const notifTitle = popover.getByText('Mentor Wang 已接受您的預約');
    const notifBody = popover.getByText('前往查看您的預約詳情');
    await expect(notifTitle).toBeVisible();
    await expect(notifBody).toBeVisible();
    await expect(
      popover.getByRole('button', { name: '全部標示為已讀' })
    ).toBeVisible();

    await expect
      .poll(async () => {
        const box = await popover.boundingBox();
        return box ? Math.round(box.width) : 0;
      })
      .toBe(343);

    const popoverBox = await popover.boundingBox();
    expect(popoverBox).not.toBeNull();
    expect(popoverBox!.width).toBeGreaterThan(300);
    expect(Math.round(popoverBox!.x)).toBe(16);
    expect(Math.round(375 - (popoverBox!.x + popoverBox!.width))).toBe(16);

    const isHorizontallyTruncated = await notifTitle.evaluate(
      (el) => el.scrollWidth > el.clientWidth
    );
    expect(isHorizontallyTruncated).toBe(false);

    await captureEvidence(page, 'notification-bell-open');
  });

  test('Mobile viewport (390x844) positions notification popover with balanced left and right margins instead of sticking to left: 0px (#858)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupMenteeWithNotification(page, '112');

    await page.goto(PAGE_URL);

    const mobileHeader = page.getByTestId('mobile-header-right');
    await expect(mobileHeader).toBeVisible();

    const bell = mobileHeader.getByRole('button', { name: '開啟通知選單' });
    await expect(bell).toBeVisible();
    await bell.click();

    const popover = page.getByRole('dialog');
    await expect(popover).toBeVisible();

    await expect
      .poll(async () => {
        const box = await popover.boundingBox();
        return box ? Math.round(box.width) : 0;
      })
      .toBe(358);

    const popoverBox = await popover.boundingBox();
    expect(popoverBox).not.toBeNull();
    const leftMargin = Math.round(popoverBox!.x);
    const rightMargin = Math.round(390 - (popoverBox!.x + popoverBox!.width));
    expect(leftMargin).toBe(16);
    expect(rightMargin).toBe(16);
  });
});
