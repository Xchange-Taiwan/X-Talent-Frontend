import { expect, Page, test } from '@playwright/test';

import { captureEvidence } from '../../helpers/evidence';
import { setSignedSessionCookie } from '../../helpers/session';

const MENTEE_USER_ID = '1';
const MENTOR_USER_ID = '2';

function makeMenteeSession() {
  return {
    user: {
      id: MENTEE_USER_ID,
      name: 'Test Mentee',
      isMentor: false,
      onBoarding: true,
      jobTitle: 'Junior Product Designer',
      company: 'Studio X',
      personalLinks: [],
    },
    accessToken: 'mock-token',
    expires: '2099-01-01T00:00:00.000Z',
  };
}

function makeMentorSession() {
  return {
    user: {
      id: MENTOR_USER_ID,
      name: 'Emily Chen',
      isMentor: true,
      onBoarding: true,
      jobTitle: 'Senior UI/UX Designer',
      company: 'Tech Corp',
      personalLinks: [],
    },
    accessToken: 'mock-token',
    expires: '2099-01-01T00:00:00.000Z',
  };
}

async function mockCommonAuxiliaryRoutes(page: Page) {
  await page.route(/\/v1\/(?:users\/[^/]+\/)?notifications/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: '0',
        msg: 'ok',
        data: {
          unread_count: 0,
          notifications: [],
          items: [],
          next_cursor: null,
        },
      }),
    })
  );

  await page.route(/\/v1\/mentors([?]|$)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: '0',
        msg: 'ok',
        data: { mentors: [], next_id: null },
      }),
    })
  );
}

