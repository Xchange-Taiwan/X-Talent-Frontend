import { expect, Page, test } from '@playwright/test';

import { setSignedSessionCookie as setSharedSessionCookie } from '../../helpers/session';

const USER_ID = '1';
const PAGE_URL = '/reservation/mentee';

// ─── Mock payloads ───────────────────────────────────────────────────────────

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

function makeReservation(id: number, mentorName: string) {
  // For MENTEE_* states: sender = mentee (current user), participant = mentor (counterparty)
  return {
    id,
    sender: {
      user_id: Number(USER_ID),
      role: 'MENTEE',
      status: 'PENDING',
      name: 'Test Mentee',
      avatar: '',
      job_title: 'Engineer',
      years_of_experience: 'ONE_TO_THREE',
    },
    participant: {
      user_id: 99,
      role: 'MENTOR',
      status: 'PENDING',
      name: mentorName,
      avatar: '',
      job_title: 'Senior Engineer',
      years_of_experience: 'THREE_TO_FIVE',
    },
    schedule_id: id,
    dtstart: 1704099600,
    dtend: 1704103200,
    previous_reserve: null,
    messages: [] as {
      id: number;
      user_id: number;
      role: string;
      content: string;
    }[],
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function setSignedSessionCookie(page: Page): Promise<void> {
  await setSharedSessionCookie(page, {
    ...makeSession().user,
    token: 'mock-access-token',
  });
}

async function mockSessionGet(page: Page): Promise<void> {
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
}

/**
 * Mock all 6 reservation list endpoints that useReservationData calls in
 * parallel. The `stateData` map lets each test override specific states with
 * custom payloads; any state not provided gets an empty list.
 */
async function mockReservationEndpoints(
  page: Page,
  stateData: Partial<Record<string, object[]>> = {}
): Promise<void> {
  const defaults: Record<string, object[]> = {
    MENTEE_UPCOMING: [],
    MENTEE_PENDING: [],
    MENTOR_UPCOMING: [],
    MENTOR_PENDING: [],
    MENTOR_HISTORY: [],
    MENTEE_HISTORY: [],
  };
  const data = { ...defaults, ...stateData };

  await page.route(new RegExp(`/v1/users/${USER_ID}/reservations`), (route) => {
    const url = new URL(route.request().url());
    const state = url.searchParams.get('state') ?? '';
    const reservations = data[state] ?? [];
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeReservationResponse(reservations)),
    });
  });
}

/**
 * Helper to mock/intercept the reservation cancellation PUT API.
 * Triggers a callback (e.g. setting putCalled = true) upon a successful PUT.
 */
async function mockCancelReservationApi(
  page: Page,
  options: {
    status: number;
    reservationId?: number;
    expectedReason?: string;
    onSuccess?: () => void;
  }
): Promise<void> {
  const { status, reservationId = 1, expectedReason, onSuccess } = options;
  await page.route(
    new RegExp(`/v1/users/${USER_ID}/reservations/\\d+`),
    (route) => {
      if (route.request().method() === 'PUT') {
        if (expectedReason !== undefined) {
          const postData = route.request().postDataJSON();
          const firstMsg = postData?.messages?.[0];
          expect(firstMsg?.content).toBe(expectedReason);
        }

        if (status === 200) {
          onSuccess?.();
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              code: '0',
              msg: 'ok',
              data: {
                id: reservationId,
                status: 'REJECT',
                my_user_id: Number(USER_ID),
                my_status: 'REJECT',
                my_role: 'MENTEE',
                user_id: 99,
                schedule_id: reservationId,
                dtstart: 1704099600,
                dtend: 1704103200,
                messages: [],
                previous_reserve: {},
              },
            }),
          });
        } else {
          return route.fulfill({
            status,
            contentType: 'application/json',
            body: JSON.stringify({
              code: String(status),
              msg: 'error',
              data: null,
            }),
          });
        }
      }
      return route.continue();
    }
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('頁面載入 → 三個 Tab 可見', async ({ page }) => {
  await setSignedSessionCookie(page);
  await mockSessionGet(page);
  await mockReservationEndpoints(page);

  await page.goto(PAGE_URL);

  await expect(page.getByRole('tab', { name: /即將到來/ })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole('tab', { name: /等待回覆/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /歷史紀錄/ })).toBeVisible();
});

