import { expect, type Locator, type Page } from '@playwright/test';
import path from 'path';

export const MENTEE_AUTH_FILE = path.join(__dirname, '../../.auth/mentee.json');
export const MENTOR_AUTH_FILE = path.join(__dirname, '../../.auth/mentor.json');

export interface SessionUser {
  id: string;
  name: string;
}

/**
 * Reads the NextAuth session directly from the browser (same-origin
 * `fetch`, whatever backend URL the running app's bundle is actually
 * configured with) rather than guessing the BFF's base URL from outside the
 * page - the two dedicated canary accounts don't have a fixed, known user ID
 * the way the mocked reservation specs' hardcoded dev-fixture IDs do.
 */
export async function getSessionUser(page: Page): Promise<SessionUser> {
  const session = await page.evaluate(async () => {
    const res = await fetch('/api/auth/session');
    return res.json();
  });

  if (!session?.user?.id) {
    throw new Error(
      'No authenticated session user found - the mentee/mentor storageState may have expired or failed to load.'
    );
  }

  return { id: String(session.user.id), name: session.user.name ?? '' };
}

export interface TargetSlot {
  startMs: number;
  dateKey: string;
  hour: string;
  minute: string;
  label: string;
}

/**
 * Picks a real, ~2-hours-from-now slot for the mentor to open up. Computed
 * entirely inside the mentor's browser (one `evaluate` call) so the date
 * key, hour/minute picker values, and the human-readable button label the
 * mentee will later search for are always mutually consistent, regardless
 * of the test runner's own OS timezone. Pass `fixedStartMs` to rebuild the
 * same fields for an explicit start instead (see avoidExistingSlots).
 */
export async function computeTargetSlot(
  page: Page,
  fixedStartMs?: number
): Promise<TargetSlot> {
  return page.evaluate((fixedStartMs) => {
    const DURATION_MINUTES = 30;
    const pad = (n: number) => String(n).padStart(2, '0');
    const describe = (start: Date) => {
      const end = new Date(start.getTime() + DURATION_MINUTES * 60 * 1000);
      // Same format MenteeBookingForm's slot buttons render via
      // formatBookingSlotTime (src/lib/profile/scheduleFormatters.ts).
      const timeFmt: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      };
      return {
        startMs: start.getTime(),
        dateKey: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
        hour: pad(start.getHours()),
        minute: pad(start.getMinutes()),
        label: `${start.toLocaleTimeString('en-US', timeFmt)} – ${end.toLocaleTimeString('en-US', timeFmt)}`,
      };
    };

    if (fixedStartMs !== undefined) return describe(new Date(fixedStartMs));

    const now = new Date();
    const start = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    start.setSeconds(0, 0);

    // Snap to the calendar's 15-minute picker options (00/15/30/45),
    // rolling the hour (and, at the day boundary, the date) forward via
    // native Date arithmetic when rounding reaches 60.
    const snappedMinutes = Math.round(start.getMinutes() / 15) * 15;
    if (snappedMinutes >= 60) {
      start.setHours(start.getHours() + 1, 0);
    } else {
      start.setMinutes(snappedMinutes);
    }

    // MentorScheduleDialog's calendar only ever shows the currently-open
    // month - this test doesn't drive month navigation - so a rollover into
    // next month (from the +2h offset above, OR from the 15-minute rounding
    // step just above pushing e.g. 23:55 -> 00:00 the next day) would make
    // selectCalendarDate unable to find the target day at all. Check *after*
    // both of those, not before, since either one alone can cause the
    // rollover; clamp back to the last available 15-minute slot of the
    // current month instead.
    if (
      start.getMonth() !== now.getMonth() ||
      start.getFullYear() !== now.getFullYear()
    ) {
      start.setFullYear(now.getFullYear(), now.getMonth() + 1, 0);
      start.setHours(23, 45, 0, 0);
    }

    return describe(start);
  }, fixedStartMs);
}

