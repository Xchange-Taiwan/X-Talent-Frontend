import { expect, Page, test } from '@playwright/test';
import type { Session } from 'next-auth';

import { FEEDBACK_FORM_URL } from '@/constant/externalLinks';
import type { components } from '@/types/api';

import { captureEvidence } from '../../helpers/evidence';
import { setSignedSessionCookie } from '../../helpers/session';

type NotificationVO = components['schemas']['NotificationVO'];

const USER_ID = '1';
const READ_AT_UNIX = 1760960600;

function makeSession(isMentor: boolean): Session {
  return {
    user: {
      id: USER_ID,
      name: isMentor ? 'Emily Chen' : '王小明',
      isMentor,
      onBoarding: true,
      jobTitle: isMentor ? 'Senior UI/UX Designer' : 'Junior Product Designer',
      company: isMentor ? 'Tech Corp' : 'Studio X',
      personalLinks: [],
    },
    accessToken: 'mock-token',
    expires: '2099-01-01T00:00:00.000Z',
  };
}

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

function buildMentorHistoryItems() {
  const precedingMentees = [
    {
      id: 407,
      userId: 56,
      name: '周子瑜',
      jobTitle: '產品設計師',
      dtstart: 1761476400,
    },
    {
      id: 406,
      userId: 55,
      name: '張家豪',
      jobTitle: '後端工程師',
      dtstart: 1761390000,
    },
    {
      id: 405,
      userId: 54,
      name: '陳怡君',
      jobTitle: '資料分析師',
      dtstart: 1761303600,
    },
    {
      id: 404,
      userId: 53,
      name: '劉冠宇',
      jobTitle: '軟體工程師',
      dtstart: 1761217200,
    },
    {
      id: 403,
      userId: 52,
      name: '黃詩涵',
      jobTitle: 'UX 研究員',
      dtstart: 1761130800,
    },
    {
      id: 402,
      userId: 49,
      name: '林雅婷',
      jobTitle: '產品經理',
      dtstart: 1761044400,
    },
  ];

  return [
    ...precedingMentees.map((m) => ({
      id: m.id,
      sender: {
        user_id: m.userId,
        role: 'MENTEE',
        status: 'ACCEPT',
        name: m.name,
        avatar: '',
        job_title: m.jobTitle,
        years_of_experience: 'ONE_TO_THREE',
      },
      participant: {
        user_id: Number(USER_ID),
        role: 'MENTOR',
        status: 'ACCEPT',
        name: 'Emily Chen',
        avatar: '',
        job_title: 'Senior UI/UX Designer',
        years_of_experience: 'FIVE_TO_TEN',
      },
      schedule_id: m.id,
      dtstart: m.dtstart,
      dtend: m.dtstart + 1800,
      previous_reserve: null,
      messages: [
        {
          id: m.id * 10 + 1,
          user_id: m.userId,
          role: 'MENTEE',
          content: '想請教職涯轉職與作品集準備方向。',
        },
      ],
      feedback: {
        meeting_happened: true,
        rating: null,
        next_step: null,
      },
    })),
    {
      id: 401,
      sender: {
        user_id: 50,
        role: 'MENTEE',
        status: 'ACCEPT',
        name: '王小明',
        avatar: '',
        job_title: '前端工程師',
        years_of_experience: 'ONE_TO_THREE',
      },
      participant: {
        user_id: Number(USER_ID),
        role: 'MENTOR',
        status: 'ACCEPT',
        name: 'Emily Chen',
        avatar: '',
        job_title: 'Senior UI/UX Designer',
        years_of_experience: 'FIVE_TO_TEN',
      },
      schedule_id: 401,
      dtstart: 1760958000,
      dtend: 1760959800,
      previous_reserve: null,
      messages: [],
      feedback: {
        meeting_happened: true,
        rating: {
          rating: 10,
          content: '謝謝導師清楚剖析設計系統架構與職涯方向！',
          created_at: 1760960000,
          updated_at: 1760960000,
          author_name: '王＊明',
          is_public: true,
        },
        next_step: null,
      },
    },
  ];
}