test('點擊等待回覆 Tab → pending 預約卡片顯示', async ({ page }) => {
  await setSignedSessionCookie(page);
  await mockSessionGet(page);
  await mockReservationEndpoints(page, {
    MENTEE_PENDING: [makeReservation(1, 'Mentor Wang')],
  });

  await page.goto(PAGE_URL);

  // Wait for tabs to be visible before clicking
  await expect(page.getByRole('tab', { name: /等待回覆/ })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('tab', { name: /等待回覆/ }).click();

  await expect(page.getByText('Mentor Wang')).toBeVisible({ timeout: 10_000 });
});

test('資料載入中 → Skeleton 顯示且不閃爍錯誤內容', async ({ page }) => {
  await setSignedSessionCookie(page);
  await mockSessionGet(page);

  // Delay all reservation responses so the skeleton is visible long enough to assert
  let resolveDelay!: () => void;
  const delay = new Promise<void>((res) => {
    resolveDelay = res;
  });

  await page.route(
    new RegExp(`/v1/users/${USER_ID}/reservations`),
    async (route) => {
      await delay;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeReservationResponse([])),
      });
    }
  );

  await page.goto(PAGE_URL);

  // Skeleton should be visible while responses are held. Uses the same
  // 15s budget as other tests' first post-goto assertion — this is the
  // first assertion after navigating to the real deployed BASE_URL, and a
  // tighter timeout here was timing out on CI cold starts.
  await expect(page.locator('.animate-pulse').first()).toBeVisible({
    timeout: 15_000,
  });

  // Note: ReservationTabs.tsx always renders the TabsList chrome immediately
  // — only TabsContent (the panel body) is skeleton-gated per tab — so the
  // 即將到來 tab trigger itself is visible from first paint, not hidden here.

  // Release the delayed responses and wait for real content to appear
  resolveDelay();

  await expect(page.getByRole('tab', { name: /即將到來/ })).toBeVisible({
    timeout: 15_000,
  });

  // Skeleton should be gone once data has loaded
  await expect(page.locator('.animate-pulse').first()).not.toBeVisible();
});

