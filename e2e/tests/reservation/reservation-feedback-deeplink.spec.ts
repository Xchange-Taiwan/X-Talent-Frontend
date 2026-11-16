import { expect, Page, test } from '@playwright/test';

import { captureEvidence } from '../../helpers/evidence';
import {
  clearMockAuthSession,
  seedMockAuthSession,
} from '../../helpers/session';

const MENTEE_USER_ID = '1';
const MENTOR_USER_ID = '2';

const MENTEE_USER = {
  id: MENTEE_USER_ID,
  name: 'Test Mentee',
  isMentor: false,
  onBoarding: true,
  jobTitle: 'Junior Product Designer',
  company: 'Studio X',
} as const;

const MENTOR_USER = {
  id: MENTOR_USER_ID,
  name: 'Emily Chen',
  isMentor: true,
  onBoarding: true,
  jobTitle: 'Senior UI/UX Designer',
  company: 'Tech Corp',
} as const;

function makeReservationResponse(reservations: object[]) {
  return {
    code: '0',
    msg: 'ok',
    data: {
      reservations,
      next_dtend: 0,
    },
  };
}

function makeMenteeHistoryReservation(
  id: number,
  mentorName: string,
  feedback?: object
) {
  return {
    id,
    sender: {
      user_id: Number(MENTEE_USER_ID),
      role: 'MENTEE',
      status: 'ACCEPT',
      name: 'Test Mentee',
      avatar: '',
      job_title: 'Junior Product Designer',
      years_of_experience: 'ONE_TO_THREE',
    },
    participant: {
      user_id: 100 + id,
      role: 'MENTOR',
      status: 'ACCEPT',
      name: mentorName,
      avatar: '',
      job_title: 'UI/UX 設計師',
      years_of_experience: 'FIVE_TO_TEN',
    },
    schedule_id: id,
    dtstart: 1760958000,
    dtend: 1760959800,
    previous_reserve: null,
    messages: [
      {
        id: id * 10 + 1,
        user_id: Number(MENTEE_USER_ID),
        role: 'MENTEE',
        content: '想請教作品集整理與職涯規劃建議。',
      },
    ],
    ...(feedback ? { feedback } : {}),
  };
}

function makeMentorHistoryReservation(
  id: number,
  menteeName: string,
  feedback?: object
) {
  return {
    id,
    sender: {
      user_id: 200 + id,
      role: 'MENTEE',
      status: 'ACCEPT',
      name: menteeName,
      avatar: '',
      job_title: '前端工程師',
      years_of_experience: 'ONE_TO_THREE',
    },
    participant: {
      user_id: Number(MENTOR_USER_ID),
      role: 'MENTOR',
      status: 'ACCEPT',
      name: 'Emily Chen',
      avatar: '',
      job_title: 'Senior UI/UX Designer',
      years_of_experience: 'FIVE_TO_TEN',
    },
    schedule_id: id,
    dtstart: 1760958000,
    dtend: 1760959800,
    previous_reserve: null,
    messages: [
      {
        id: id * 10 + 1,
        user_id: 200 + id,
        role: 'MENTEE',
        content: '期待與導師交流跨職能協作經驗。',
      },
    ],
    ...(feedback ? { feedback } : {}),
  };
}

async function mockMenteeReservations(page: Page, historyItems: object[]) {
  await page.route(
    new RegExp(`/v1/users/${MENTEE_USER_ID}/reservations([?]|$)`),
    (route) => {
      const url = new URL(route.request().url());
      const state = url.searchParams.get('state');
      const list = state === 'MENTEE_HISTORY' ? historyItems : [];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeReservationResponse(list)),
      });
    }
  );
}

async function mockMentorReservations(page: Page, historyItems: object[]) {
  await page.route(
    new RegExp(`/v1/users/${MENTOR_USER_ID}/reservations([?]|$)`),
    (route) => {
      const url = new URL(route.request().url());
      const state = url.searchParams.get('state');
      const list = state === 'MENTOR_HISTORY' ? historyItems : [];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeReservationResponse(list)),
      });
    }
  );
}

interface MockNotificationRecord {
  id: number;
  type: string;
  read_at: number | null;
  created_at: number;
  metadata: Record<string, unknown>;
}

