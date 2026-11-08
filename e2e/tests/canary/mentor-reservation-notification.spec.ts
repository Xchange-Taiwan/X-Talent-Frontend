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
  waitForAcceptedNotification,
} from './reservationCanaryHelpers';

// Canary (X-Tracker #687): mentor creates an available slot, mentee books it
// for real, mentor really accepts it, and mentee sees the resulting
// notification - all against the real backend, nothing mocked.
test.setTimeout(480_000);

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
    let bookingNote: string | undefined;

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
      const target = await mentorAddAvailableSlot(
        mentorPage,
        await computeTargetSlot(mentorPage)
      );
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
      await menteeContext.close();
      await mentorContext.close();
    }
  });
});