test.describe('歷史紀錄 Tab 測試', () => {
  test('歷史紀錄 Tab 中有/無訊息的預約卡片與取消 badge 顯示', async ({
    page,
  }) => {
    await setSignedSessionCookie(page);
    await mockSessionGet(page);

    const withMsg = {
      ...makeReservation(10, 'Mentor Wang'),
      messages: [
        {
          id: 101,
          user_id: Number(USER_ID),
          role: 'MENTEE',
          content: '學員提問：React 勾子問題',
        },
        {
          id: 102,
          user_id: 99,
          role: 'MENTOR',
          content: '導師回覆：沒問題，週二見',
        },
      ],
    };

    const noMsg = makeReservation(11, 'Mentor Zhang');

    // 已由導師(participant)取消
    const cancelledByMentor = makeReservation(12, 'Mentor CancelA');
    cancelledByMentor.participant.status = 'REJECT';

    // 已由學員(sender)取消
    const cancelledByMentee = makeReservation(13, 'Mentor CancelB');
    cancelledByMentee.sender.status = 'REJECT';

    await mockReservationEndpoints(page, {
      MENTEE_HISTORY: [withMsg, noMsg, cancelledByMentor, cancelledByMentee],
    });

    await page.goto(PAGE_URL);

    // 切換到歷史紀錄 Tab
    await expect(page.getByRole('tab', { name: /歷史紀錄/ })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('tab', { name: /歷史紀錄/ }).click();

    // 1. 驗證有訊息的預約卡片 → 顯示對話按鈕，點擊後開啟對話框並顯示內容
    const cardWithMsg = page
      .getByTestId('reservation-card')
      .filter({ hasText: 'Mentor Wang' });
    const viewChatBtn = cardWithMsg.getByRole('button', {
      name: '查看完整對話',
    });
    await expect(viewChatBtn).toBeVisible();

    // 點擊開啟對話框
    await viewChatBtn.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: '完整對話紀錄' })
    ).toBeVisible();
    await expect(dialog.getByText('學員提問：React 勾子問題')).toBeVisible();
    await expect(dialog.getByText('導師回覆：沒問題，週二見')).toBeVisible();

    // 關閉對話框
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();

    // 2. 驗證沒有訊息的預約卡片 → 不顯示對話按鈕
    const cardNoMsg = page
      .getByTestId('reservation-card')
      .filter({ hasText: 'Mentor Zhang' });
    await expect(
      cardNoMsg.getByRole('button', { name: '查看完整對話' })
    ).not.toBeVisible();

    // 3. 驗證取消 badge 顯示
    const cardByMentor = page
      .getByTestId('reservation-card')
      .filter({ hasText: 'Mentor CancelA' });
    await expect(cardByMentor.getByRole('status')).toHaveText('已由導師取消');

    const cardByMentee = page
      .getByTestId('reservation-card')
      .filter({ hasText: 'Mentor CancelB' });
    await expect(cardByMentee.getByRole('status')).toHaveText('已由學員取消');
  });

  test('SYSTEM 自動取消之預約於歷史紀錄顯示「已自動取消」標籤，且展開完整對話紀錄彈窗顯示系統自動取消提示', async ({
    page,
  }) => {
    await setSignedSessionCookie(page);
    await mockSessionGet(page);

    const cancelledBySystem = {
      ...makeReservation(14, 'Mentor AutoCancel'),
      cancelled_by: 'SYSTEM',
    };

    await mockReservationEndpoints(page, {
      MENTEE_HISTORY: [cancelledBySystem],
    });

    await page.goto(PAGE_URL);

    await expect(page.getByRole('tab', { name: /歷史紀錄/ })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('tab', { name: /歷史紀錄/ }).click();

    const cardBySystem = page
      .getByTestId('reservation-card')
      .filter({ hasText: 'Mentor AutoCancel' });
    await expect(cardBySystem).toBeVisible({ timeout: 10_000 });
    await expect(cardBySystem.getByRole('status')).toHaveText('已自動取消');
    await expect(
      cardBySystem.getByText(
        '因導師未於預約開始前 24 小時前確認，系統已自動取消此預約。'
      )
    ).toBeVisible();

    const viewChatBtn = cardBySystem.getByRole('button', {
      name: '查看完整對話',
    });
    await expect(viewChatBtn).toBeVisible();
    await viewChatBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: '完整對話紀錄' })
    ).toBeVisible();
    await expect(
      dialog.getByText(
        '因導師未於預約開始前 24 小時前確認，系統已自動取消此預約。'
      )
    ).toBeVisible();
  });

  test('逾時未回覆（距離 dtstart 小於 24 小時）的 PENDING 預約於讀取時自動收斂至「歷史紀錄」Tab', async ({
    page,
  }) => {
    await setSignedSessionCookie(page);
    await mockSessionGet(page);

    const nowUnix = Math.floor(Date.now() / 1000);
    const overduePending = {
      ...makeReservation(15, 'Mentor OverduePending'),
      dtstart: nowUnix + 12 * 3600,
      dtend: nowUnix + 13 * 3600,
      cancelled_by: 'SYSTEM',
    };
    const activePending = {
      ...makeReservation(16, 'Mentor ActivePending'),
      dtstart: nowUnix + 48 * 3600,
      dtend: nowUnix + 49 * 3600,
    };

    await mockReservationEndpoints(page, {
      MENTEE_PENDING: [overduePending, activePending],
      MENTEE_HISTORY: [],
    });

    await page.goto(PAGE_URL);

    const pendingTab = page.getByRole('tab', { name: /等待回覆/ });
    await expect(pendingTab).toBeVisible({ timeout: 15_000 });
    await pendingTab.click();

    // 等待回覆 Tab 僅顯示尚未逾時的預約，逾時未回覆的預約已被濾除
    await expect(page.getByText('Mentor ActivePending')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('Mentor OverduePending')).not.toBeVisible();

    // 切換至歷史紀錄 Tab，驗證該筆逾時 PENDING 預約已自動收斂至歷史紀錄並標示為已自動取消
    await page.getByRole('tab', { name: /歷史紀錄/ }).click();
    const convergedCard = page
      .getByTestId('reservation-card')
      .filter({ hasText: 'Mentor OverduePending' });
    await expect(convergedCard).toBeVisible({ timeout: 10_000 });
    await expect(convergedCard.getByRole('status')).toHaveText('已自動取消');
  });
});