async function setupAuth(page: Page, isMentor: boolean): Promise<void> {
  const session = makeSession(isMentor);
  await setSignedSessionCookie(page, {
    id: USER_ID,
    name: isMentor ? 'Emily Chen' : '王小明',
    isMentor,
    onBoarding: true,
    jobTitle: isMentor ? 'Senior UI/UX Designer' : 'Junior Product Designer',
    company: isMentor ? 'Tech Corp' : 'Studio X',
    personalLinks: [],
    token: 'mock-access-token',
  });

  await page.route(
    (url) => url.pathname === '/api/auth/session',
    (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(session),
        });
      }
      return route.continue();
    }
  );
}

test.describe('Mentee 送出回饋後通知 Mentor 與評價未公開顯示 (#734)', () => {
  test('Mentor 點擊「您收到新的回饋」站內通知後標記已讀並自動切換歷史紀錄、捲動與高亮定位對應卡片', async ({
    page,
  }) => {
    await setupAuth(page, true);

    let isMarkedRead = false;
    const feedbackNotification: NotificationVO = {
      id: 73401,
      type: 'feedback_received',
      read_at: null,
      created_at: Math.floor(Date.now() / 1000) - 180,
      metadata: {
        role: 'mentor',
        counterparty_name: '王小明',
        reservation_id: 401,
      },
    };

    await page.route(
      (url) => url.pathname.endsWith('/notifications/unread-count'),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: { unread_count: isMarkedRead ? 0 : 1 },
          }),
        })
    );

    await page.route(
      (url) => url.pathname.endsWith('/notifications'),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: {
              notifications: [
                {
                  ...feedbackNotification,
                  read_at: isMarkedRead ? READ_AT_UNIX : null,
                },
              ],
              next_cursor: null,
            },
          }),
        })
    );

    await page.route(
      (url) => url.pathname.endsWith('/notifications/73401'),
      (route) => {
        if (route.request().method() === 'PUT') {
          isMarkedRead = true;
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              code: '0',
              msg: 'ok',
              data: {
                ...feedbackNotification,
                read_at: READ_AT_UNIX,
              },
            }),
          });
        }
        return route.continue();
      }
    );

    const mentorHistoryItems = buildMentorHistoryItems();

    await page.route(
      (url) => url.pathname.endsWith(`/users/${USER_ID}/reservations`),
      (route) => {
        const url = new URL(route.request().url());
        const state = url.searchParams.get('state');
        const list = state === 'MENTOR_HISTORY' ? mentorHistoryItems : [];
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeReservationResponse(list)),
        });
      }
    );

    await page.goto('/');

    const bell = page.getByRole('button', { name: '開啟通知選單' });
    await expect(bell).toBeVisible();
    await expect(bell.locator('[aria-label*="則未讀通知"]')).toHaveText('1');

    await bell.click();

    const notifTitle = page.getByText('您收到新的回饋');
    const notifBody = page.getByText(
      '王小明 為您留下了一則會談回饋，前往查看。'
    );
    await expect(notifTitle).toBeVisible();
    await expect(notifBody).toBeVisible();

    const notifLink = notifTitle.locator('xpath=ancestor::a[1]');
    await expect(notifLink).toHaveAttribute(
      'href',
      '/reservation/mentor?tab=history&reservationId=401'
    );

    await captureEvidence(page, 'mentor-feedback-received-notification-open');

    await notifLink.click();

    await expect(page).toHaveURL(
      '/reservation/mentor?tab=history&reservationId=401'
    );
    await expect.poll(() => isMarkedRead).toBe(true);

    const historyTab = page.getByRole('tab', { name: /歷史紀錄/ });
    await expect(historyTab).toHaveAttribute('aria-selected', 'true');

    const targetCard = page.locator(
      '[data-testid="reservation-card"][data-reservation-id="401"]'
    );
    const nonTargetCard = page.locator(
      '[data-testid="reservation-card"][data-reservation-id="402"]'
    );

    await expect(targetCard).toBeVisible();
    await expect(targetCard).toHaveAttribute('data-highlighted', 'true');
    await expect(nonTargetCard).toHaveAttribute('data-highlighted', 'false');

    const viewFeedbackBtn = targetCard.getByRole('button', {
      name: '查看回饋',
    });
    await expect(viewFeedbackBtn).toBeVisible();
    await expect(viewFeedbackBtn).toHaveAttribute('aria-expanded', 'true');

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const el = document.querySelector(
            '[data-testid="reservation-card"][data-reservation-id="401"]'
          );
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          return (
            window.scrollY > 0 &&
            rect.top >= 0 &&
            rect.bottom <= window.innerHeight
          );
        })
      )
      .toBe(true);

    const [targetBorderColor, nonTargetBorderColor] = await Promise.all([
      targetCard.evaluate((el) => getComputedStyle(el).borderColor),
      nonTargetCard.evaluate((el) => getComputedStyle(el).borderColor),
    ]);
    expect(targetBorderColor).not.toBe(nonTargetBorderColor);

    await expect(
      targetCard.getByTestId('reservation-feedback-public')
    ).toBeVisible();
    await expect(targetCard.getByText('學員評價')).toBeVisible();
    await expect(targetCard.getByText('10 / 10')).toBeVisible();
    await expect(
      targetCard.getByText('謝謝導師清楚剖析設計系統架構與職涯方向！')
    ).toBeVisible();

    await captureEvidence(
      page,
      'mentor-history-feedback-card-from-notification'
    );

    await page.getByRole('tab', { name: /待您回覆/ }).click();
    await expect(page).toHaveURL('/reservation/mentor?tab=pending');
  });

  test('未登入 Mentor 透過信件連結造訪 /reservation/mentor?tab=history&reservationId=401 時保留 callbackUrl，登入後導回並自動捲動高亮目標卡片', async ({
    page,
  }) => {
    const mentorHistoryItems = buildMentorHistoryItems();

    await page.route(
      (url) => url.pathname.endsWith('/notifications/unread-count'),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: { unread_count: 0 },
          }),
        })
    );

    await page.route(
      (url) => url.pathname.endsWith('/notifications'),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: { notifications: [], next_cursor: null },
          }),
        })
    );

    await page.route(
      (url) => url.pathname.endsWith(`/users/${USER_ID}/reservations`),
      (route) => {
        const url = new URL(route.request().url());
        const state = url.searchParams.get('state');
        const list = state === 'MENTOR_HISTORY' ? mentorHistoryItems : [];
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeReservationResponse(list)),
        });
      }
    );

    await page.goto('/reservation/mentor?tab=history&reservationId=401');

    await expect(page).toHaveURL(
      (url) =>
        url.pathname === '/auth/signin' &&
        url.searchParams.get('callbackUrl') ===
          '/reservation/mentor?tab=history&reservationId=401',
      { timeout: 15_000 }
    );

    // Prepare authenticated session for credential login submission
    await setupAuth(page, true);
    await page.route(
      (url) => url.pathname === '/api/auth/callback/credentials',
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ url: 'http://localhost:3000' }),
        })
    );

    await page.fill('input[name="email"]', 'mentor@example.com');
    await page.fill('input[name="password"]', 'Password1234');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(
      '/reservation/mentor?tab=history&reservationId=401',
      { timeout: 15_000 }
    );

    const historyTab = page.getByRole('tab', { name: /歷史紀錄/ });
    await expect(historyTab).toHaveAttribute('aria-selected', 'true');

    const targetCard = page.locator(
      '[data-testid="reservation-card"][data-reservation-id="401"]'
    );
    await expect(targetCard).toBeVisible();
    await expect(targetCard).toHaveAttribute('data-highlighted', 'true');
    await expect(
      targetCard.getByRole('button', { name: '查看回饋' })
    ).toHaveAttribute('aria-expanded', 'true');

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const el = document.querySelector(
            '[data-testid="reservation-card"][data-reservation-id="401"]'
          );
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          return (
            window.scrollY > 0 &&
            rect.top >= 0 &&
            rect.bottom <= window.innerHeight
          );
        })
      )
      .toBe(true);

    await expect(targetCard.getByText('10 / 10')).toBeVisible();
    await expect(
      targetCard.getByText('謝謝導師清楚剖析設計系統架構與職涯方向！')
    ).toBeVisible();
  });

  test('同網域絕對網址 callbackUrl 且漏帶 tab=history、目標卡片位於歷史紀錄第 2 頁時，登入後自動切換分頁並跨頁載入高亮展開評價 (#734)', async ({
    page,
    baseURL,
  }) => {
    const mentorHistoryItems = buildMentorHistoryItems();
    const page1Items = mentorHistoryItems.slice(0, 4);
    const page2Items = mentorHistoryItems.slice(4);
    const page1Cursor = 1761219000;

    await page.route(
      (url) => url.pathname.endsWith('/notifications/unread-count'),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: { unread_count: 0 },
          }),
        })
    );

    await page.route(
      (url) => url.pathname.endsWith('/notifications'),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: { notifications: [], next_cursor: null },
          }),
        })
    );

    let historyPage2Fetched = false;
    await page.route(
      (url) => url.pathname.endsWith(`/users/${USER_ID}/reservations`),
      (route) => {
        const url = new URL(route.request().url());
        const state = url.searchParams.get('state');
        const nextDtend = url.searchParams.get('next_dtend');

        if (state !== 'MENTOR_HISTORY') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(makeReservationResponse([])),
          });
        }

        if (nextDtend === String(page1Cursor)) {
          historyPage2Fetched = true;
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              code: '0',
              msg: 'ok',
              data: {
                reservations: page2Items,
                next_dtend: 0,
              },
            }),
          });
        }

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: {
              reservations: page1Items,
              next_dtend: page1Cursor,
            },
          }),
        });
      }
    );

    const origin = baseURL ?? 'http://localhost:3000';
    const absoluteCallbackUrl = `${origin}/reservation/mentor?reservationId=401`;
    await page.goto(
      `/auth/signin?callbackUrl=${encodeURIComponent(absoluteCallbackUrl)}`
    );

    await setupAuth(page, true);
    await page.route(
      (url) => url.pathname === '/api/auth/callback/credentials',
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ url: origin }),
        })
    );

    await page.fill('input[name="email"]', 'mentor@example.com');
    await page.fill('input[name="password"]', 'Password1234');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/reservation/mentor?reservationId=401', {
      timeout: 15_000,
    });

    const historyTab = page.getByRole('tab', { name: /歷史紀錄/ });
    await expect(historyTab).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => historyPage2Fetched).toBe(true);

    const targetCard = page.locator(
      '[data-testid="reservation-card"][data-reservation-id="401"]'
    );
    await expect(targetCard).toBeVisible();
    await expect(targetCard).toHaveAttribute('data-highlighted', 'true');
    await expect(
      targetCard.getByRole('button', { name: '查看回饋' })
    ).toHaveAttribute('aria-expanded', 'true');
    await expect(
      targetCard.getByText('謝謝導師清楚剖析設計系統架構與職涯方向！')
    ).toBeVisible();
  });

  test('評價事後因標註沒有進行而下架（is_public=false）時，Mentor 點擊既有「您收到新的回饋」站內通知定位卡片但不公開顯示評分與評語', async ({
    page,
  }) => {
    await setupAuth(page, true);

    const feedbackNotification: NotificationVO = {
      id: 73402,
      type: 'feedback_received',
      read_at: null,
      created_at: Math.floor(Date.now() / 1000) - 300,
      metadata: {
        role: 'mentor',
        counterparty_name: '林佳穎',
        reservation_id: 408,
      },
    };

    await page.route(
      (url) => url.pathname.endsWith('/notifications/unread-count'),
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
      (url) => url.pathname.endsWith('/notifications'),
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
      (url) => url.pathname.endsWith('/notifications/73402'),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: { ...feedbackNotification, read_at: READ_AT_UNIX },
          }),
        })
    );

    const delistedMentorHistoryItems = [
      ...buildMentorHistoryItems().slice(0, 6),
      {
        id: 408,
        sender: {
          user_id: 58,
          role: 'MENTEE',
          status: 'ACCEPT',
          name: '林佳穎',
          avatar: '',
          job_title: '產品設計師',
          years_of_experience: 'ONE_TO_THREE',
        },
        participant: {
          user_id: Number(USER_ID),
          role: 'MENTOR',
          status: 'ACCEPT',
          name: 'Emily Chen',
          avatar: '',
          job_title: 'Senior UI/UX Designer',
          years_of_experience: 'FIVE_TO_TEN',
        },
        schedule_id: 408,
        dtstart: 1760950000,
        dtend: 1760951800,
        previous_reserve: null,
        messages: [],
        feedback: {
          meeting_happened: false,
          rating: {
            rating: 8,
            content: '這段已下架的評價內容不應向導師顯示。',
            created_at: 1760952000,
            updated_at: 1760952500,
            author_name: '林＊穎',
            is_public: false,
          },
          next_step: null,
        },
      },
    ];

    await page.route(
      (url) => url.pathname.endsWith(`/users/${USER_ID}/reservations`),
      (route) => {
        const url = new URL(route.request().url());
        const state = url.searchParams.get('state');
        const list =
          state === 'MENTOR_HISTORY' ? delistedMentorHistoryItems : [];
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeReservationResponse(list)),
        });
      }
    );

    await page.goto('/');
    await page.getByRole('button', { name: '開啟通知選單' }).click();
    await page.getByText('林佳穎 為您留下了一則會談回饋，前往查看。').click();

    await expect(page).toHaveURL(
      '/reservation/mentor?tab=history&reservationId=408'
    );

    const targetCard = page.locator(
      '[data-testid="reservation-card"][data-reservation-id="408"]'
    );
    await expect(targetCard).toBeVisible();
    await expect(targetCard).toHaveAttribute('data-highlighted', 'true');
    await expect(targetCard.getByRole('status')).toHaveText('未進行');
    await expect(
      targetCard.getByRole('button', { name: '查看回饋' })
    ).toHaveCount(0);
    await expect(targetCard.getByText('評價未公開')).toHaveCount(0);
    await expect(targetCard.getByText('學員評價')).toHaveCount(0);
    await expect(targetCard.getByText('8 / 10')).toHaveCount(0);
    await expect(
      targetCard.getByText('這段已下架的評價內容不應向導師顯示。')
    ).toHaveCount(0);

    await captureEvidence(
      page,
      'mentor-history-delisted-feedback-hidden-from-notification'
    );
  });

  test('Mentee 歷史紀錄卡片依 is_public=false 顯示「評價未公開」暖黃說明面板、回饋表單連結、自身回饋與編輯入口且不揭露標註者', async ({
    page,
  }) => {
    await setupAuth(page, false);

    await page.route(
      (url) => url.pathname.endsWith('/notifications/unread-count'),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: { unread_count: 0 },
          }),
        })
    );

    await page.route(
      (url) => url.pathname.endsWith('/notifications'),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: { notifications: [], next_cursor: null },
          }),
        })
    );

    const menteeHistoryItems = [
      {
        id: 501,
        sender: {
          user_id: Number(USER_ID),
          role: 'MENTEE',
          status: 'ACCEPT',
          name: '王小明',
          avatar: '',
          job_title: 'Junior Product Designer',
          years_of_experience: 'ONE_TO_THREE',
        },
        participant: {
          user_id: 201,
          role: 'MENTOR',
          status: 'ACCEPT',
          name: 'Zahra Mirzakhani',
          avatar: '',
          job_title: 'Senior UX Designer',
          years_of_experience: 'FIVE_TO_TEN',
        },
        schedule_id: 501,
        dtstart: 1760958000,
        dtend: 1760959800,
        previous_reserve: null,
        messages: [
          {
            id: 5011,
            user_id: Number(USER_ID),
            role: 'MENTEE',
            content: '想請教 UX 作品集呈現策略。',
          },
        ],
        feedback: {
          meeting_happened: false,
          rating: {
            rating: 8,
            content: '感謝導師分享實務經驗。',
            created_at: 1760960000,
            updated_at: 1760960500,
            author_name: '王＊明',
            is_public: false,
          },
          next_step: null,
        },
      },
      {
        id: 502,
        sender: {
          user_id: Number(USER_ID),
          role: 'MENTEE',
          status: 'ACCEPT',
          name: '王小明',
          avatar: '',
          job_title: 'Junior Product Designer',
          years_of_experience: 'ONE_TO_THREE',
        },
        participant: {
          user_id: 202,
          role: 'MENTOR',
          status: 'ACCEPT',
          name: '陳大文',
          avatar: '',
          job_title: 'Staff Engineer',
          years_of_experience: 'FIVE_TO_TEN',
        },
        schedule_id: 502,
        dtstart: 1760871600,
        dtend: 1760873400,
        previous_reserve: null,
        messages: [],
        feedback: {
          meeting_happened: true,
          rating: {
            rating: 10,
            content: '收穫滿滿的一對一交流！',
            created_at: 1760874000,
            updated_at: 1760874000,
            author_name: '王＊明',
            is_public: true,
          },
          next_step: null,
        },
      },
    ];

    await page.route(
      (url) => url.pathname.endsWith(`/users/${USER_ID}/reservations`),
      (route) => {
        const url = new URL(route.request().url());
        const state = url.searchParams.get('state');
        const list = state === 'MENTEE_HISTORY' ? menteeHistoryItems : [];
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeReservationResponse(list)),
        });
      }
    );

    await page.goto('/reservation/mentee?tab=history');

    const unpublicizedCard = page
      .getByTestId('reservation-card')
      .filter({ hasText: 'Zahra Mirzakhani' });
    await expect(unpublicizedCard.getByRole('status')).toHaveText('評價未公開');
    await expect(unpublicizedCard.getByText('已填寫')).toHaveCount(0);
    await expect(
      unpublicizedCard.getByRole('button', { name: '查看回饋' })
    ).toHaveCount(0);

    const publicCard = page
      .getByTestId('reservation-card')
      .filter({ hasText: '陳大文' });
    await expect(
      publicCard.getByRole('button', { name: '查看回饋' })
    ).toBeVisible();

    const expandUnpubBtn = unpublicizedCard.getByRole('button', {
      name: '展開評價未公開說明',
    });
    await expect(expandUnpubBtn).toBeVisible();
    await expandUnpubBtn.hover();
    await expect(
      unpublicizedCard.getByTestId('unpublicized-toggle-tooltip')
    ).toHaveText('展開評價未公開說明');

    await expandUnpubBtn.click();

    const unpublicizedPanel = unpublicizedCard.getByTestId(
      'reservation-feedback-unpublicized'
    );
    await expect(unpublicizedPanel).toBeVisible();
    await expect(unpublicizedPanel.getByRole('note')).toContainText(
      '這場會談已被標註沒有進行，因此評價不會公開；如有疑問可以透過回饋表單聯繫我們。'
    );
    await expect(unpublicizedPanel).not.toContainText('導師標註');
    await expect(unpublicizedPanel).not.toContainText('學員標註');
    await expect(unpublicizedPanel).not.toContainText('Mentor');
    await expect(unpublicizedPanel).not.toContainText('Zahra');

    const feedbackFormLink = unpublicizedPanel.getByRole('link', {
      name: '回饋表單',
    });
    await expect(feedbackFormLink).toBeVisible();
    await expect(feedbackFormLink).toHaveAttribute('href', FEEDBACK_FORM_URL);
    await expect(feedbackFormLink).toHaveAttribute(
      'href',
      'https://forms.gle/594hMVdTyoR3Pgtg9'
    );
    await expect(feedbackFormLink).toHaveAttribute('target', '_blank');
    await expect(feedbackFormLink).toHaveAttribute(
      'rel',
      'noopener noreferrer'
    );

    await expect(unpublicizedPanel.getByText('我的回饋')).toBeVisible();
    await expect(unpublicizedPanel.getByText('8 / 10')).toBeVisible();
    await expect(
      unpublicizedPanel.getByText('感謝導師分享實務經驗。')
    ).toBeVisible();

    const editBtn = unpublicizedPanel.getByRole('button', { name: '編輯' });
    await expect(editBtn).toBeVisible();
    await expect(editBtn).toBeEnabled();
    await editBtn.click();

    const editDialog = page.getByTestId('feedback-dialog-surface');
    await expect(editDialog).toBeVisible();
    await expect(editDialog.locator('textarea')).toHaveValue(
      '感謝導師分享實務經驗。'
    );
    await page.keyboard.press('Escape');
    await expect(editDialog).toBeHidden();

    const collapseUnpubBtn = unpublicizedCard.getByRole('button', {
      name: '收合評價未公開說明',
    });
    await collapseUnpubBtn.hover();
    await expect(
      unpublicizedCard.getByTestId('unpublicized-toggle-tooltip')
    ).toHaveText('收合評價未公開說明');

    await captureEvidence(page, 'mentee-history-unpublicized-feedback-panel');
  });
});