async function mockNotifications(page: Page, items: MockNotificationRecord[]) {
  const stateItems = items.map((item) => ({ ...item }));

  await page.route(/\/v1\/users\/.*\/notifications\/unread-count/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: '0',
        msg: 'ok',
        data: {
          unread_count: stateItems.filter((item) => item.read_at === null)
            .length,
        },
      }),
    })
  );

  await page.route(/\/v1\/users\/.*\/notifications(\?|$)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: '0',
        msg: 'ok',
        data: {
          notifications: stateItems,
          next_cursor: null,
        },
      }),
    })
  );

  await page.route(
    /\/v1\/(?:users\/[^/]+\/)?notifications\/(?!unread-count(?:$|\?))[^/?]+/,
    (route) => {
      const match = route
        .request()
        .url()
        .match(/\/notifications\/(\d+)/);
      const nowSec = Math.floor(Date.now() / 1000);
      let updatedItem: MockNotificationRecord | null = null;

      if (match) {
        const targetId = Number(match[1]);
        for (const item of stateItems) {
          if (item.id === targetId) {
            item.read_at = nowSec;
            updatedItem = { ...item };
          }
        }
      } else {
        for (const item of stateItems) {
          item.read_at = nowSec;
        }
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: '0',
          msg: 'ok',
          data: updatedItem ?? {},
        }),
      });
    }
  );
}

async function openVisibleNotificationBell(page: Page) {
  const bellButton = page
    .getByRole('button', { name: '開啟通知選單' })
    .and(page.locator(':visible'));
  await expect(bellButton).toBeVisible();
  await bellButton.click();
}

