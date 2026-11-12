import { expect, Page, test } from '@playwright/test';

import { captureEvidence } from '../../helpers/evidence';
import { setSignedSessionCookie } from '../../helpers/session';

const USER_ID = '1';

function makeMenteeSession() {
  return {
    user: {
      id: USER_ID,
      name: 'Test Mentee',
      isMentor: false,
      onBoarding: true,
      jobTitle: 'Junior Product Designer',
      company: 'Studio X',
      personalLinks: [],
    },
    accessToken: 'mock-access-token',
    expires: '2099-01-01T00:00:00.000Z',
  };
}

function makeMentorSession() {
  return {
    user: {
      id: USER_ID,
      name: 'Test Mentor',
      isMentor: true,
      onBoarding: true,
      jobTitle: 'Principal Product Designer',
      company: 'Studio X',
      personalLinks: [],
    },
    accessToken: 'mock-access-token',
    expires: '2099-01-01T00:00:00.000Z',
  };
}

function makeReservationResponse(reservations: object[], nextDtend = 0) {
  return {
    code: '0',
    msg: 'ok',
    data: {
      reservations,
      next_dtend: nextDtend,
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
      user_id: Number(USER_ID),
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
        user_id: Number(USER_ID),
        role: 'MENTEE',
        content: '想請教作品集的整理方向，以及轉職 UI/UX 設計師的準備方式。',
      },
    ],
    ...(feedback ? { feedback } : {}),
  };
}

async function setupLoggedInMentee(page: Page) {
  const session = makeMenteeSession();
  await setSignedSessionCookie(page, {
    ...session.user,
    token: session.accessToken,
  });
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

function makeMentorHistoryReservation(
  id: number,
  menteeName: string,
  dtend: number,
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
      job_title: 'Junior Engineer',
      years_of_experience: 'ONE_TO_THREE',
    },
    participant: {
      user_id: Number(USER_ID),
      role: 'MENTOR',
      status: 'ACCEPT',
      name: 'Test Mentor',
      avatar: '',
      job_title: 'Principal Product Designer',
      years_of_experience: 'FIVE_TO_TEN',
    },
    schedule_id: id,
    dtstart: dtend - 1800,
    dtend,
    previous_reserve: null,
    messages: [
      {
        id: id * 10 + 1,
        user_id: 200 + id,
        role: 'MENTEE',
        content: '想請教資深產品設計師的跨部門協作經驗。',
      },
    ],
    ...(feedback ? { feedback } : {}),
  };
}

