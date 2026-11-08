import { test } from '@playwright/test';

import {
  cleanupStaleMenteeReservations,
  cleanupStaleMentorReservations,
  computeTargetSlot,
  getSessionUser,
  getUnreadNotificationCount,
  MENTEE_AUTH_FILE,
  menteeBookSlot,
  menteeCancelReservation,
  MENTOR_AUTH_FILE,
  mentorAcceptPendingReservation,
  mentorAddAvailableSlot,
  mentorCancelUpcomingReservation,
  mentorRejectPendingReservation,
  waitForNotificationMatching,
} from './reservationCanaryHelpers';

// Canary (X-Tracker #789): verifies the real-backend rebooking lifecycle
// (regression guard for #688 idempotency_key release) and mentor cancellation
// notification:
// 1. Mentor opens a 30-minute slot T on their profile.
// 2. Mentee books slot T (firstBookingNote).
// 3. Mentor rejects firstBookingNote -> backend releases idempotency_key and
//    slot T returns to available on the mentor's public profile.
// 4. Mentee books the EXACT same slot T again (secondBookingNote) -> backend
//    creates a fresh PENDING reservation instead of returning the old REJECTED
//    record.
// 5. Mentor accepts secondBookingNote, then cancels it from 即將到來 -> Mentee
//    receives the real "的預約已被取消" notification.
test.setTimeout(540_000);

test.describe('真實後端 canary：拒絕後同原時段重訂（Rebooking）與 Mentor 取消通知 (#789)', () => {
  test('mentor 拒絕預約後釋放同原時段 → mentee 重新預約同一時段成功 → mentor 接受後再取消 → mentee 收到取消通知', async ({
    browser,
  }) => {
    const menteeContext = await browser.newContext({
      storageState: MENTEE_AUTH_FILE,
    });
    const mentorContext = await browser.newContext({
      storageState: MENTOR_AUTH_FILE,
    });

    let activeBookingNote: string | undefined;

    const t0 = Date.now();
    const mark = (label: string) =>
      console.log(
        `[timing #789] ${label}: ${((Date.now() - t0) / 1000).toFixed(1)}s`
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
          '[canary #789] mentee pre-test cleanup failed, proceeding anyway:',
          err
        );
      }
      mark('mentee pre-test cleanup done');

      try {
        await cleanupStaleMentorReservations(mentorPage);
      } catch (err) {
        console.warn(
          '[canary #789] mentor pre-test cleanup failed, proceeding anyway:',
          err
        );
      }
      mark('mentor pre-test cleanup done');

      // 1. Mentor creates a fresh 30-minute slot T
      await mentorPage.goto(`/profile/${mentorUser.id}`);
      const target = await mentorAddAvailableSlot(
        mentorPage,
        await computeTargetSlot(mentorPage)
      );
      mark('mentor added available slot');

      // 2. Mentee books slot T for the first time
      const firstBookingNote = `[canary #789-first] ${new Date().toISOString()}`;
      activeBookingNote = firstBookingNote;
      await menteeBookSlot(menteePage, mentorUser.id, target, firstBookingNote);
      mark('mentee booked slot (first attempt)');

      // 3. Mentor rejects the first booking -> releases idempotency_key on backend
      await mentorRejectPendingReservation(
        mentorPage,
        firstBookingNote,
        '[canary #789] reject first booking to release slot'
      );
      activeBookingNote = undefined;
      mark('mentor rejected first booking');

      // 4. Mentee books the EXACT SAME slot T a second time (rebooking)
      const secondBookingNote = `[canary #789-rebook] ${new Date().toISOString()}`;
      activeBookingNote = secondBookingNote;
      await menteeBookSlot(
        menteePage,
        mentorUser.id,
        target,
        secondBookingNote
      );
      mark('mentee rebooked same slot (second attempt)');

      // 5. Mentor sees and accepts the rebooked reservation in 待您回復
      await mentorAcceptPendingReservation(mentorPage, secondBookingNote);
      mark('mentor accepted rebooked reservation');

      // 6. Mentor cancels the accepted reservation from 即將到來 -> Mentee receives cancellation notification
      const baselineUnreadCount = await getUnreadNotificationCount(menteePage);
      await mentorCancelUpcomingReservation(
        mentorPage,
        secondBookingNote,
        '[canary #789] mentor cancels accepted rebooking'
      );
      activeBookingNote = undefined;
      mark('mentor cancelled upcoming reservation');

      await waitForNotificationMatching(
        menteePage,
        baselineUnreadCount,
        /的預約已被取消/
      );
      mark('mentee saw cancellation notification');
    } finally {
      // Best-effort cleanup in case an assertion failed while a booking was
      // still in PENDING or ACCEPT state.
      if (activeBookingNote) {
        try {
          const menteeCleanupPage =
            menteeContext.pages()[0] ?? (await menteeContext.newPage());
          await menteeCancelReservation(menteeCleanupPage, activeBookingNote);
        } catch (err) {
          console.warn(
            '[canary #789] cleanup: failed to cancel test reservation:',
            err
          );
        }
      }
      await menteeContext.close();
      await mentorContext.close();
    }
  });
});
