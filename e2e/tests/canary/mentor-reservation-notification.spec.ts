import { expect, type Locator, type Page, test } from '@playwright/test';
import path from 'path';

// Canary (X-Tracker #687): mentor creates an available slot, mentee books it
// for real, mentor really accepts it, and mentee sees the resulting
// notification - all against the real backend, nothing mocked. Builds on the
// dual-role real-login infrastructure from X-Tracker #686
// (e2e/fixtures/auth.setup.ts + e2e/tests/canary/dual-role-login.spec.ts).
//
// Unlike e2e/tests/reservation/*.spec.ts (mocked API responses, forged
// session cookies, a frozen clock), this test uses the real, unfrozen clock
// and the two real E2E_MENTEE_*/E2E_MENTOR_* accounts end to end. It runs
// only in the `chromium-canary` Playwright project (testDir:
// e2e/tests/canary, see playwright.config.ts) against a real deployed
// BASE_URL (default https://xtalentdev.vercel.app - see
// .github/workflows/e2e.yml), which is why the assertions below tolerate
// real network/backend latency instead of asserting instantly.

const MENTEE_AUTH_FILE = path.join(__dirname, '../../.auth/mentee.json');
const MENTOR_AUTH_FILE = path.join(__dirname, '../../.auth/mentor.json');

// A real multi-step booking round trip against a live, unmocked backend
// legitimately takes longer than the suite's default 90s budget
// (playwright.config.ts) - this is the only spec in the repo that needs it.
test.setTimeout(180_000);

