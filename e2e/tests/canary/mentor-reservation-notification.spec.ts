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
// 480s to leave real headroom for menteeBookSlot's,
// mentorAcceptPendingReservation's, AND waitForAcceptedNotification's own
// multi-attempt eventual-consistency retries below, stacked on top of each
// other in the same run - each was added after the previous timeout budget
// already proved too tight against the real deployed backend. This project
// also has retries: 0 (playwright.config.ts) rather than relying on
// Playwright's own test-level retry: unlike a pure read, this test writes
// real data, so a blind whole-test retry can collide with a previous
// attempt's not-yet-cleaned-up state instead of just getting a clean second
// chance - failures here should surface once, not compound.
test.setTimeout(480_000);

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
    // current month instead. (This still can't fully rule out the last few
    // minutes of a month, where even that clamp would land before `now` -
    // an acceptably rare residual edge case given how narrow the window is.)
    if (
      start.getMonth() !== now.getMonth() ||
      start.getFullYear() !== now.getFullYear()
    ) {
      start.setFullYear(now.getFullYear(), now.getMonth() + 1, 0);
      start.setHours(23, 45, 0, 0);
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

/**
 * Mentee: book the slot the mentor just opened, from the mentor's public
 * profile. Retries the initial navigation + slot lookup (not just the
 * dialog interaction after it) because a real deployed backend can have a
 * short propagation delay between the mentor's save completing and that
 * same slot becoming visible on the mentee's public profile view - this
 * genuinely wasn't visible testing locally, only surfaced once this ran
 * against the real deployed BASE_URL - so treat it with the same
 * eventual-consistency tolerance waitForAcceptedNotification already uses
 * for the later notification-delivery step.
 */
async function menteeBookSlot(
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
 * Mentor: accept the mentee's pending reservation from /reservation/mentor.
 * A real backend can carry a stray PENDING row from a previous failed
 * canary run under the same two dedicated test accounts - accepting the
 * first card matching the mentee's name still exercises exactly the
 * accept -> notification path this test verifies, even if it isn't
 * necessarily today's freshly-booked row.
 *
 * Retries the navigation + tab + card lookup (not just the dialog
 * interaction after it), same eventual-consistency reasoning as
 * menteeBookSlot: the mentee's booking just completed, and this dashboard
 * view genuinely wasn't guaranteed to reflect it yet the first real run
 * against the deployed backend hit exactly this.
 */
async function mentorAcceptPendingReservation(
  page: Page,
  bookingNote: string
): Promise<void> {
  const MAX_ATTEMPTS = 5;
  const POLL_INTERVAL_MS = 6_000;
  const pendingTab = page.getByRole('tab', { name: /待您回復/ });
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
 * this as a real data-pollution risk). Called from the test's `finally`
 * block, wrapped in its own try/catch there - this function *does* throw on
 * a genuine cleanup failure (nothing matching `bookingNote` in either tab);
 * the caller is what swallows it (logging a warning instead), so a cleanup
 * failure never masks the actual assertions' pass/fail signal above it.
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

/**
 * Mentee: cancel every existing pending/upcoming reservation before this
 * run's own flow starts, regardless of which earlier run created them.
 * This is a dedicated test account (never a real user - see .env.example),
 * reused across many manual re-runs while actively developing this very
 * test, so a stray reservation left over from an earlier run can collide
 * with this run's freshly computed target time (both round to the same
 * 15-minute slot) and show up as a disabled, unbookable button with no
 * useful error - and worse, that collision can eat the whole test timeout
 * before the *this* run's own after-test cleanup ever gets a chance to
 * run, perpetuating the problem into the next run too. Starting from a
 * known-clean state sidesteps all of that, rather than trying to detect a
 * collision mid-flow and decide whether it's safe to touch.
 *
 * Best-effort: wrapped in try/catch by the caller, same as the after-test
 * cleanup - this is hygiene, not one of the test's actual assertions.
 */
async function cleanupStaleMenteeReservations(page: Page): Promise<void> {
  const MAX_CARDS_PER_TAB = 20; // safety cap; never expected to be hit
  await page.goto('/reservation/mentee');

  for (const tabName of [/等待回復/, /即將到來/]) {
    const tab = page.getByRole('tab', { name: tabName });
    await expect(tab).toBeVisible({ timeout: 20_000 });
    await tab.click();

    const cancelButtons = page.getByRole('button', { name: '取消預約' });
    for (let i = 0; i < MAX_CARDS_PER_TAB; i++) {
      const countBefore = await cancelButtons.count();
      if (countBefore === 0) break;

      const cancelStart = Date.now(); // see the per-run mark() comment below
      await cancelButtons.first().click();
      const cancelDialog = page.getByRole('dialog');
      await expect(
        cancelDialog.getByRole('heading', { name: '取消預約' })
      ).toBeVisible({ timeout: 5_000 });
      await cancelDialog
        .locator('textarea')
        .fill('[canary #687] pre-test cleanup');
      await cancelDialog.getByRole('button', { name: '取消預約' }).click();
      await expect(cancelDialog).not.toBeVisible({ timeout: 15_000 });
      // AI Review caught a real race: the dialog closing doesn't guarantee
      // the list has re-fetched yet. Without waiting for the count to
      // actually drop, the next loop's .first() can grab the same
      // still-rendered card again, whose cancel button no longer opens a
      // fresh dialog the way this loop expects, throwing and cutting the
      // rest of this best-effort cleanup short.
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
 * Mentor: reject every existing pending reservation (待您回復) before this
 * run's own flow starts. Same rationale as cleanupStaleMenteeReservations -
 * this only clears the mentor-side queue, which is a genuinely separate
 * accumulation from the mentee-side one above (a reservation only leaves
 * both sides' lists once it's resolved one way or another): a real run
 * against the deployed backend found the mentor's own 待您回復 tab holding 2
 * stale pending cards mentee-side cleanup never touched, which then made
 * mentorDeleteAvailableSlot land on an unexpected page state.
 */
async function cleanupStaleMentorReservations(page: Page): Promise<void> {
  const MAX_CARDS_PER_TAB = 20; // safety cap; never expected to be hit
  await page.goto('/reservation/mentor');

  const pendingTab = page.getByRole('tab', { name: /待您回復/ });
  await expect(pendingTab).toBeVisible({ timeout: 20_000 });
  await pendingTab.click();

  const rejectButtons = page.getByRole('button', { name: '拒絕' });
  for (let i = 0; i < MAX_CARDS_PER_TAB; i++) {
    const countBefore = await rejectButtons.count();
    if (countBefore === 0) break;

    const rejectStart = Date.now(); // see the per-run mark() comment below
    await rejectButtons.first().click();
    const rejectDialog = page.getByRole('dialog', {
      name: '拒絕學員預約的原因',
    });
    await expect(rejectDialog).toBeVisible({ timeout: 5_000 });
    await rejectDialog
      .getByPlaceholder(/請在此輸入原因/)
      .fill('[canary #687] pre-test cleanup');
    await rejectDialog.getByRole('button', { name: '拒絕' }).click();
    await expect(rejectDialog).not.toBeVisible({ timeout: 15_000 });
    // Same race AI Review caught in cleanupStaleMenteeReservations: wait for
    // the count to actually drop before the next .first() can grab the
    // same still-rendered card again.
    await expect(rejectButtons).toHaveCount(countBefore - 1, {
      timeout: 10_000,
    });
    console.log(
      `[timing] rejected 1 stale mentor card: ${((Date.now() - rejectStart) / 1000).toFixed(1)}s`
    );
  }
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

    // Per-step timing: this test's own duration (visible per-test via the
    // 'list' reporter, playwright.config.ts) doesn't say *which* step ate
    // the budget. Real runs against the deployed backend have taken
    // anywhere from ~3 to ~9 minutes depending on how much stale data
    // cleanupStaleMenteeReservations/cleanupStaleMentorReservations found -
    // these marks are what make that breakdown visible instead of having to
    // re-instrument by hand again.
    const t0 = Date.now();
    const mark = (label: string) =>
      console.log(
        `[timing] ${label}: ${((Date.now() - t0) / 1000).toFixed(1)}s`
      );

    try {
      const menteePage = await menteeContext.newPage();
      const mentorPage = await mentorContext.newPage();

      await mentorPage.goto('/');
      const mentorUser = await getSessionUser(mentorPage);
      mark('mentor session ready');

      await menteePage.goto('/');
      mark('mentee page loaded');

      try {
        await cleanupStaleMenteeReservations(menteePage);
      } catch (err) {
        console.warn(
          '[canary #687] mentee pre-test cleanup failed, proceeding anyway:',
          err
        );
      }
      mark('mentee pre-test cleanup done');

      try {
        await cleanupStaleMentorReservations(mentorPage);
      } catch (err) {
        console.warn(
          '[canary #687] mentor pre-test cleanup failed, proceeding anyway:',
          err
        );
      }
      mark('mentor pre-test cleanup done');

      await mentorPage.goto(`/profile/${mentorUser.id}`);
      target = await computeTargetSlot(mentorPage);
      await mentorAddAvailableSlot(mentorPage, target);
      mark('mentor added available slot');

      bookingNote = `[canary #687] ${new Date().toISOString()}`;
      await menteeBookSlot(menteePage, mentorUser.id, target, bookingNote);
      mark('mentee booked slot');

      const baselineUnreadCount = await getUnreadNotificationCount(menteePage);
      await mentorAcceptPendingReservation(mentorPage, bookingNote);
      mark('mentor accepted reservation');

      await waitForAcceptedNotification(menteePage, baselineUnreadCount);
      mark('mentee saw notification');
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
