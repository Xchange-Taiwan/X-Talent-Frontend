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
    messages: [],
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
 * Mock all 5 reservation list endpoints that useReservationData calls in
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
    HISTORY: [],
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

// ─── Tests ───────────────────────────────────────────────────────────────────

test('頁面載入 → 三個 Tab 可見', async ({ page }) => {
  await setSignedSessionCookie(page);
  await mockSessionGet(page);
  await mockReservationEndpoints(page);

  await page.goto(PAGE_URL);

  await expect(page.getByRole('tab', { name: /即將到來/ })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole('tab', { name: /等待回復/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /歷史紀錄/ })).toBeVisible();
});

test('點擊等待回復 Tab → pending 預約卡片顯示', async ({ page }) => {
  await setSignedSessionCookie(page);
  await mockSessionGet(page);
  await mockReservationEndpoints(page, {
    MENTEE_PENDING: [makeReservation(1, 'Mentor Wang')],
  });

  await page.goto(PAGE_URL);

  // Wait for tabs to be visible before clicking
  await expect(page.getByRole('tab', { name: /等待回復/ })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('tab', { name: /等待回復/ }).click();

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

  // Skeleton should be visible while responses are held
  await expect(page.locator('.animate-pulse').first()).toBeVisible({
    timeout: 10_000,
  });

  // Tabs (real content) must not be visible yet
  await expect(page.getByRole('tab', { name: /即將到來/ })).not.toBeVisible();

  // Release the delayed responses and wait for real content to appear
  resolveDelay();

  await expect(page.getByRole('tab', { name: /即將到來/ })).toBeVisible({
    timeout: 15_000,
  });

  // Skeleton should be gone once data has loaded
  await expect(page.locator('.animate-pulse').first()).not.toBeVisible();
});
