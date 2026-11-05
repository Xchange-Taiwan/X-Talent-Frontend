import { expect, Page, test } from '@playwright/test';

import { setSignedSessionCookie } from '../../helpers/session';

const USER_ID = '1';
const PAGE_URL = '/reservation/mentee';
const RESERVATION_ID = 301;

function makeSession() {
  return {
    user: {
      id: USER_ID,
      name: 'Test Mentee',
      isMentor: false,
      onBoarding: true,
      jobTitle: '',
      company: '',
      personalLinks: [],
    },
    accessToken: 'mock-token',
    expires: '2099-01-01T00:00:00.000Z',
  };
}

function makeUpcomingReservationWithConversation() {
  return {
    id: RESERVATION_ID,
    sender: {
      user_id: Number(USER_ID),
      role: 'MENTEE',
      status: 'ACCEPT',
      name: 'Test Mentee',
      avatar: '',
      job_title: 'Junior Engineer',
      years_of_experience: 'ONE_TO_THREE',
    },
    participant: {
      user_id: 99,
      role: 'MENTOR',
      status: 'ACCEPT',
      name: 'Bob Mentor',
      avatar: '',
      job_title: 'Staff Engineer',
      years_of_experience: 'FIVE_TO_TEN',
    },
    schedule_id: 10,
    dtstart: 1704099600,
    dtend: 1704103200,
    previous_reserve: null,
    messages: [
      {
        id: 1,
        user_id: Number(USER_ID),
        role: 'MENTEE',
        content: '老師好，想請教系統設計面試的準備重點與常見題型。',
      },
      {
        id: 2,
        user_id: 99,
        role: 'MENTOR',
        content: '沒問題！我們會談時可以先從分散式快取與資料庫分片開始討論。',
      },
    ],
  };
}

async function setupMenteePageMocks(page: Page): Promise<void> {
  await setSignedSessionCookie(page, {
    ...makeSession().user,
    token: 'mock-access-token',
  });

  await page.route(/\/api\/auth\/session/, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeSession()),
      });
    }
    return route.continue();
  });

  await page.route(
    new RegExp(`/v1/users/${USER_ID}/reservations(\\?|$)`),
    (route) => {
      const state = new URL(route.request().url()).searchParams.get('state');
      const reservations =
        state === 'MENTEE_UPCOMING'
          ? [makeUpcomingReservationWithConversation()]
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
}

test.describe('預約會議連結與完整對話紀錄 E2E (#788)', () => {
  test('點擊預約卡片「查看完整訊息」→ 開啟完整對話紀錄彈窗並顯示雙向訊息', async ({
    page,
  }) => {
    await setupMenteePageMocks(page);
    await page.goto(PAGE_URL);

    const card = page.getByTestId('reservation-card').first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    await card.getByRole('button', { name: '查看完整訊息' }).click();

    const dialog = page.getByRole('dialog', { name: '完整對話紀錄' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Bob Mentor')).toBeVisible();
    await expect(
      dialog.getByText('老師好，想請教系統設計面試的準備重點與常見題型。')
    ).toBeVisible();
    await expect(
      dialog.getByText(
        '沒問題！我們會談時可以先從分散式快取與資料庫分片開始討論。'
      )
    ).toBeVisible();
  });

  test('點擊「加入 Google Meet」取得有效連結 → 開啟新分頁並導向 Meet URL', async ({
    page,
  }) => {
    await setupMenteePageMocks(page);

    const targetMeetUrl = 'https://meet.google.com/abc-defg-hij';
    await page.route(
      new RegExp(
        `/v1/users/${USER_ID}/reservations/${RESERVATION_ID}/google-meet`
      ),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: { meet_url: targetMeetUrl },
          }),
        })
    );

    await page.context().route(/meet\.google\.com/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body>Mock Google Meet</body></html>',
      })
    );

    await page.goto(PAGE_URL);

    const card = page.getByTestId('reservation-card').first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    const popupPromise = page.waitForEvent('popup');
    await card.getByRole('button', { name: '加入 Google Meet' }).click();
    const popup = await popupPromise;

    await expect(popup).toHaveURL(targetMeetUrl);
    await popup.close();
  });

  test('點擊「加入 Google Meet」但後端回傳空連結（尚未就緒）→ 顯示找不到會議連結提示', async ({
    page,
  }) => {
    await setupMenteePageMocks(page);

    await page.route(
      new RegExp(
        `/v1/users/${USER_ID}/reservations/${RESERVATION_ID}/google-meet`
      ),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: { meet_url: null },
          }),
        })
    );

    await page.goto(PAGE_URL);

    const card = page.getByTestId('reservation-card').first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    await card.getByRole('button', { name: '加入 Google Meet' }).click();

    await expect(
      page.getByText('此預約尚未就緒，或會議連結不存在。', { exact: true })
    ).toBeVisible({ timeout: 10_000 });
  });
});