/**
 * Previous runs' slots can't be cleaned up: the backend locks any
 * availability a reservation has ever referenced, cancelled or not
 * (AvailabilityLockedError, X-Talent-Backend availability_repository.py).
 * A re-run within ~30 minutes would land on such a leftover slot, and the
 * overlapping new slot silently fails to save. Read the already-open
 * schedule dialog's rows for the target date (24-hour `HH:mm – HH:mm`, see
 * fmtTime in src/lib/profile/scheduleFormatters.ts) and step the target
 * forward until it overlaps none of them.
 */
export async function avoidExistingSlots(
  page: Page,
  scheduleDialog: Locator,
  target: TargetSlot
): Promise<TargetSlot> {
  const DURATION_MINUTES = 30;
  // The "+" trigger only renders once the month's slots have loaded.
  await expect(
    scheduleDialog.locator('button:has(svg.lucide-plus)')
  ).toBeVisible({ timeout: 10_000 });
  const rows = await scheduleDialog
    .getByText(/^\d{2}:\d{2} – \d{2}:\d{2}$/)
    .allTextContents();
  const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const taken = rows.map((row) => {
    const [start, end] = row.split(' – ');
    return { start: toMinutes(start), end: toMinutes(end) || 24 * 60 };
  });

  let current = target;
  for (;;) {
    const start = toMinutes(`${current.hour}:${current.minute}`);
    const end = start + DURATION_MINUTES;
    const clash = taken.find((slot) => start < slot.end && slot.start < end);
    if (!clash) return current;
    const next = await computeTargetSlot(
      page,
      current.startMs + (clash.end - start) * 60 * 1000
    );
    if (next.dateKey !== target.dateKey) {
      throw new Error(
        `avoidExistingSlots: no free ${DURATION_MINUTES}-minute slot left on ${target.dateKey}`
      );
    }
    current = next;
  }
}

// Scoped to `scope` rather than the whole page: the profile page behind the
// dialog renders its own (disabled) calendar with the same data-testid for
// today's date, so an unscoped page.getByTestId() hits a Playwright
// strict-mode violation (2 matches) once "today" is the target date.
export async function selectCalendarDate(
  scope: Page | Locator,
  dateKey: string
): Promise<void> {
  const dayButton = scope.getByTestId(`day-${dateKey}`);
  await expect(dayButton).toBeVisible({ timeout: 20_000 });
  await dayButton.click();
}

/**
 * Mentor: open "預約設定" on their own profile, add one new 30-minute ALLOW
 * slot at `target`, and save.
 */
export async function mentorAddAvailableSlot(
  page: Page,
  initialTarget: TargetSlot
): Promise<TargetSlot> {
  const openButton = page.getByRole('button', { name: '預約設定' });
  await expect(openButton).toBeVisible({ timeout: 20_000 });
  await openButton.click();

  const scheduleDialog = page.getByRole('dialog', { name: '設定可預約時段' });
  await expect(scheduleDialog).toBeVisible({ timeout: 10_000 });

  await selectCalendarDate(scheduleDialog, initialTarget.dateKey);
  const target = await avoidExistingSlots(page, scheduleDialog, initialTarget);

  await scheduleDialog.locator('button:has(svg.lucide-plus)').click();

  const addDialog = page.getByRole('dialog', { name: '新增可預約時段' });
  await expect(addDialog).toBeVisible({ timeout: 10_000 });

  const comboboxes = addDialog.getByRole('combobox');
  await comboboxes.nth(0).click();
  await page.getByRole('option', { name: target.hour, exact: true }).click();
  await comboboxes.nth(1).click();
  await page.getByRole('option', { name: target.minute, exact: true }).click();

  await addDialog.getByRole('button', { name: '30 分' }).click();
  await addDialog.getByRole('button', { name: '建立' }).click();
  await expect(addDialog).not.toBeVisible({ timeout: 5_000 });

  await scheduleDialog.getByRole('button', { name: '儲存' }).click();
  await expect(scheduleDialog).not.toBeVisible({ timeout: 15_000 });
  return target;
}

