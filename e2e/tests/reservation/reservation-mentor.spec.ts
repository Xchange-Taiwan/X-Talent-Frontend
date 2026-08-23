import { expect, Page, test } from '@playwright/test';

import { setSignedSessionCookie } from '../../helpers/session';

const USER_ID = '1';
const PAGE_URL = '/reservation/mentor';

// ─── Mock payloads ───────────────────────────────────────────────────────────

function makeSession() {
  return {
    user: {
      id: USER_ID,
      name: 'Test Mentor',
      isMentor: true,
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

/**
 * For MENTOR_* states the backend sets sender = mentor (current user),
 * participant = mentee (the counterparty displayed in the card).
 */
function makeReservation(id: number, menteeName: string) {
  return {
    id,
    sender: {
      user_id: Number(USER_ID),
      role: 'MENTOR',
      status: 'PENDING',
      name: 'Test Mentor',
      avatar: '',
      job_title: 'Senior Engineer',
      years_of_experience: 'THREE_TO_FIVE',
    },
    participant: {
      user_id: 99,
      role: 'MENTEE',
      status: 'PENDING',
      name: menteeName,
      avatar: '',
      job_title: 'Engineer',
      years_of_experience: 'ONE_TO_THREE',
    },
    schedule_id: id,
    dtstart: 1704099600,
    dtend: 1704103200,
    previous_reserve: null,
    messages: [],
  };
}

function makePutResponse(id: number, status: 'ACCEPT' | 'REJECT') {
  return {
    code: '0',
    msg: 'ok',
    data: {
      id,
      status,
      my_user_id: Number(USER_ID),
      my_status: status,
      my_role: 'MENTOR',
      user_id: 99,
      schedule_id: id,
      dtstart: 1704099600,
      dtend: 1704103200,
      messages: [],
      previous_reserve: {},
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
 * Mock all 6 reservation list endpoints. The `stateData` map lets each test
 * override specific states with custom payloads; any state not provided gets an
 * empty list.
 */
async function mockReservationListEndpoints(
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

  // Pattern ends with `\?` to match only list endpoints (not /reservations/:id)
  await page.route(
    new RegExp(`/v1/users/${USER_ID}/reservations\\?`),
    (route) => {
      const url = new URL(route.request().url());
      const state = url.searchParams.get('state') ?? '';
      const reservations = data[state] ?? [];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeReservationResponse(reservations)),
      });
    }
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('頁面載入 → 三個 Tab 可見', async ({ page }) => {
  await setSignedSessionCookie(page, {
    id: USER_ID,
    name: 'Test Mentor',
    isMentor: true,
    onBoarding: true,
    token: 'mock-access-token',
  });
  await mockSessionGet(page);
  await mockReservationListEndpoints(page);

  await page.goto(PAGE_URL);

  await expect(page.getByRole('tab', { name: /即將到來/ })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole('tab', { name: /待您回復/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /歷史紀錄/ })).toBeVisible();
});

test('待您回復 Tab → pending 預約卡片顯示，含接受與拒絕按鈕', async ({
  page,
}) => {
  await setSignedSessionCookie(page, {
    id: USER_ID,
    name: 'Test Mentor',
    isMentor: true,
    onBoarding: true,
    token: 'mock-access-token',
  });
  await mockSessionGet(page);
  await mockReservationListEndpoints(page, {
    MENTOR_PENDING: [makeReservation(1, 'Mentee Lee')],
  });

  await page.goto(PAGE_URL);

  await expect(page.getByRole('tab', { name: /待您回復/ })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('tab', { name: /待您回復/ }).click();

  // Card with the mentee's name appears
  await expect(page.getByText('Mentee Lee')).toBeVisible({ timeout: 10_000 });

  // AcceptReservationDialog trigger button
  await expect(page.getByRole('button', { name: /接受/ })).toBeVisible();
});

test('點擊接受並確認 → 卡片移至即將到來 Tab', async ({ page }) => {
  await setSignedSessionCookie(page, {
    id: USER_ID,
    name: 'Test Mentor',
    isMentor: true,
    onBoarding: true,
    token: 'mock-access-token',
  });
  await mockSessionGet(page);

  // State flag: after PUT succeeds, reload should return updated lists
  let putCalled = false;

  // Intercept PUT to flip the state flag
  await page.route(
    new RegExp(`/v1/users/${USER_ID}/reservations/\\d+`),
    (route) => {
      if (route.request().method() === 'PUT') {
        putCalled = true;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makePutResponse(1, 'ACCEPT')),
        });
      }
      return route.continue();
    }
  );

  // List endpoints — respond based on whether PUT has been called
  await page.route(
    new RegExp(`/v1/users/${USER_ID}/reservations\\?`),
    (route) => {
      const url = new URL(route.request().url());
      const state = url.searchParams.get('state') ?? '';
      const reservations = putCalled
        ? state === 'MENTOR_UPCOMING'
          ? [makeReservation(1, 'Mentee Lee')]
          : []
        : state === 'MENTOR_PENDING'
          ? [makeReservation(1, 'Mentee Lee')]
          : [];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeReservationResponse(reservations)),
      });
    }
  );

  await page.goto(PAGE_URL);

  // Navigate to 待您回復 and open the accept dialog
  await expect(page.getByRole('tab', { name: /待您回復/ })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('tab', { name: /待您回復/ }).click();
  await expect(page.getByText('Mentee Lee')).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: /接受/ }).click();

  // Dialog opens at step 'check'; confirm by clicking 接受 inside the dialog
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: '接受' })).toBeVisible({
    timeout: 5_000,
  });
  await dialog.getByRole('button', { name: '接受' }).click();

  // Page reloads; wait for tabs to re-render
  await expect(page.getByRole('tab', { name: /即將到來/ })).toBeVisible({
    timeout: 15_000,
  });

  // The accepted reservation should now appear in 即將到來
  await page.getByRole('tab', { name: /即將到來/ }).click();
  await expect(page.getByText('Mentee Lee')).toBeVisible({ timeout: 10_000 });

  // 待您回復 should now be empty
  await page.getByRole('tab', { name: /待您回復/ }).click();
  await expect(page.getByText('Mentee Lee')).not.toBeVisible();
});

