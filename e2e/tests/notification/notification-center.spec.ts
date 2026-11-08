import { expect, Page, test } from '@playwright/test';
import dayjs from 'dayjs';
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

    // Scoped inside the (visible) bell button, not page-wide with .first() -
    // a page-wide match risks silently grabbing a hidden duplicate (e.g. a
    // responsive mobile-menu badge), which would make not.toBeVisible()
    // trivially pass regardless of whether the real badge disappeared.
    const badge = bell.locator('[aria-label*="則未讀通知"]');
    await expect(badge).toHaveText('1');

    // Everything from here on can fail (a missing element, a request that
    // never fires) while the PUT route is already held pending - wrap the
    // whole sequence so releasePut() always runs, not just on assertion
    // failure specifically.
    try {
      await bell.click();

      const markReadRequest = page.waitForRequest(
        (req) =>
          req.url().includes('/notifications/101') && req.method() === 'PUT'
      );
      await page.getByText('Mentor Wang 已接受您的預約').click();
      await markReadRequest;

      // The PUT response is still genuinely pending here - if the badge is
      // already gone, that can only be an optimistic update, since the real
      // response can never arrive until releasePut() is called.
      await expect(badge).not.toBeVisible();
    } finally {
      // Always release, even on failure - otherwise the held route never
      // resolves and leaves a dangling pending request.
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

    // The badge stays hidden by design: opening the center already marked
    // the count as seen (showBadge = badgeCount > seenUnreadCount). Verify
    // the rollback on the item itself instead. Reopening refreshes the list
    // in the background - hold that refresh so what renders is the store's
    // rolled-back state, not a fresh copy of the (unread) mock.
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

    await loginAs(page, false);
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

    await loginAs(page, false);
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

    await loginAs(page, true);
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

    await loginAs(page, true);
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

    // Switch to mentee view and verify mentee copy
    const menteeCancelNotif = makeNotificationVO(
      '111',
      'reservation_canceled',
      true,
      'Mentor Chen',
      'mentee',
      { actor_role: 'mentor' }
    );
    await loginAs(page, false);
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

    // Spec (#807, #858): w-[calc(100vw-32px)] max-w-[360px] with collisionPadding={16}
    // Wait for Radix Popover's zoom-in-95 open animation to settle so
    // boundingBox() measures the final unscaled layout box (375 - 32 = 343px).
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

    // Ensure notification text is not horizontally clipped/overflowing its container
    const isHorizontallyTruncated = await notifTitle.evaluate(
      (el) => el.scrollWidth > el.clientWidth
    );
    expect(isHorizontallyTruncated).toBe(false);
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

    // 390 - 32 = 358px, with 16px margin on both left and right
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
