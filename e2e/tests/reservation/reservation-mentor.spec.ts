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
 * Mock all 5 reservation list endpoints. The `stateData` map lets each test
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
    HISTORY: [],
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

  await page.getByRole('button', { name: /接受/ }).click();

  // Dialog opens at step 'check'; click 拒絕 to go to step 'reject'
  await expect(page.getByRole('button', { name: /拒絕/ }).first()).toBeVisible({
    timeout: 5_000,
  });
  await page.getByRole('button', { name: /拒絕/ }).first().click();

  // Step 'reject': textarea must be filled before confirming
  await page.getByPlaceholder(/請在此輸入原因/).fill('時間不符');

  // Confirm rejection
  await page.getByRole('button', { name: /拒絕/ }).click();

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

  // Skeleton should be visible while responses are held
  await expect(page.locator('.animate-pulse').first()).toBeVisible({
    timeout: 10_000,
  });

  // Real tabs must not be visible yet
  await expect(page.getByRole('tab', { name: /即將到來/ })).not.toBeVisible();

  // Release responses and wait for real content
  resolveDelay();

  await expect(page.getByRole('tab', { name: /即將到來/ })).toBeVisible({
    timeout: 15_000,
  });

  // Skeleton should be gone
  await expect(page.locator('.animate-pulse').first()).not.toBeVisible();
});