test('點擊拒絕並填入原因後確認 → 卡片從待您回復消失', async ({ page }) => {
  await setSignedSessionCookie(page, {
    id: USER_ID,
    name: 'Test Mentor',
    isMentor: true,
    onBoarding: true,
    token: 'mock-access-token',
  });
  await mockSessionGet(page);

  let putCalled = false;

  await page.route(
    new RegExp(`/v1/users/${USER_ID}/reservations/\\d+`),
    (route) => {
      if (route.request().method() === 'PUT') {
        putCalled = true;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makePutResponse(1, 'REJECT')),
        });
      }
      return route.continue();
    }
  );

  await page.route(
    new RegExp(`/v1/users/${USER_ID}/reservations\\?`),
    (route) => {
      const url = new URL(route.request().url());
      const state = url.searchParams.get('state') ?? '';
      const reservations =
        !putCalled && state === 'MENTOR_PENDING'
          ? [makeReservation(1, 'Mentee Lee')]
          : [];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeReservationResponse(reservations)),
      });
    }
  );

  await page.goto(PAGE_URL);

  // Navigate to 待您回復 and open the accept dialog
  await expect(page.getByRole('tab', { name: /待您回復/ })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('tab', { name: /待您回復/ }).click();
  await expect(page.getByText('Mentee Lee')).toBeVisible({ timeout: 10_000 });

  // 接受/拒絕 are two independent dialogs (AcceptReservationDialog /
  // RejectReservationDialog), not one dialog with internal steps — open the
  // reject dialog directly via its own trigger button on the card.
  await page.getByRole('button', { name: '拒絕' }).click();

  const rejectDialog = page.getByRole('dialog', {
    name: '拒絕學員預約的原因',
  });
  await expect(rejectDialog).toBeVisible({ timeout: 5_000 });

  // Reason textarea must be filled before the dialog's own 拒絕 button submits
  await rejectDialog.getByPlaceholder(/請在此輸入原因/).fill('時間不符');
  await rejectDialog.getByRole('button', { name: '拒絕' }).click();

  // Page reloads; wait for tabs to re-render
  await expect(page.getByRole('tab', { name: /待您回復/ })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('tab', { name: /待您回復/ }).click();

  // Card should be gone
  await expect(page.getByText('Mentee Lee')).not.toBeVisible();
});