test.describe('學員端空狀態情境文案與 CTA 導向測試', () => {
  test('驗證三個 Tab（「即將到來」、「等待回覆」、「歷史紀錄」）空狀態情境文案，且點擊「前往尋找導師」導向 /mentor-pool', async ({
    page,
  }) => {
    await setSignedSessionCookie(page);
    await mockSessionGet(page);
    await mockReservationEndpoints(page);

    await page.goto(PAGE_URL);

    // 1. 即將到來 Tab 空狀態
    await expect(page.getByRole('tab', { name: /即將到來/ })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('目前尚無資料')).toBeVisible();
    await expect(
      page.getByText(
        '目前還沒有即將到來的預約，立即前往導師池尋找適合的導師吧！'
      )
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: '前往尋找導師' })
    ).toHaveAttribute('href', '/mentor-pool');

    // 2. 等待回覆 Tab 空狀態
    await page.getByRole('tab', { name: /等待回覆/ }).click();
    await expect(page.getByText('目前尚無資料')).toBeVisible();
    await expect(
      page.getByText(
        '目前還沒有等待回覆的預約，前往導師池探索並向導師提出預約申請吧！'
      )
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: '前往尋找導師' })
    ).toHaveAttribute('href', '/mentor-pool');

    // 3. 歷史紀錄 Tab 空狀態與點擊 CTA 導向
    await page.getByRole('tab', { name: /歷史紀錄/ }).click();
    await expect(page.getByText('目前尚無資料')).toBeVisible();
    await expect(
      page.getByText(
        '目前還沒有歷史預約紀錄，前往導師池展開你的第一場職涯交流吧！'
      )
    ).toBeVisible();

    const ctaLink = page.getByRole('link', { name: '前往尋找導師' });
    await expect(ctaLink).toHaveAttribute('href', '/mentor-pool');
    await ctaLink.click();

    await expect(page).toHaveURL(/\/mentor-pool/);
  });
});