/**
 * Mentee: book the slot the mentor opened, from the mentor's public profile.
 * Retries the initial navigation + slot lookup to tolerate propagation delay.
 */
export async function menteeBookSlot(
  page: Page,
  mentorId: string,
  target: TargetSlot,
  bookingNote: string
): Promise<void> {
  const MAX_ATTEMPTS = 5;
  const POLL_INTERVAL_MS = 6_000;
  const slotButton = page.getByRole('button', { name: target.label });

  let lastError: unknown;
  let found = false;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await page.goto(`/profile/${mentorId}`);
      await selectCalendarDate(page, target.dateKey);
      await expect(slotButton).toBeVisible({ timeout: 20_000 });
      await expect(slotButton).toBeEnabled({ timeout: 5_000 });
      found = true;
      break;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        await page.waitForTimeout(POLL_INTERVAL_MS);
      }
    }
  }
  if (!found) throw lastError;

  await slotButton.click();

  const textarea = page.locator('textarea#booking-question');
  await expect(textarea).toBeVisible();
  await textarea.fill(bookingNote);

  const submitButton = page.getByRole('button', { name: '預約時間' });
  await expect(submitButton).toBeEnabled();
  await submitButton.click();

  await expect(page.getByText('預約已送出，等待導師回復').first()).toBeVisible({
    timeout: 20_000,
  });
}

/**
 * Mentor: accept the mentee's pending reservation matching `bookingNote` from /reservation/mentor.
 */
export async function mentorAcceptPendingReservation(
  page: Page,
  bookingNote: string
): Promise<void> {
  const MAX_ATTEMPTS = 5;
  const POLL_INTERVAL_MS = 6_000;
  const pendingTab = page.getByRole('tab', { name: /待您回覆/ });
  const card = page
    .getByTestId('reservation-card')
    .filter({ hasText: bookingNote })
    .first();

  let lastError: unknown;
  let found = false;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await page.goto('/reservation/mentor');
      await expect(pendingTab).toBeVisible({ timeout: 20_000 });
      await pendingTab.click();
      await expect(card).toBeVisible({ timeout: 20_000 });
      found = true;
      break;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        await page.waitForTimeout(POLL_INTERVAL_MS);
      }
    }
  }
  if (!found) throw lastError;

  await card.getByRole('button', { name: /接受/ }).click();

  const confirmDialog = page.getByRole('dialog');
  await expect(confirmDialog.getByRole('button', { name: '接受' })).toBeVisible(
    { timeout: 5_000 }
  );
  await confirmDialog.getByRole('button', { name: '接受' }).click();

  await expect(confirmDialog).not.toBeVisible({ timeout: 20_000 });
}

/**
 * Mentor: reject the mentee's pending reservation matching `bookingNote` from /reservation/mentor.
 */
export async function mentorRejectPendingReservation(
  page: Page,
  bookingNote: string,
  reason: string
): Promise<void> {
  const MAX_ATTEMPTS = 5;
  const POLL_INTERVAL_MS = 6_000;
  const pendingTab = page.getByRole('tab', { name: /待您回覆/ });
  const card = page
    .getByTestId('reservation-card')
    .filter({ hasText: bookingNote })
    .first();

  let lastError: unknown;
  let found = false;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await page.goto('/reservation/mentor');
      await expect(pendingTab).toBeVisible({ timeout: 20_000 });
      await pendingTab.click();
      await expect(card).toBeVisible({ timeout: 20_000 });
      found = true;
      break;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        await page.waitForTimeout(POLL_INTERVAL_MS);
      }
    }
  }
  if (!found) throw lastError;

  await card.getByRole('button', { name: '拒絕' }).click();

  const rejectDialog = page.getByRole('dialog', {
    name: '拒絕學員預約的原因',
  });
  await expect(rejectDialog).toBeVisible({ timeout: 5_000 });
  await rejectDialog.getByPlaceholder(/請在此輸入原因/).fill(reason);
  await rejectDialog.getByRole('button', { name: '拒絕' }).click();

  await expect(rejectDialog).not.toBeVisible({ timeout: 20_000 });
}

