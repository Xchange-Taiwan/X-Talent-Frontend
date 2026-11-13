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
      job_title: 'Senior UX Designer',
      years_of_experience: 'FIVE_TO_TEN',
    },
    schedule_id: id,
    dtstart: 1761649200,
    dtend: 1761651000,
    previous_reserve: null,
    messages: [
      {
        id: id * 10 + 1,
        user_id: Number(MENTEE_USER_ID),
        role: 'MENTEE',
        content: '想請教作品集整理與跨團隊設計協作建議。',
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
      job_title: 'Product Designer',
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
    dtstart: 1761649200,
    dtend: 1761651000,
    previous_reserve: null,
    messages: [
      {
        id: id * 10 + 1,
        user_id: 200 + id,
        role: 'MENTEE',
        content: '期待向導師請教設計系統與職涯發展方向。',
      },
    ],
    ...(feedback ? { feedback } : {}),
  };
}

interface MockNotificationRecord {
  id: number;
  type: string;
  read_at: number | null;
  created_at: number;
  metadata: Record<string, unknown>;
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

test.describe('Mentee 送出回饋後通知 Mentor 與評價未公開面板 (#734)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('Mentor 點擊站內「您收到新的回饋」通知（顯示完整學員姓名）→ 導向歷史紀錄定位高亮並自動展開公開評價；若評價不公開（is_public: false）則不顯示評價內容', async ({
    page,
  }) => {
    const mentorSession = makeMentorSession();
    await setSignedSessionCookie(page, {
      ...mentorSession.user,
      token: 'mock-access-token',
    });
    await page.route(/\/api\/auth\/session/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mentorSession),
      })
    );

    const mentorHistory = [
      makeMentorHistoryReservation(201, 'Zahra Mirzakhani', {
        meeting_happened: true,
        my_meeting_happened: true,
        rating: {
          rating: 10,
          content: '非常感謝導師具體拆解跨職能溝通與設計系統落地策略！',
          created_at: 1761652000,
          updated_at: 1761652000,
          author_name: 'Z***',
          is_public: true,
        },
        next_step: null,
      }),
      makeMentorHistoryReservation(202, '王小明', {
        meeting_happened: false,
        my_meeting_happened: false,
        rating: {
          rating: 7,
          content: '這則已被標註未進行而不公開的評語絕不可顯示給導師',
          created_at: 1761565600,
          updated_at: 1761569200,
          author_name: '王＊明',
          is_public: false,
        },
        next_step: null,
      }),
    ];

    await mockMentorReservations(page, mentorHistory);
    await mockNotifications(page, [
      {
        id: 9301,
        type: 'feedback_received',
        read_at: null,
        created_at: Math.floor(Date.now() / 1000),
        metadata: {
          role: 'mentor',
          counterparty_name: 'Zahra Mirzakhani',
          reservation_id: 201,
        },
      },
    ]);

    await page.goto('/');
    await openVisibleNotificationBell(page);

    const newFeedbackLink = page.getByRole('link', {
      name: /您收到新的回饋/,
    });
    await expect(newFeedbackLink).toBeVisible();
    await expect(newFeedbackLink).toHaveAttribute(
      'href',
      '/reservation/mentor?tab=history&reservationId=201'
    );
    await expect(
      page.getByText('Zahra Mirzakhani 為您留下了一則會談回饋，前往查看。')
    ).toBeVisible();

    await captureEvidence(
      page,
      '734-mentor-notification-bell-feedback-received'
    );

    const markReadDone = page.waitForResponse(
      (res) =>
        res.url().includes('/notifications/9301') &&
        res.request().method() === 'PUT'
    );
    await newFeedbackLink.click();
    await markReadDone;

    await expect(page).toHaveURL('/reservation/mentor?tab=history', {
      timeout: 15_000,
    });
    await expect(page.getByRole('dialog')).not.toBeVisible();

    const card201 = page.locator('[data-reservation-id="201"]');
    await expect(card201).toBeVisible();
    await expect(card201).toHaveAttribute('data-highlighted', 'true');
    await expect(
      card201.getByRole('button', { name: '查看紀錄' })
    ).toHaveAttribute('aria-expanded', 'true');
    await expect(card201.getByTestId('mentor-feedback-meta')).toContainText(
      'Z***'
    );
    await expect(card201.getByTestId('mentor-feedback-meta')).toContainText(
      '10 / 10'
    );
    await expect(
      card201.getByText('非常感謝導師具體拆解跨職能溝通與設計系統落地策略！')
    ).toBeVisible();

    await captureEvidence(
      page,
      '734-mentor-history-feedback-received-card-highlighted'
    );

    // When a previously sent notification/email deep-links to an overturned unpublicized session (is_public: false),
    // Mentor locates the card but never sees the unpublicized score or comment.
    await page.goto('/reservation/mentor?tab=history&reservationId=202');
    await expect(page).toHaveURL('/reservation/mentor?tab=history', {
      timeout: 15_000,
    });

    const card202 = page.locator('[data-reservation-id="202"]');
    await expect(card202).toBeVisible();
    await expect(card202).toHaveAttribute('data-highlighted', 'true');
    await expect(card202.getByRole('status')).toHaveText('未進行');
    await expect(
      card202.getByText('這則已被標註未進行而不公開的評語絕不可顯示給導師')
    ).toHaveCount(0);
    await expect(card202.getByText('7 / 10')).toHaveCount(0);
  });

  test('未登入 Mentor 點擊回饋通知信連結 → 導向登入並保留 callbackUrl → 登入後導回歷史紀錄定位高亮並自動展開回饋卡片', async ({
    page,
  }) => {
    const mentorSession = makeMentorSession();
    const mentorHistory = [
      makeMentorHistoryReservation(201, 'Zahra Mirzakhani', {
        meeting_happened: true,
        my_meeting_happened: true,
        rating: {
          rating: 9,
          content: '導師給予的職涯建議非常實用且具體！',
          created_at: 1761652000,
          updated_at: 1761652000,
          author_name: 'Z***',
          is_public: true,
        },
        next_step: null,
      }),
    ];

    await mockMentorReservations(page, mentorHistory);
    await mockNotifications(page, []);

    let isAuthenticated = false;
    await page.route(/\/api\/auth\/session/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isAuthenticated ? mentorSession : {}),
      })
    );

    await page.route(/\/api\/auth\/callback\/credentials/, async (route) => {
      isAuthenticated = true;
      await setSignedSessionCookie(page, {
        ...mentorSession.user,
        token: 'mock-access-token',
      });
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: new URL('/', page.url()).origin }),
      });
    });

    await page.goto('/reservation/mentor?tab=history&reservationId=201');

    await expect(page).toHaveURL(
      /\/auth\/signin\?callbackUrl=%2Freservation%2Fmentor%3Ftab%3Dhistory%26reservationId%3D201/,
      { timeout: 15_000 }
    );

    await page.fill('input[name="email"]', 'mentor@example.com');
    await page.fill('input[name="password"]', 'Password1234');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/reservation/mentor?tab=history', {
      timeout: 15_000,
    });

    const card201 = page.locator('[data-reservation-id="201"]');
    await expect(card201).toBeVisible();
    await expect(card201).toHaveAttribute('data-highlighted', 'true');
    await expect(
      card201.getByText('導師給予的職涯建議非常實用且具體！')
    ).toBeVisible();
  });

  test('Mentee「我的預約 → 歷史紀錄」依 is_public 顯示：false 顯示暖黃「評價未公開」標籤、說明文字與回饋表單連結（不揭露標註方）；true 維持顯示「查看回饋」', async ({
    page,
  }) => {
    const menteeSession = makeMenteeSession();
    await setSignedSessionCookie(page, {
      ...menteeSession.user,
      token: 'mock-access-token',
    });
    await page.route(/\/api\/auth\/session/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(menteeSession),
      })
    );

    const menteeHistory = [
      makeMenteeHistoryReservation(101, 'Zahra Mirzakhani', {
        meeting_happened: false,
        rating: {
          rating: 8,
          content: '感謝導師分享作品集與設計職涯規劃建議。',
          created_at: 1761652000,
          updated_at: 1761652600,
          author_name: 'T***',
          is_public: false,
        },
        next_step: null,
      }),
      makeMenteeHistoryReservation(102, 'Emily Chen', {
        meeting_happened: true,
        rating: {
          rating: 10,
          content: '收穫滿滿的一場一對一交流！',
          created_at: 1761479200,
          updated_at: 1761479200,
          author_name: 'T***',
          is_public: true,
        },
        next_step: null,
      }),
    ];

    await mockMenteeReservations(page, menteeHistory);
    await mockNotifications(page, []);

    await page.goto('/reservation/mentee');
    await page.getByRole('tab', { name: /歷史紀錄/ }).click();

    const publicCard = page.locator('[data-reservation-id="102"]');
    await expect(
      publicCard.getByRole('button', { name: '查看回饋' })
    ).toBeVisible();
    await expect(publicCard.getByRole('status')).toHaveCount(0);

    const unpublicizedCard = page.locator('[data-reservation-id="101"]');
    await expect(unpublicizedCard.getByRole('status')).toHaveText('評價未公開');
    const expandBtn = unpublicizedCard.getByRole('button', {
      name: '展開評價未公開說明',
    });
    await expect(expandBtn).toBeVisible();
    await expect(expandBtn).toHaveAttribute('aria-expanded', 'false');

    await expandBtn.click();

    const collapseBtn = unpublicizedCard.getByRole('button', {
      name: '收合評價未公開說明',
    });
    await expect(collapseBtn).toBeVisible();
    await expect(collapseBtn).toHaveAttribute('aria-expanded', 'true');

    const unpublicizedPanel = unpublicizedCard.getByTestId(
      'reservation-feedback-unpublicized'
    );
    await expect(unpublicizedPanel).toBeVisible();

    const noticeNote = unpublicizedPanel.getByRole('note');
    await expect(noticeNote).toContainText('評價未公開');
    await expect(noticeNote).toContainText(
      '這場會談已被標註沒有進行，因此評價不會公開；如有疑問可以透過回饋表單聯繫我們。'
    );
    await expect(noticeNote.textContent()).resolves.not.toMatch(
      /導師標註|學員標註/
    );

    const feedbackFormLink = noticeNote.getByRole('link', {
      name: '回饋表單',
    });
    await expect(feedbackFormLink).toBeVisible();
    await expect(feedbackFormLink).toHaveAttribute('target', '_blank');
    await expect(feedbackFormLink).toHaveAttribute('href', /^https:\/\//);

    await expect(unpublicizedPanel.getByText('我的回饋')).toBeVisible();
    await expect(unpublicizedPanel.getByText('8 / 10')).toBeVisible();
    await expect(
      unpublicizedPanel.getByText('感謝導師分享作品集與設計職涯規劃建議。')
    ).toBeVisible();
    await expect(
      unpublicizedPanel.getByRole('button', { name: '編輯' })
    ).toBeVisible();

    await collapseBtn.hover();
    await expect(
      unpublicizedCard.getByTestId('unpublicized-toggle-tooltip')
    ).toHaveText('收合評價未公開說明');

    await captureEvidence(
      page,
      '734-mentee-history-unpublicized-feedback-expanded'
    );
  });
});