async function setupLoggedInMentor(page: Page) {
  const session = makeMentorSession();
  await setSignedSessionCookie(page, {
    ...session.user,
    token: session.accessToken,
  });
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

test.describe('會談結束提醒通知、/reservation/history 路由與未登入導回 (#733)', () => {
  test('站內通知顯示「留下您的會談回饋」→ 點擊導向 /reservation/history?reservation_id=101 並自動開啟該場回饋彈窗', async ({
    page,
  }) => {
    await setupLoggedInMentee(page);

    const feedbackNotification = {
      id: 901,
      type: 'reservation_feedback_requested',
      read_at: null,
      created_at: Math.floor(Date.now() / 1000),
      metadata: {
        role: 'mentee',
        counterparty_name: 'Emily Chen',
        reservation_id: 101,
      },
    };

    await page.route(
      new RegExp(`/v1/users/${USER_ID}/notifications/unread-count`),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: { unread_count: 1 },
          }),
        })
    );

    await page.route(
      new RegExp(`/v1/users/${USER_ID}/notifications([?]|$)`),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: {
              notifications: [feedbackNotification],
              next_cursor: null,
            },
          }),
        })
    );

    await page.route(
      new RegExp(`/v1/users/${USER_ID}/notifications/901`),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: { ...feedbackNotification, read_at: 1760960000 },
          }),
        })
    );

    const historyItems = [
      makeMenteeHistoryReservation(101, 'Emily Chen', {
        meeting_happened: null,
        rating: null,
        next_step: 'ANSWER',
      }),
    ];

    await page.route(
      new RegExp(`/v1/users/${USER_ID}/reservations([?]|$)`),
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

    await page.route(
      new RegExp(`/v1/users/${USER_ID}/reservations/101/feedback$`),
      (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              code: '0',
              msg: 'ok',
              data: {
                meeting_happened: null,
                rating: null,
                next_step: 'ANSWER',
                role: 'MENTEE',
              },
            }),
          });
        }
        return route.continue();
      }
    );

    await page.goto('/mentor-pool');

    const bell = page.getByRole('button', { name: '開啟通知選單' });
    await expect(bell).toBeVisible();
    await bell.click();

    const notifTitle = page.getByText('留下您的會談回饋');
    const notifBody = page.getByText(
      '您與 Emily Chen 的會談已結束，前往留下回饋。'
    );
    await expect(notifTitle).toBeVisible();
    await expect(notifBody).toBeVisible();

    await captureEvidence(page, 'notification-bell-feedback-reminder-open');

    const notificationLink = page.locator(
      'a[href="/reservation/history?reservation_id=101"]'
    );
    await expect(notificationLink).toBeVisible();
    await notificationLink.click();

    await expect(page).toHaveURL(
      /\/reservation\/mentee\?tab=history&reservation_id=101/,
      { timeout: 15_000 }
    );

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: '會談是否有進行？' })
    ).toBeVisible();
    await expect(dialog.getByText(/Emily Chen/)).toBeVisible();

    await captureEvidence(
      page,
      'history-feedback-dialog-auto-opened-from-notification'
    );

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    const historyTab = page.getByRole('tab', { name: /歷史紀錄/ });
    await expect(historyTab).toHaveAttribute('aria-selected', 'true');
  });

  test('未登入點擊提醒連結 /reservation/history?reservation_id=101 → 帶 callbackUrl 導至登入，登入成功後導回歷史紀錄並以列表 fallback 自動開啟回饋彈窗', async ({
    page,
  }) => {
    const session = makeMenteeSession();
    let isAuthenticated = false;

    await page.route(/\/api\/auth\/session/, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(isAuthenticated ? session : {}),
        });
      }
      return route.continue();
    });

    await page.route(/\/api\/auth\/callback\/credentials/, async (route) => {
      isAuthenticated = true;
      await setSignedSessionCookie(page, {
        ...session.user,
        token: session.accessToken,
      });
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'http://localhost:3000' }),
      });
    });

    await page.route(/\/v1\/users\/.*\/notifications/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: '0',
          msg: 'ok',
          data: { unread_count: 0, notifications: [], next_cursor: null },
        }),
      })
    );

    const historyItems = [
      makeMenteeHistoryReservation(101, 'Emily Chen', {
        meeting_happened: null,
        rating: null,
        next_step: 'ANSWER',
      }),
    ];

    await page.route(
      new RegExp(`/v1/users/${USER_ID}/reservations([?]|$)`),
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

    // Simulate backend single-item GET /feedback returning 404 to verify graceful list fallback
    await page.route(
      new RegExp(`/v1/users/${USER_ID}/reservations/101/feedback$`),
      (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ code: '404', msg: 'Not Found', data: null }),
          });
        }
        return route.continue();
      }
    );

    await page.goto('/reservation/history?reservation_id=101');

    await expect(page).toHaveURL(
      '/auth/signin?callbackUrl=%2Freservation%2Fhistory%3Freservation_id%3D101',
      { timeout: 15_000 }
    );
    await expect(page.getByText('登入 X-Talent 帳戶')).toBeVisible();

    await captureEvidence(page, 'signin-with-history-callback-url');

    await page.fill('input[name="email"]', 'mentee@example.com');
    await page.fill('input[name="password"]', 'Password1234');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(
      /\/reservation\/mentee\?tab=history&reservation_id=101/,
      { timeout: 15_000 }
    );

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: '會談是否有進行？' })
    ).toBeVisible();

    await captureEvidence(
      page,
      'history-feedback-dialog-auto-opened-after-login-callback'
    );
  });

  test('已填寫回饋（next_step !== "ANSWER"）從提醒連結進入 /reservation/history?reservation_id=102 → 停留於歷史紀錄分頁且不自動開啟回饋彈窗', async ({
    page,
  }) => {
    await setupLoggedInMentee(page);

    await page.route(/\/v1\/users\/.*\/notifications/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: '0',
          msg: 'ok',
          data: { unread_count: 0, notifications: [], next_cursor: null },
        }),
      })
    );

    const historyItems = [
      makeMenteeHistoryReservation(102, '陳大文', {
        meeting_happened: true,
        rating: {
          rating: 10,
          content: '導師給了非常具體的作品集優化方向！',
          created_at: 1760960000,
          updated_at: 1760960000,
          author_name: '王＊明',
          is_public: true,
        },
        next_step: null,
      }),
    ];

    await page.route(
      new RegExp(`/v1/users/${USER_ID}/reservations([?]|$)`),
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

    await page.route(
      new RegExp(`/v1/users/${USER_ID}/reservations/102/feedback$`),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: {
              meeting_happened: true,
              rating: {
                rating: 10,
                content: '導師給了非常具體的作品集優化方向！',
                created_at: 1760960000,
                updated_at: 1760960000,
                author_name: '王＊明',
                is_public: true,
              },
              next_step: null,
            },
          }),
        })
    );

    await page.goto('/reservation/history?reservation_id=102');

    await expect(page).toHaveURL(
      /\/reservation\/mentee\?tab=history&reservation_id=102/,
      { timeout: 15_000 }
    );

    const card = page
      .getByTestId('reservation-card')
      .filter({ hasText: '陳大文' });
    await expect(card.getByRole('status')).toHaveText('已填寫');
    await expect(
      card.getByText('導師給了非常具體的作品集優化方向！')
    ).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('Mentor 預約位於第 2 頁時：外部連結與站內通知皆不閃爍 Mentee 畫面，自動導向 /reservation/mentor、載入第 2 頁並開啟回饋彈窗', async ({
    page,
  }) => {
    await setupLoggedInMentor(page);

    await page.addInitScript(() => {
      const check = () => {
        if (document.body?.textContent?.includes('預約導師')) {
          document.documentElement.dataset.sawMenteeHeading = 'true';
        }
      };
      const start = () => {
        check();
        const observer = new MutationObserver(check);
        if (document.body) {
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
          });
        }
      };
      if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', start, { once: true });
      } else {
        start();
      }
    });

    const mentorNotification = {
      id: 902,
      type: 'reservation_feedback_requested',
      read_at: null,
      created_at: Math.floor(Date.now() / 1000),
      metadata: {
        role: 'mentor',
        counterparty_name: '王小明',
        reservation_id: 202,
      },
    };

    await page.route(
      new RegExp(`/v1/users/${USER_ID}/notifications/unread-count`),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: { unread_count: 1 },
          }),
        })
    );

    await page.route(
      new RegExp(`/v1/users/${USER_ID}/notifications([?]|$)`),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: {
              notifications: [mentorNotification],
              next_cursor: null,
            },
          }),
        })
    );

    await page.route(
      new RegExp(`/v1/users/${USER_ID}/notifications/902`),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: { ...mentorNotification, read_at: 1760960000 },
          }),
        })
    );

    const mentorPage1 = Array.from({ length: 10 }, (_, idx) =>
      makeMentorHistoryReservation(
        210 + idx,
        `學員 ${idx + 1}`,
        1760950000 - idx * 3600,
        {
          meeting_happened: true,
          rating: {
            rating: 9,
            content: '已完成紀錄',
            created_at: 1760960000,
            updated_at: 1760960000,
            author_name: '導＊',
            is_public: true,
          },
          next_step: null,
        }
      )
    );
    const mentorPage2Cursor = 1760900000;
    const mentorPage2 = [
      makeMentorHistoryReservation(202, '王小明', mentorPage2Cursor - 1800, {
        meeting_happened: null,
        rating: null,
        next_step: 'ANSWER',
      }),
    ];

    await page.route(
      new RegExp(`/v1/users/${USER_ID}/reservations([?]|$)`),
      (route) => {
        const url = new URL(route.request().url());
        const state = url.searchParams.get('state');
        const nextDtend = url.searchParams.get('next_dtend');

        if (state === 'MENTOR_HISTORY') {
          if (nextDtend === String(mentorPage2Cursor)) {
            return route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(makeReservationResponse(mentorPage2, 0)),
            });
          }
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(
              makeReservationResponse(mentorPage1, mentorPage2Cursor)
            ),
          });
        }

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeReservationResponse([], 0)),
        });
      }
    );

    // Simulate 404 on single-item GET /feedback to exercise multi-page MENTOR_HISTORY fallback
    await page.route(
      new RegExp(`/v1/users/${USER_ID}/reservations/202/feedback$`),
      (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ code: '404', msg: 'Not Found', data: null }),
          });
        }
        return route.continue();
      }
    );

    // 1. External reminder link without role param: resolves Mentor role across page 2 without flashing Mentee UI
    await page.goto('/reservation/history?reservation_id=202');

    await expect(page).toHaveURL(
      /\/reservation\/mentor\?tab=history&reservation_id=202/,
      { timeout: 15_000 }
    );
    await expect(page.getByText('擔任導師')).toBeVisible();
    await expect(page.locator('html')).not.toHaveAttribute(
      'data-saw-mentee-heading',
      'true'
    );

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/王小明/)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    // 2. In-app notification link includes role=mentor and routes directly to /reservation/mentor
    await page.goto('/mentor-pool');
    const bell = page.getByRole('button', { name: '開啟通知選單' });
    await expect(bell).toBeVisible();
    await bell.click();

    const mentorNotifLink = page.locator(
      'a[href="/reservation/history?reservation_id=202&role=mentor"]'
    );
    await expect(mentorNotifLink).toBeVisible();
    await mentorNotifLink.click();

    await expect(page).toHaveURL(
      /\/reservation\/mentor\?tab=history&reservation_id=202/,
      { timeout: 15_000 }
    );
    await expect(page.locator('html')).not.toHaveAttribute(
      'data-saw-mentee-heading',
      'true'
    );
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});