test.describe('學員取消預約與即將到來 Tab 測試', () => {
  test('即將到來 Tab 的卡片內容渲染', async ({ page }) => {
    await setSignedSessionCookie(page);
    await mockSessionGet(page);
    await mockReservationEndpoints(page, {
      MENTEE_UPCOMING: [makeReservation(1, 'Mentor Wang')],
    });

    await page.goto(PAGE_URL);

    await expect(page.getByRole('tab', { name: /即將到來/ })).toBeVisible({
      timeout: 15_000,
    });

    // 驗證卡片內容
    await expect(page.getByText('Mentor Wang')).toBeVisible();
    await expect(page.getByText('Senior Engineer')).toBeVisible();
    await expect(page.getByRole('button', { name: '取消預約' })).toBeVisible();
  });

  test('在「等待回覆」tab 點擊取消 → 填寫取消原因並確認 → 卡片從 pending 列表消失', async ({
    page,
  }) => {
    await setSignedSessionCookie(page);
    await mockSessionGet(page);

    let putCalled = false;

    // 攔截取消 PUT 請求
    await mockCancelReservationApi(page, {
      status: 200,
      reservationId: 1,
      expectedReason: '取消原因：臨時有事',
      onSuccess: () => {
        putCalled = true;
      },
    });

    // 依據是否取消回傳資料
    await page.route(
      new RegExp(`/v1/users/${USER_ID}/reservations\\?`),
      (route) => {
        const url = new URL(route.request().url());
        const state = url.searchParams.get('state') ?? '';
        const reservations =
          !putCalled && state === 'MENTEE_PENDING'
            ? [makeReservation(1, 'Mentor Wang')]
            : [];
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeReservationResponse(reservations)),
        });
      }
    );

    await page.goto(PAGE_URL);

    // 前往「等待回覆」tab
    await expect(page.getByRole('tab', { name: /等待回覆/ })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('tab', { name: /等待回覆/ }).click();
    await expect(page.getByText('Mentor Wang')).toBeVisible({
      timeout: 10_000,
    });

    // 點擊「取消預約」打開對話框
    await page.getByRole('button', { name: '取消預約' }).click();

    const cancelDialog = page.getByRole('dialog');
    await expect(cancelDialog).toBeVisible({ timeout: 5_000 });
    await expect(
      cancelDialog.getByRole('heading', { name: '取消預約' })
    ).toBeVisible();

    // 填寫取消原因並確認
    await cancelDialog.locator('textarea').fill('取消原因：臨時有事');
    await cancelDialog.getByRole('button', { name: '取消預約' }).click();

    // 確認對話框關閉，且卡片從列表中消失
    await expect(cancelDialog).not.toBeVisible();
    await expect(page.getByText('Mentor Wang')).not.toBeVisible({
      timeout: 10_000,
    });
  });

  test('在「即將到來」tab 點擊取消已接受的預約 → 卡片從 upcoming 列表消失，並移入 history（含取消原因）', async ({
    page,
  }) => {
    await setSignedSessionCookie(page);
    await mockSessionGet(page);

    let putCalled = false;

    // 攔截取消 PUT 請求
    await mockCancelReservationApi(page, {
      status: 200,
      reservationId: 2,
      expectedReason: '取消原因：時間不合',
      onSuccess: () => {
        putCalled = true;
      },
    });

    // 模擬已取消的預約，移入歷史紀錄並包含取消原因
    const cancelledReservation = {
      ...makeReservation(2, 'Mentor Chen'),
      messages: [
        {
          id: 101,
          user_id: Number(USER_ID),
          role: 'MENTEE',
          content: '取消原因：時間不合',
        },
      ],
    };
    cancelledReservation.sender.status = 'REJECT';

    await page.route(
      new RegExp(`/v1/users/${USER_ID}/reservations\\?`),
      (route) => {
        const url = new URL(route.request().url());
        const state = url.searchParams.get('state') ?? '';
        let reservations: ReturnType<typeof makeReservation>[] = [];
        if (!putCalled && state === 'MENTEE_UPCOMING') {
          reservations = [makeReservation(2, 'Mentor Chen')];
        } else if (putCalled && state === 'MENTEE_HISTORY') {
          reservations = [cancelledReservation];
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeReservationResponse(reservations)),
        });
      }
    );

    await page.goto(PAGE_URL);

    // 驗證「即將到來」tab
    await expect(page.getByRole('tab', { name: /即將到來/ })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Mentor Chen')).toBeVisible({
      timeout: 10_000,
    });

    // 點擊「取消預約」
    await page.getByRole('button', { name: '取消預約' }).click();

    const cancelDialog = page.getByRole('dialog');
    await expect(cancelDialog).toBeVisible({ timeout: 5_000 });

    // 填寫取消原因並送出
    await cancelDialog.locator('textarea').fill('取消原因：時間不合');
    await cancelDialog.getByRole('button', { name: '取消預約' }).click();

    // 驗證「即將到來」中的卡片消失
    await expect(cancelDialog).not.toBeVisible();
    await expect(page.getByText('Mentor Chen')).not.toBeVisible({
      timeout: 10_000,
    });

    // 切換到「歷史紀錄」驗證
    await page.getByRole('tab', { name: /歷史紀錄/ }).click();
    const cardInHistory = page
      .getByTestId('reservation-card')
      .filter({ hasText: 'Mentor Chen' });
    await expect(cardInHistory).toBeVisible({ timeout: 10_000 });
    await expect(cardInHistory.getByRole('status')).toHaveText('已由學員取消');

    // 驗證取消原因是否正確呈現於對話框
    const viewChatBtn = cardInHistory.getByRole('button', {
      name: '查看完整對話',
    });
    await expect(viewChatBtn).toBeVisible();
    await viewChatBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('取消原因：時間不合')).toBeVisible();
  });

  test('取消 API 失敗 → 顯示錯誤提示，卡片維持原狀', async ({ page }) => {
    await setSignedSessionCookie(page);
    await mockSessionGet(page);

    // 攔截取消 PUT 請求並回傳 500 錯誤
    await mockCancelReservationApi(page, {
      status: 500,
      expectedReason: '隨便填寫',
    });

    await page.route(
      new RegExp(`/v1/users/${USER_ID}/reservations\\?`),
      (route) => {
        const url = new URL(route.request().url());
        const state = url.searchParams.get('state') ?? '';
        const reservations =
          state === 'MENTEE_PENDING' ? [makeReservation(1, 'Mentor Wang')] : [];
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeReservationResponse(reservations)),
        });
      }
    );

    await page.goto(PAGE_URL);

    await expect(page.getByRole('tab', { name: /等待回覆/ })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('tab', { name: /等待回覆/ }).click();
    await expect(page.getByText('Mentor Wang')).toBeVisible({
      timeout: 10_000,
    });

    // 點擊取消預約並送出
    await page.getByRole('button', { name: '取消預約' }).click();
    const cancelDialog = page.getByRole('dialog');
    await expect(cancelDialog).toBeVisible({ timeout: 5_000 });

    await cancelDialog.locator('textarea').fill('隨便填寫');
    await cancelDialog.getByRole('button', { name: '取消預約' }).click();

    // 驗證是否顯示錯誤 Toast 提示（取消預約失敗,請稍後再試）
    await expect(
      page.getByText('取消預約失敗,請稍後再試', { exact: true })
    ).toBeVisible({
      timeout: 10_000,
    });

    // 驗證卡片仍留在列表，並未消失
    await expect(page.getByText('Mentor Wang')).toBeVisible();
  });
});