/**
 * Mentor: cancel an accepted upcoming reservation matching `bookingNote` from /reservation/mentor.
 */
export async function mentorCancelUpcomingReservation(
  page: Page,
  bookingNote: string,
  reason: string
): Promise<void> {
  const MAX_ATTEMPTS = 5;
  const POLL_INTERVAL_MS = 6_000;
  const upcomingTab = page.getByRole('tab', { name: /即將到來/ });
  const card = page
    .getByTestId('reservation-card')
    .filter({ hasText: bookingNote })
    .first();

  let lastError: unknown;
  let found = false;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await page.goto('/reservation/mentor');
      await expect(upcomingTab).toBeVisible({ timeout: 20_000 });
      await upcomingTab.click();
      await expect(card).toBeVisible({ timeout: 20_000 });
      found = true;
      break;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        await page.waitForTimeout(POLL_INTERVAL_MS);
      }
    }
  }
  if (!found) throw lastError;

  await card.getByRole('button', { name: '取消預約' }).click();

  const cancelDialog = page.getByRole('dialog');
  await expect(
    cancelDialog.getByRole('heading', { name: '取消預約' })
  ).toBeVisible({ timeout: 5_000 });
  await cancelDialog.locator('textarea').fill(reason);
  await cancelDialog.getByRole('button', { name: '取消預約' }).click();

  await expect(cancelDialog).not.toBeVisible({ timeout: 20_000 });
}

/**
 * Parses the notification bell's unread badge (absent/hidden -> 0 unread).
 */
export async function getUnreadNotificationCount(page: Page): Promise<number> {
  const badge = page
    .getByRole('button', { name: '開啟通知選單' })
    .locator('[aria-label*="則未讀通知"]');
  const visible = await badge.isVisible().catch(() => false);
  if (!visible) return 0;
  const label = await badge.getAttribute('aria-label');
  const match = label?.match(/有\s*(\d+)\s*則未讀通知/);
  return match ? Number(match[1]) : 0;
}

/**
 * Poll for a new notification matching `textPattern` whose arrival increases
 * the unread count above `baselineUnreadCount`.
 */
export async function waitForNotificationMatching(
  page: Page,
  baselineUnreadCount: number,
  textPattern: RegExp
): Promise<void> {
  const MAX_ATTEMPTS = 5;
  const POLL_INTERVAL_MS = 6_000;
  const bellButton = page.getByRole('button', { name: '開啟通知選單' });
  const notificationText = page.getByText(textPattern);

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await page.reload();
      await expect(bellButton).toBeVisible({ timeout: 20_000 });

      await expect(async () => {
        const unreadCount = await getUnreadNotificationCount(page);
        expect(unreadCount).toBeGreaterThan(baselineUnreadCount);
      }).toPass({ timeout: 15_000 });

      await bellButton.click();
      await expect(notificationText.first()).toBeVisible({ timeout: 8_000 });
      return;
    } catch (err) {
      lastError = err;
      await page.keyboard.press('Escape').catch(() => {});
      if (attempt < MAX_ATTEMPTS) {
        await page.waitForTimeout(POLL_INTERVAL_MS);
      }
    }
  }
  throw lastError;
}

export async function waitForAcceptedNotification(
  page: Page,
  baselineUnreadCount: number
): Promise<void> {
  return waitForNotificationMatching(
    page,
    baselineUnreadCount,
    /已接受您的預約/
  );
}

/**
 * Mentee: cancel the reservation matching `bookingNote`, searching both
 * 等待回覆 and 即將到來 tabs.
 */