test.describe('會談結束回饋提醒：站內通知與 Email 深連結導向 (#733)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await clearMockAuthSession(page);
  });

  test('未登入點擊 Email 回饋深連結 → 導向登入並保留完整 callbackUrl → 登入後導回 History 自動開啟回饋彈窗且關閉後清除單次參數', async ({
    page,
  }) => {
    const historyItems = [
      makeMenteeHistoryReservation(101, 'Emily Chen', {
        meeting_happened: null,
        rating: null,
        next_step: 'ANSWER',
      }),
    ];

    await mockMenteeReservations(page, historyItems);
    await mockNotifications(page, []);
    await page.route(
      new RegExp(`/v1/users/${MENTEE_USER_ID}/reservations/101/feedback$`),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: {
              reservation_id: 101,
              role: 'MENTEE',
              counterpart: {
                name: 'Emily Chen',
                avatar: '',
                job_title: 'UI/UX 設計師',
                company: 'Tech Corp',
              },
              dtstart: 1760958000,
              dtend: 1760959800,
              cancelled_by: null,
              feedback: {
                meeting_happened: null,
                rating: null,
                next_step: 'ANSWER',
              },
            },
          }),
        })
    );

    await page.route(/\/api\/auth\/callback\/credentials/, async (route) => {
      await seedMockAuthSession(page, MENTEE_USER);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: new URL('/', page.url()).origin }),
      });
    });

    // 1. Unauthenticated user clicks official #760 §7 Email reminder link (/reservation/history?reservation_id=101)
    await page.goto('/reservation/history?reservation_id=101');

    await expect(page).toHaveURL(
      /\/auth\/signin\?callbackUrl=%2Freservation%2Fhistory%3Freservation_id%3D101/,
      { timeout: 15_000 }
    );

    // 2. Sign in on /auth/signin -> returns to /reservation/history?reservation_id=101 -> resolves role MENTEE -> /reservation/mentee?tab=history&reservation_id=101
    await page.fill('input[name="email"]', 'mentee@example.com');
    await page.fill('input[name="password"]', 'Password1234');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(
      /\/reservation\/mentee\?tab=history&reservation_id=101/,
      { timeout: 15_000 }
    );

    // 3. History tab is active and MeetingFeedbackDialog opens automatically for Emily Chen
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Emily Chen')).toBeVisible();
    await expect(dialog.getByText('步驟 1 / 2 · 確認會談')).toBeVisible();
    await expect(dialog.getByText('這場會談是否順利進行？')).toBeVisible();

    await captureEvidence(
      page,
      '733-unauth-callback-mentee-feedback-dialog-open',
      { waitForSelector: '[role="dialog"]' }
    );

    // 4. Closing dialog strips one-shot reservationId so reloading will not re-open
    await dialog.getByRole('button', { name: '關閉回饋視窗' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveURL('/reservation/mentee?tab=history');

    await page.reload();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('Mentee 點擊站內「留下您的會談回饋」通知 → 導向開啟回饋彈窗並成功送出回饋、清除單次參數', async ({
    page,
  }) => {
    await seedMockAuthSession(page, MENTEE_USER);

    const historyItems = [
      makeMenteeHistoryReservation(101, 'Emily Chen', {
        meeting_happened: null,
        rating: null,
        next_step: 'ANSWER',
      }),
    ];

    await mockMenteeReservations(page, historyItems);
    await page.route(
      new RegExp(`/v1/users/${MENTEE_USER_ID}/reservations/101/feedback$`),
      (route) => {
        if (route.request().method() !== 'POST') {
          return route.continue();
        }
        historyItems[0] = makeMenteeHistoryReservation(101, 'Emily Chen', {
          meeting_happened: true,
          rating: {
            rating: 10,
            content: '謝謝導師給予寶貴建議！',
            created_at: 1760960100,
            updated_at: 1760960100,
            author_name: 'T***',
            is_public: true,
          },
          next_step: null,
        });
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: { is_public: true },
          }),
        });
      }
    );
    await mockNotifications(page, [
      {
        id: 9001,
        type: 'reservation_feedback_requested',
        read_at: null,
        created_at: Math.floor(Date.now() / 1000),
        metadata: {
          role: 'mentee',
          counterparty_name: 'Emily Chen',
          reservation_id: 101,
        },
      },
    ]);

    await page.goto('/');
    await openVisibleNotificationBell(page);
    const reminderItem = page.getByRole('link', {
      name: /留下您的會談回饋/,
    });
    await expect(reminderItem).toBeVisible();
    await expect(
      page.getByText('您與 Emily Chen 的會談已結束，前往留下回饋。')
    ).toBeVisible();

    await captureEvidence(
      page,
      '733-mentee-notification-bell-feedback-reminder'
    );

    const menteeMarkReadDone = page.waitForResponse(
      (res) =>
        res.url().includes('/notifications/9001') &&
        res.request().method() === 'PUT'
    );
    await reminderItem.click();
    await menteeMarkReadDone;

    const feedbackDialog = page.getByRole('dialog');
    await expect(feedbackDialog).toBeVisible();
    await expect(
      feedbackDialog.getByText('這場會談是否順利進行？')
    ).toBeVisible();
    await expect(
      page.getByText('無法將通知標示為已讀，請稍後再試', { exact: true })
    ).not.toBeVisible();

    await feedbackDialog
      .locator('label')
      .filter({ hasText: /^有進行$/ })
      .click();
    await feedbackDialog.getByRole('button', { name: /下一步/ }).click();
    await expect(
      feedbackDialog.getByText('步驟 2 / 2 · 交流回饋')
    ).toBeVisible();
    await feedbackDialog
      .getByRole('radio', { name: '10 分', exact: true })
      .click();
    await feedbackDialog.getByLabel(/文字回饋/).fill('謝謝導師給予寶貴建議！');
    await feedbackDialog.getByRole('button', { name: '送出回饋' }).click();

    await expect(feedbackDialog).not.toBeVisible();
    await expect(page).toHaveURL('/reservation/mentee?tab=history');
    await expect(page.getByText('已送出', { exact: true })).toBeVisible();
    await expect(
      page.getByText('X-Talent 已收到您的回饋，謝謝您！', { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText('您已填寫過此場會談回饋', { exact: true })
    ).not.toBeVisible();
  });

  test('Mentee 點擊已填寫過回饋的深連結 → 不重複開啟彈窗，自動定位標示卡片、展開既有回饋、顯示友善提示並清除單次參數', async ({
    page,
  }) => {
    await seedMockAuthSession(page, MENTEE_USER);

    const historyItems = [
      makeMenteeHistoryReservation(102, 'Alex Wang', {
        meeting_happened: true,
        rating: {
          rating: 10,
          content: '導師給了非常具體的作品集優化方向，收穫滿滿！',
          created_at: 1760960000,
          updated_at: 1760960000,
          author_name: 'T***',
          is_public: true,
        },
        next_step: null,
      }),
    ];

    await mockMenteeReservations(page, historyItems);
    await mockNotifications(page, []);

    await page.goto('/reservation/mentee?tab=history&reservationId=102');

    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page).toHaveURL('/reservation/mentee?tab=history');
    await expect(
      page.getByText('您已填寫過此場會談回饋', { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText('已為您展開先前的回饋紀錄。', { exact: true })
    ).toBeVisible();

    const highlightedCard = page.locator('[data-reservation-id="102"]');
    await expect(highlightedCard).toBeVisible();
    await expect(highlightedCard).toHaveAttribute('data-highlighted', 'true');
    await expect(
      highlightedCard.getByText('導師給了非常具體的作品集優化方向，收穫滿滿！')
    ).toBeVisible();

    await captureEvidence(page, '733-mentee-already-rated-auto-expanded-toast');
  });

  test('Mentor 點擊站內「留下您的會談紀錄」通知 → 導向 /reservation/mentor?tab=history 定位並標示該場會談卡片', async ({
    page,
  }) => {
    await seedMockAuthSession(page, MENTOR_USER);

    const mentorHistory = [
      makeMentorHistoryReservation(201, '林學員', {
        meeting_happened: true,
        rating: {
          rating: 9,
          content: '謝謝導師清楚拆解面試準備重點！',
          created_at: 1760960000,
          updated_at: 1760960000,
          author_name: '林＊員',
          is_public: true,
        },
        next_step: null,
      }),
    ];

    await mockMentorReservations(page, mentorHistory);
    await mockNotifications(page, [
      {
        id: 9002,
        type: 'reservation_attendance_requested',
        read_at: null,
        created_at: Math.floor(Date.now() / 1000),
        metadata: {
          role: 'mentor',
          counterparty_name: '林學員',
          reservation_id: 201,
        },
      },
    ]);

    await page.goto('/');
    await openVisibleNotificationBell(page);

    const mentorNotifLink = page.getByRole('link', {
      name: /留下您的會談紀錄/,
    });
    await expect(mentorNotifLink).toBeVisible();
    await expect(
      page.getByText('您與 林學員 的會談已結束，前往留下紀錄。')
    ).toBeVisible();

    await captureEvidence(
      page,
      '733-mentor-notification-bell-feedback-reminder'
    );

    const mentorMarkReadDone = page.waitForResponse(
      (res) =>
        res.url().includes('/notifications/9002') &&
        res.request().method() === 'PUT'
    );
    await mentorNotifLink.click();
    await mentorMarkReadDone;

    await expect(page).toHaveURL('/reservation/mentor?tab=history', {
      timeout: 15_000,
    });
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(
      page.getByText('無法將通知標示為已讀，請稍後再試', { exact: true })
    ).not.toBeVisible();
    await expect(page.getByText('操作失敗', { exact: true })).not.toBeVisible();

    const targetCard = page.locator('[data-reservation-id="201"]');
    await expect(targetCard).toBeVisible();
    await expect(targetCard).toHaveAttribute('data-highlighted', 'true');
    await expect(targetCard.getByText('林學員')).toBeVisible();
    await expect(
      targetCard.getByText('謝謝導師清楚拆解面試準備重點！')
    ).toBeVisible();

    await captureEvidence(page, '733-mentor-history-deeplink-card-located');
  });

  test('目標 reservation_id 不在已載入歷史分頁內時，透過單場查詢 GET /feedback 自動開啟回饋彈窗 (#875)', async ({
    page,
  }) => {
    await seedMockAuthSession(page, MENTEE_USER);

    await mockMenteeReservations(page, []);
    await mockNotifications(page, []);
    await page.route(
      new RegExp(`/v1/users/${MENTEE_USER_ID}/reservations/555/feedback$`),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: {
              reservation_id: 555,
              role: 'MENTEE',
              counterpart: {
                name: 'Zahra Mirzakhani',
                avatar: '',
                job_title: 'Staff UX Researcher',
                company: 'Google Taiwan',
              },
              dtstart: 1760958000,
              dtend: 1760959800,
              cancelled_by: null,
              feedback: {
                meeting_happened: null,
                rating: null,
                next_step: 'ANSWER',
              },
            },
          }),
        })
    );

    await page.goto('/reservation/history?reservation_id=555');
    await expect(page).toHaveURL(
      /\/reservation\/mentee\?tab=history&reservation_id=555/,
      { timeout: 15_000 }
    );

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Zahra Mirzakhani')).toBeVisible();

    await captureEvidence(
      page,
      '875-single-feedback-lookup-fallback-dialog-open',
      { waitForSelector: '[role="dialog"]' }
    );
  });
});