test.describe('預約管理頁 UX 細節與轉址驗證 (#860)', () => {
  test('直接造訪 /reservation → 自動轉址至 /reservation/mentee', async ({
    page,
  }) => {
    await setSignedSessionCookie(page);
    await mockSessionGet(page);
    await mockReservationEndpoints(page);

    await page.goto('/reservation');

    await expect(page).toHaveURL(/\/reservation\/mentee/);
    await expect(page.getByRole('tab', { name: /即將到來/ })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('tab', { name: /等待回覆/ })).toBeVisible();
  });

  test('切換至「歷史紀錄」分頁載入期間，保留「即將到來 1」與「等待回覆 1」徽章計數不閃跳歸 0', async ({
    page,
  }) => {
    await setSignedSessionCookie(page);
    await mockSessionGet(page);

    let resolveHistory!: () => void;
    const historyDelay = new Promise<void>((res) => {
      resolveHistory = res;
    });

    await page.route(
      new RegExp(`/v1/users/${USER_ID}/reservations\\?`),
      async (route) => {
        const url = new URL(route.request().url());
        const state = url.searchParams.get('state') ?? '';
        if (state === 'MENTEE_UPCOMING') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(
              makeReservationResponse([makeReservation(1, 'Mentor Upcoming')])
            ),
          });
        }
        if (state === 'MENTEE_PENDING') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(
              makeReservationResponse([makeReservation(2, 'Mentor Pending')])
            ),
          });
        }
        if (state === 'MENTEE_HISTORY') {
          await historyDelay;
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(
              makeReservationResponse([makeReservation(3, 'Mentor History')])
            ),
          });
        }
        return route.continue();
      }
    );

    await page.goto(PAGE_URL);

    const upcomingTab = page.getByRole('tab', { name: /即將到來/ });
    const pendingTab = page.getByRole('tab', { name: /等待回覆/ });
    const historyTab = page.getByRole('tab', { name: /歷史紀錄/ });

    await expect(upcomingTab).toHaveText(/即將到來\s*1/, { timeout: 15_000 });
    await expect(pendingTab).toHaveText(/等待回覆\s*1/, { timeout: 15_000 });

    // 點擊切換至歷史紀錄（此時 MENTEE_HISTORY API 仍在等待回應）
    await historyTab.click();

    // 載入期間徽章計數維持 1，不閃跳歸 0
    await expect(upcomingTab).toHaveText(/即將到來\s*1/);
    await expect(pendingTab).toHaveText(/等待回覆\s*1/);

    resolveHistory();
    await expect(page.getByText('Mentor History')).toBeVisible({
      timeout: 10_000,
    });
    await expect(historyTab).toHaveText(/歷史紀錄\s*1/);
  });

  test('歷史紀錄中已取消且含原始提問與取消原因之預約，卡片與完整對話彈窗清楚區分「學員留言／預約提問」與「取消原因」', async ({
    page,
  }) => {
    await setSignedSessionCookie(page);
    await mockSessionGet(page);

    const cancelledWithBothMsgs = {
      ...makeReservation(25, 'Mentor BothMessages'),
      messages: [
        {
          id: 201,
          user_id: Number(USER_ID),
          role: 'MENTEE',
          content: '原始提問 M1：想請教前端架構設計',
        },
        {
          id: 202,
          user_id: Number(USER_ID),
          role: 'MENTEE',
          content: '取消原因 M2：臨時有緊急會議需改期',
        },
      ],
    };
    cancelledWithBothMsgs.sender.status = 'REJECT';

    await mockReservationEndpoints(page, {
      MENTEE_HISTORY: [cancelledWithBothMsgs],
    });

    await page.goto(PAGE_URL);

    await expect(page.getByRole('tab', { name: /歷史紀錄/ })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('tab', { name: /歷史紀錄/ }).click();

    const card = page
      .getByTestId('reservation-card')
      .filter({ hasText: 'Mentor BothMessages' });
    await expect(card).toBeVisible({ timeout: 10_000 });

    // 卡片外層預覽同時顯示原始提問（學員留言）與取消原因（取消原因）
    await expect(card.getByText('學員留言')).toBeVisible();
    await expect(
      card.getByText('原始提問 M1：想請教前端架構設計')
    ).toBeVisible();
    await expect(card.getByText('取消原因', { exact: true })).toBeVisible();
    await expect(
      card.getByText('取消原因 M2：臨時有緊急會議需改期')
    ).toBeVisible();

    // 開啟完整對話紀錄彈窗，驗證「預約提問」與「取消原因」標籤清楚區分
    await card.getByRole('button', { name: '查看完整對話' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('預約提問')).toBeVisible();
    await expect(dialog.getByText('取消原因', { exact: true })).toBeVisible();
    await expect(
      dialog.getByText('原始提問 M1：想請教前端架構設計')
    ).toBeVisible();
    await expect(
      dialog.getByText('取消原因 M2：臨時有緊急會議需改期')
    ).toBeVisible();
  });
});