test('資料載入中 → Skeleton 顯示且不閃爍錯誤內容', async ({ page }) => {
  await setSignedSessionCookie(page, {
    id: USER_ID,
    name: 'Test Mentor',
    isMentor: true,
    onBoarding: true,
    token: 'mock-access-token',
  });
  await mockSessionGet(page);

  // Hold all reservation responses until we release the promise
  let resolveDelay!: () => void;
  const delay = new Promise<void>((res) => {
    resolveDelay = res;
  });

  await page.route(
    new RegExp(`/v1/users/${USER_ID}/reservations\\?`),
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

  // Release responses and wait for real content
  resolveDelay();

  await expect(page.getByRole('tab', { name: /即將到來/ })).toBeVisible({
    timeout: 15_000,
  });

  // Skeleton should be gone
  await expect(page.locator('.animate-pulse').first()).not.toBeVisible();
});

test.describe('歷史紀錄 Tab 測試', () => {
  test('歷史紀錄 Tab 中有/無訊息的預約卡片與取消 badge 顯示', async ({
    page,
  }) => {
    await setSignedSessionCookie(page, {
      id: USER_ID,
      name: 'Test Mentor',
      isMentor: true,
      onBoarding: true,
      token: 'mock-access-token',
    });
    await mockSessionGet(page);

    const withMsg = {
      ...makeReservation(20, 'Mentee Lee'),
      messages: [
        {
          id: 201,
          user_id: 99,
          role: 'MENTEE',
          content: '學員提問：React 效能問題',
        },
        {
          id: 202,
          user_id: Number(USER_ID),
          role: 'MENTOR',
          content: '導師回覆：好的，我們週三討論',
        },
      ],
    };

    const noMsg = makeReservation(21, 'Mentee Chang');

    // 已由導師(sender)取消
    const cancelledByMentor = makeReservation(22, 'Mentee CancelA');
    cancelledByMentor.sender.status = 'REJECT';

    // 已由學員(participant)取消
    const cancelledByMentee = makeReservation(23, 'Mentee CancelB');
    cancelledByMentee.participant.status = 'REJECT';

    await mockReservationListEndpoints(page, {
      MENTOR_HISTORY: [withMsg, noMsg, cancelledByMentor, cancelledByMentee],
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
      .filter({ hasText: 'Mentee Lee' });
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
    await expect(dialog.getByText('學員提問：React 效能問題')).toBeVisible();
    await expect(
      dialog.getByText('導師回覆：好的，我們週三討論')
    ).toBeVisible();

    // 關閉對話框
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();

    // 2. 驗證沒有訊息的預約卡片 → 不顯示對話按鈕
    const cardNoMsg = page
      .getByTestId('reservation-card')
      .filter({ hasText: 'Mentee Chang' });
    await expect(
      cardNoMsg.getByRole('button', { name: '查看完整對話' })
    ).not.toBeVisible();

    // 3. 驗證取消 badge 顯示
    const cardByMentor = page
      .getByTestId('reservation-card')
      .filter({ hasText: 'Mentee CancelA' });
    await expect(cardByMentor.getByRole('status')).toHaveText('已由導師取消');

    const cardByMentee = page
      .getByTestId('reservation-card')
      .filter({ hasText: 'Mentee CancelB' });
    await expect(cardByMentee.getByRole('status')).toHaveText('已由學員取消');
  });
});