test.describe('#881 預約生命週期與回饋資格領域政策 (reservationLifecyclePolicy)', () => {
  test('Mentor 分頁過濾與 SYSTEM 自動取消：upcoming 排除已取消預約並導入歷史紀錄、顯示已自動取消標籤與 24 小時說明橫幅及對話彈窗', async ({
    page,
  }) => {
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
    await mockCommonAuxiliaryRoutes(page);

    await page.route(
      new RegExp(`/v1/users/${MENTOR_USER_ID}/reservations/pending-feedback$`),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: { reservations: [] },
          }),
        })
    );

    const nowSec = Math.floor(Date.now() / 1000);
    const activeUpcomingItem = {
      id: 801,
      sender: {
        user_id: 101,
        role: 'MENTEE',
        status: 'ACCEPT',
        name: '王小明',
        avatar: '',
        job_title: 'Frontend Engineer',
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
      schedule_id: 801,
      dtstart: nowSec + 7200,
      dtend: nowSec + 9000,
      previous_reserve: null,
      messages: [
        {
          id: 8011,
          user_id: 101,
          role: 'MENTEE',
          content: '期待與導師討論大型前端專案模組化設計！',
        },
      ],
    };

    const systemCancelledFromUpcoming = {
      id: 802,
      cancelled_by: 'SYSTEM',
      sender: {
        user_id: 102,
        role: 'MENTEE',
        status: 'PENDING',
        name: '林佳穎',
        avatar: '',
        job_title: 'Product Designer',
        years_of_experience: 'ONE_TO_THREE',
      },
      participant: {
        user_id: Number(MENTOR_USER_ID),
        role: 'MENTOR',
        status: 'PENDING',
        name: 'Emily Chen',
        avatar: '',
        job_title: 'Senior UI/UX Designer',
        years_of_experience: 'FIVE_TO_TEN',
      },
      schedule_id: 802,
      dtstart: nowSec - 86400,
      dtend: nowSec - 84600,
      previous_reserve: null,
      messages: [],
    };

    await page.route(
      new RegExp(`/v1/users/${MENTOR_USER_ID}/reservations([?]|$)`),
      (route) => {
        const state = new URL(route.request().url()).searchParams.get('state');
        const reservations =
          state === 'MENTOR_UPCOMING'
            ? [activeUpcomingItem, systemCancelledFromUpcoming]
            : [];
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: { reservations, next_dtend: 0 },
          }),
        });
      }
    );

    await page.goto('/reservation/mentor?tab=upcoming');

    await expect(page.getByText('王小明')).toBeVisible();
    await expect(page.getByText('林佳穎')).toHaveCount(0);

    await page.getByRole('tab', { name: /歷史紀錄/ }).click();

    const systemCard = page.locator('[data-reservation-id="802"]');
    await expect(systemCard).toBeVisible();
    await expect(systemCard.getByRole('status')).toHaveText('已自動取消');
    await expect(
      systemCard.getByText(
        '因您未於預約開始前 24 小時前確認，系統已自動取消此預約。'
      )
    ).toBeVisible();

    await captureEvidence(page, 'mentor-history-system-auto-cancelled-card');

    await systemCard.getByRole('button', { name: '查看完整對話' }).click();

    const conversationDialog = page.getByRole('dialog', {
      name: '完整對話紀錄',
    });
    await expect(conversationDialog).toBeVisible();
    await expect(
      conversationDialog.getByText(
        '因您未於預約開始前 24 小時前確認，系統已自動取消此預約。'
      )
    ).toBeVisible();

    await captureEvidence(
      page,
      'mentor-conversation-dialog-system-auto-cancel'
    );
  });

  test('深連結守衛與 [DECISION-02] 步驟推導：?feedback=<id> 抑制登入待回饋佇列彈窗，且 Mentee nextStep=RATE 直接開啟第 2 頁評分步驟', async ({
    page,
  }) => {
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
    await mockCommonAuxiliaryRoutes(page);

    await page.route(
      new RegExp(`/v1/users/${MENTEE_USER_ID}/reservations/pending-feedback$`),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: {
              reservations: [
                {
                  id: 501,
                  counterparty_name: '陳大文',
                  counterparty_avatar: '',
                  viewer_role: 'MENTEE',
                  dtstart: 1760958000,
                  dtend: 1760959800,
                  cancelled_by: null,
                  feedback: {
                    meeting_happened: null,
                    rating: null,
                    next_step: 'ANSWER',
                  },
                },
                {
                  id: 503,
                  counterparty_name: '蘇元貞',
                  counterparty_avatar: '',
                  viewer_role: 'MENTEE',
                  dtstart: 1760961600,
                  dtend: 1760963400,
                  cancelled_by: null,
                  feedback: {
                    meeting_happened: null,
                    rating: null,
                    next_step: 'ANSWER',
                  },
                },
              ],
            },
          }),
        })
    );

    await page.route(
      new RegExp(`/v1/users/${MENTEE_USER_ID}/reservations([?]|$)`),
      (route) => {
        const state = new URL(route.request().url()).searchParams.get('state');
        const reservations =
          state === 'MENTEE_HISTORY'
            ? [
                {
                  id: 502,
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
                    user_id: 202,
                    role: 'MENTOR',
                    status: 'ACCEPT',
                    name: '陳大文',
                    avatar: '',
                    job_title: 'Principal Architect',
                    years_of_experience: 'TEN_PLUS',
                  },
                  schedule_id: 502,
                  dtstart: 1760958000,
                  dtend: 1760959800,
                  previous_reserve: null,
                  messages: [
                    {
                      id: 5021,
                      user_id: Number(MENTEE_USER_ID),
                      role: 'MENTEE',
                      content: '想請教領域驅動設計與前端深模組邊界切分經驗。',
                    },
                  ],
                  feedback: {
                    meeting_happened: true,
                    rating: null,
                    next_step: 'RATE',
                  },
                },
              ]
            : [];
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: { reservations, next_dtend: 0 },
          }),
        });
      }
    );

    // 1. Landing on an eligible browsing route with ?feedback=<reservationId> must suppress the login queue popup
    await page.goto('/mentor-pool?feedback=501');
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByTestId('feedback-queue-counter')).toHaveCount(0);

    // 2. Navigating to Mentee history deep link ?feedback=502 (nextStep === 'RATE') opens Step 2 directly
    await page.goto('/reservation/mentee?tab=history&feedback=502');

    const feedbackSurface = page.getByTestId('feedback-dialog-surface');
    await expect(feedbackSurface).toBeVisible();
    await expect(
      feedbackSurface.getByText('步驟 2 / 2 · 交流回饋')
    ).toBeVisible();
    await expect(feedbackSurface.getByText('為本次會議評分')).toBeVisible();
    await expect(page.getByTestId('feedback-queue-counter')).toHaveCount(0);

    await captureEvidence(page, 'mentee-deeplink-feedback-rate-step-dialog');
  });
});