export async function menteeCancelReservation(
  page: Page,
  bookingNote: string
): Promise<void> {
  await page.goto('/reservation/mentee');

  for (const tabName of [/等待回覆/, /即將到來/]) {
    const tab = page.getByRole('tab', { name: tabName });
    await expect(tab).toBeVisible({ timeout: 20_000 });
    await tab.click();

    const card = page
      .getByTestId('reservation-card')
      .filter({ hasText: bookingNote })
      .first();
    const hasCard = await card
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (!hasCard) continue;

    const cancelButton = card.getByRole('button', { name: '取消預約' });
    await cancelButton.click();
    const cancelDialog = page.getByRole('dialog');
    await expect(
      cancelDialog.getByRole('heading', { name: '取消預約' })
    ).toBeVisible({ timeout: 5_000 });
    await cancelDialog
      .locator('textarea')
      .fill('[canary] automated post-test cleanup');
    await cancelDialog.getByRole('button', { name: '取消預約' }).click();
    await expect(cancelDialog).not.toBeVisible({ timeout: 15_000 });
    return;
  }

  throw new Error(
    'menteeCancelReservation: no cancellable reservation found in 等待回覆 or 即將到來'
  );
}

/**
 * Mentee: cancel every existing pending/upcoming reservation before a canary
 * run starts so stale rows from interrupted runs do not collide.
 */
export async function cleanupStaleMenteeReservations(
  page: Page
): Promise<void> {
  const MAX_CARDS_PER_TAB = 20;
  await page.goto('/reservation/mentee');

  for (const tabName of [/等待回覆/, /即將到來/]) {
    const tab = page.getByRole('tab', { name: tabName });
    await expect(tab).toBeVisible({ timeout: 20_000 });
    await tab.click();

    const cancelButtons = page.getByRole('button', { name: '取消預約' });
    for (let i = 0; i < MAX_CARDS_PER_TAB; i++) {
      const hasAny = await cancelButtons
        .first()
        .waitFor({ state: 'visible', timeout: 5_000 })
        .then(() => true)
        .catch(() => false);
      if (!hasAny) break;

      const countBefore = await cancelButtons.count();

      const cancelStart = Date.now();
      await cancelButtons.first().click();
      const cancelDialog = page.getByRole('dialog');
      await expect(
        cancelDialog.getByRole('heading', { name: '取消預約' })
      ).toBeVisible({ timeout: 5_000 });
      await cancelDialog.locator('textarea').fill('[canary] pre-test cleanup');
      await cancelDialog.getByRole('button', { name: '取消預約' }).click();
      await expect(cancelDialog).not.toBeVisible({ timeout: 15_000 });
      await expect(cancelButtons).toHaveCount(countBefore - 1, {
        timeout: 10_000,
      });
      console.log(
        `[timing] cancelled 1 stale mentee card (tab ${tabName}): ${((Date.now() - cancelStart) / 1000).toFixed(1)}s`
      );
    }
  }
}

/**
 * Mentor: reject every existing pending reservation (待您回覆) before a canary
 * run starts.
 */
export async function cleanupStaleMentorReservations(
  page: Page
): Promise<void> {
  const MAX_CARDS_PER_TAB = 20;
  await page.goto('/reservation/mentor');

  const pendingTab = page.getByRole('tab', { name: /待您回覆/ });
  await expect(pendingTab).toBeVisible({ timeout: 20_000 });
  await pendingTab.click();

  const rejectButtons = page.getByRole('button', { name: '拒絕' });
  for (let i = 0; i < MAX_CARDS_PER_TAB; i++) {
    const hasAny = await rejectButtons
      .first()
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (!hasAny) break;

    const countBefore = await rejectButtons.count();

    const rejectStart = Date.now();
    await rejectButtons.first().click();
    const rejectDialog = page.getByRole('dialog', {
      name: '拒絕學員預約的原因',
    });
    await expect(rejectDialog).toBeVisible({ timeout: 5_000 });
    await rejectDialog
      .getByPlaceholder(/請在此輸入原因/)
      .fill('[canary] pre-test cleanup');
    await rejectDialog.getByRole('button', { name: '拒絕' }).click();
    await expect(rejectDialog).not.toBeVisible({ timeout: 15_000 });
    await expect(rejectButtons).toHaveCount(countBefore - 1, {
      timeout: 10_000,
    });
    console.log(
      `[timing] rejected 1 stale mentor card: ${((Date.now() - rejectStart) / 1000).toFixed(1)}s`
    );
  }
}