interface SessionUser {
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
async function getSessionUser(page: Page): Promise<SessionUser> {
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

interface TargetSlot {
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
 * of the test runner's own OS timezone. Because it's a real unfrozen clock,
 * every run targets a different date/time slot, so repeated canary runs
 * never collide with a previous run's leftover data.
 */
async function computeTargetSlot(page: Page): Promise<TargetSlot> {
  return page.evaluate(() => {
    const DURATION_MINUTES = 30;
    const now = new Date();
    let start = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    start.setSeconds(0, 0);

    // MentorScheduleDialog's calendar only ever shows the currently-open
    // month - this test doesn't drive month navigation - so +2h rolling
    // into next month (possible in the last ~2 hours of any month) would
    // make selectCalendarDate unable to find the target day at all. Clamp
    // back to the last moment of the current month instead. (This still
    // can't fully rule out the last few minutes of a month, where even that
    // clamp would land before `now` - an acceptably rare residual edge
    // case given how narrow the window is.)
    if (
      start.getMonth() !== now.getMonth() ||
      start.getFullYear() !== now.getFullYear()
    ) {
      start = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 45, 0, 0);
    }

    // Snap to the calendar's 15-minute picker options (00/15/30/45),
    // rolling the hour (and, at the day boundary, the date) forward via
    // native Date arithmetic when rounding reaches 60.
    const snappedMinutes = Math.round(start.getMinutes() / 15) * 15;
    if (snappedMinutes >= 60) {
      start.setHours(start.getHours() + 1, 0);
    } else {
      start.setMinutes(snappedMinutes);
    }

    const end = new Date(start.getTime() + DURATION_MINUTES * 60 * 1000);

    const pad = (n: number) => String(n).padStart(2, '0');
    const dateKey = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
    const hour = pad(start.getHours());
    const minute = pad(start.getMinutes());

    // Same format MenteeBookingForm's slot buttons render via
    // formatBookingSlotTime (src/lib/profile/scheduleFormatters.ts).
    const timeFmt: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    };
    const label = `${start.toLocaleTimeString('en-US', timeFmt)} – ${end.toLocaleTimeString('en-US', timeFmt)}`;

    return { dateKey, hour, minute, label };
  });
}

// Scoped to `scope` rather than the whole page: the profile page behind the
// dialog renders its own (disabled) calendar with the same data-testid for
// today's date, so an unscoped page.getByTestId() hits a Playwright
// strict-mode violation (2 matches) once "today" is the target date.
async function selectCalendarDate(
  scope: Page | Locator,
  dateKey: string
): Promise<void> {
  const dayButton = scope.getByTestId(`day-${dateKey}`);
  await expect(dayButton).toBeVisible({ timeout: 20_000 });
  await dayButton.click();
}

/**
 * Mentor: open "預約設定" on their own profile, add one new 30-minute ALLOW
 * slot at `target`, and save. This is real setup for the scenario below (a
 * mentee needs something real to book) rather than the behavior this ticket
 * actually verifies, so it drives the real MentorScheduleDialog UI directly
 * instead of adding any test-only shortcut.
 */
async function mentorAddAvailableSlot(
  page: Page,
  target: TargetSlot
): Promise<void> {
  const openButton = page.getByRole('button', { name: '預約設定' });
  await expect(openButton).toBeVisible({ timeout: 20_000 });
  await openButton.click();

  const scheduleDialog = page.getByRole('dialog', { name: '設定可預約時段' });
  await expect(scheduleDialog).toBeVisible({ timeout: 10_000 });

  await selectCalendarDate(scheduleDialog, target.dateKey);

  // The "+" add-slot trigger is icon-only (no accessible name) - same
  // selector strategy MentorScheduleDialog.test.tsx already uses for it.
  await scheduleDialog.locator('button:has(svg.lucide-plus)').click();

  const addDialog = page.getByRole('dialog', { name: '新增可預約時段' });
  await expect(addDialog).toBeVisible({ timeout: 10_000 });

  // Two Radix comboboxes on this form: start hour, then start minute.
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
}

/** Mentee: book the slot the mentor just opened, from the mentor's public profile. */
async function menteeBookSlot(
  page: Page,
  mentorId: string,
  target: TargetSlot,
  bookingNote: string
): Promise<void> {
  await page.goto(`/profile/${mentorId}`);
  await selectCalendarDate(page, target.dateKey);

  const slotButton = page.getByRole('button', { name: target.label });
  await expect(slotButton).toBeVisible({ timeout: 20_000 });
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
 * Mentor: accept the mentee's pending reservation from /reservation/mentor.
 * A real backend can carry a stray PENDING row from a previous failed
 * canary run under the same two dedicated test accounts - accepting the
 * first card matching the mentee's name still exercises exactly the
 * accept -> notification path this test verifies, even if it isn't
 * necessarily today's freshly-booked row.
 */
async function mentorAcceptPendingReservation(
  page: Page,
  bookingNote: string
): Promise<void> {
  await page.goto('/reservation/mentor');

  const pendingTab = page.getByRole('tab', { name: /待您回復/ });
  await expect(pendingTab).toBeVisible({ timeout: 20_000 });
  await pendingTab.click();

  // Filter by bookingNote (unique per run - includes an ISO timestamp), not
  // mentee name: the shared test account's name never changes between runs,
  // so a name-only filter can match a stray PENDING row left over from a
  // previous failed/interrupted run instead of the one this run just
  // created (AI Review flagged this as a real data-pollution risk - acting
  // on the wrong row would leave *this* run's reservation un-accepted, and
  // later make mentorDeleteAvailableSlot's cleanup fail too).
  const card = page
    .getByTestId('reservation-card')
    .filter({ hasText: bookingNote })
    .first();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.getByRole('button', { name: /接受/ }).click();

  const confirmDialog = page.getByRole('dialog');
  await expect(confirmDialog.getByRole('button', { name: '接受' })).toBeVisible(
    { timeout: 5_000 }
  );
  await confirmDialog.getByRole('button', { name: '接受' }).click();

  await expect(confirmDialog).not.toBeVisible({ timeout: 20_000 });
}

/** Parses the notification bell's unread badge (absent/hidden -> 0 unread). */
async function getUnreadNotificationCount(page: Page): Promise<number> {
  const badge = page.locator('[aria-label*="則未讀通知"]');
  const visible = await badge.isVisible().catch(() => false);
  if (!visible) return 0;
  const label = await badge.getAttribute('aria-label');
  const match = label?.match(/有\s*(\d+)\s*則未讀通知/);
  return match ? Number(match[1]) : 0;
}

/**
 * Mentee: poll for the real "mentor accepted your reservation" notification
 * (reservation_success, see src/components/layout/Header/notificationUtils.ts).
 * Acceptance -> notification delivery is not guaranteed to be synchronous on
 * the real backend, so this retries with a reload + reopen instead of
 * asserting once - the same cold-start/eventual-consistency tolerance
 * e2e/fixtures/auth.setup.ts already applies to sign-in.
 *
 * `baselineUnreadCount` (read *before* the mentor's accept action) guards
 * against a false positive AI Review caught: this is a shared, repeatedly-
 * reused real test account, so its notification center can already contain
 * an old "已接受您的預約" notification from a previous run. Matching on text
 * alone would pass immediately without ever confirming *this* run's
 * notification actually arrived - requiring the unread count to have grown
 * past its pre-action baseline makes sure we're observing a genuinely new
 * arrival, not a stale leftover.
 */
async function waitForAcceptedNotification(
  page: Page,
  baselineUnreadCount: number
): Promise<void> {
  const MAX_ATTEMPTS = 5;
  const POLL_INTERVAL_MS = 6_000;
  const bellButton = page.getByRole('button', { name: '開啟通知選單' });
  const notificationText = page.getByText(/已接受您的預約/);

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await page.reload();
      await expect(bellButton).toBeVisible({ timeout: 20_000 });

      // getUnreadNotificationCount reads a point-in-time DOM snapshot, but
      // the badge's count can still be arriving via a client-side fetch
      // right after reload - a single immediate check would race that and
      // fail almost every time. Poll with toPass instead of checking once,
      // independent of the outer attempt/reload loop below (which exists
      // for the separate concern of the backend not having created the
      // notification yet at all).
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

/**
 * Mentee: cancel the reservation this test just created, so repeated
 * real-backend canary runs don't accumulate stray rows (AI Review flagged
 * this as a real data-pollution risk). Runs from the test's `finally` block -
 * swallow any error here rather than throwing, so a cleanup failure never
 * masks the actual assertions' pass/fail signal.
 *
 * The reservation can be in either the mentee's 等待回復 (pending - mentor
 * hasn't accepted yet, e.g. because an earlier step in this test threw) or
 * 即將到來 (upcoming - already accepted) tab depending on exactly where the
 * test failed; both tabs expose the same real 取消預約 button + dialog flow
 * (see e2e/tests/reservation/reservation-mentee.spec.ts's mocked
 * equivalents), so try both instead of assuming which one applies.
 *
 * Scoped by `bookingNote` (unique per run) rather than just grabbing the
 * first cancel button on the tab, for the same reason
 * mentorAcceptPendingReservation is: this shared, repeatedly-reused test
 * account can carry a stray row from a previous run.
 */
async function menteeCancelReservation(
  page: Page,
  bookingNote: string
): Promise<void> {
  await page.goto('/reservation/mentee');

  for (const tabName of [/等待回復/, /即將到來/]) {
    const tab = page.getByRole('tab', { name: tabName });
    await expect(tab).toBeVisible({ timeout: 20_000 });
    await tab.click();

    const card = page
      .getByTestId('reservation-card')
      .filter({ hasText: bookingNote })
      .first();
    // Locator.isVisible() ignores a `timeout` option entirely - it's a
    // synchronous, point-in-time check, not a wait. Use waitFor() so a
    // still-loading list gets a real chance to render the card before this
    // tab is given up on as "no match here".
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
      .fill('[canary #687] automated cleanup');
    await cancelDialog.getByRole('button', { name: '取消預約' }).click();
    await expect(cancelDialog).not.toBeVisible({ timeout: 15_000 });
    return;
  }

  throw new Error(
    'menteeCancelReservation: no cancellable reservation found in 等待回復 or 即將到來'
  );
}

/**
 * Mentor: remove the ALLOW slot this test added. Must run *after*
 * menteeCancelReservation - while a reservation is still PENDING/BOOKED
 * against this slot, MentorScheduleDialog's delete button opens a
 * confirmation prompt instead of deleting directly (see
 * getReservationBlock/showPrompt in MentorScheduleDialog.tsx), which this
 * cleanup doesn't drive. Once cancelled, the slot is a plain deletable draft
 * again, same as right after mentorAddAvailableSlot created it.
 */
async function mentorDeleteAvailableSlot(
  page: Page,
  target: TargetSlot
): Promise<void> {
  const openButton = page.getByRole('button', { name: '預約設定' });
  await expect(openButton).toBeVisible({ timeout: 20_000 });
  await openButton.click();

  const scheduleDialog = page.getByRole('dialog', { name: '設定可預約時段' });
  await expect(scheduleDialog).toBeVisible({ timeout: 10_000 });

  await selectCalendarDate(scheduleDialog, target.dateKey);

  const slotRow = scheduleDialog
    .getByRole('button')
    .filter({ hasText: target.label });
  await expect(slotRow).toBeVisible({ timeout: 10_000 });
  await slotRow.locator('button:has(svg.lucide-x)').click();

  await scheduleDialog.getByRole('button', { name: '儲存' }).click();
  await expect(scheduleDialog).not.toBeVisible({ timeout: 15_000 });
}

test.describe('真實後端通知 canary：mentor 接受預約 → mentee 收到通知', () => {
  test('mentor 建立可預約時段並接受 mentee 的真實預約 → mentee 端出現對應通知', async ({
    browser,
  }) => {
    const menteeContext = await browser.newContext({
      storageState: MENTEE_AUTH_FILE,
    });
    const mentorContext = await browser.newContext({
      storageState: MENTOR_AUTH_FILE,
    });
    // Hoisted so the finally block's cleanup can reach them even if an
    // assertion throws partway through the try block below.
    let target: TargetSlot | undefined;
    let bookingNote: string | undefined;

    try {
      const menteePage = await menteeContext.newPage();
      const mentorPage = await mentorContext.newPage();

      await mentorPage.goto('/');
      const mentorUser = await getSessionUser(mentorPage);

      await menteePage.goto('/');

      await mentorPage.goto(`/profile/${mentorUser.id}`);
      target = await computeTargetSlot(mentorPage);
      await mentorAddAvailableSlot(mentorPage, target);

      bookingNote = `[canary #687] ${new Date().toISOString()}`;
      await menteeBookSlot(menteePage, mentorUser.id, target, bookingNote);

      const baselineUnreadCount = await getUnreadNotificationCount(menteePage);
      await mentorAcceptPendingReservation(mentorPage, bookingNote);

      await waitForAcceptedNotification(menteePage, baselineUnreadCount);
    } finally {
      // Two independent best-effort cleanup steps - never let either failure
      // mask the real test outcome above, and a failure in one shouldn't
      // skip the other. Order matters: the slot can only be deleted directly
      // once its reservation is no longer PENDING/BOOKED (see
      // mentorDeleteAvailableSlot's doc comment).
      if (bookingNote) {
        try {
          const menteeCleanupPage =
            menteeContext.pages()[0] ?? (await menteeContext.newPage());
          await menteeCancelReservation(menteeCleanupPage, bookingNote);
        } catch (err) {
          console.warn(
            '[canary #687] cleanup: failed to cancel test reservation:',
            err
          );
        }
      }
      if (target) {
        try {
          const mentorCleanupPage =
            mentorContext.pages()[0] ?? (await mentorContext.newPage());
          await mentorDeleteAvailableSlot(mentorCleanupPage, target);
        } catch (err) {
          console.warn(
            '[canary #687] cleanup: failed to delete mentor availability slot:',
            err
          );
        }
      }
      await menteeContext.close();
      await mentorContext.close();
    }
  });
});
