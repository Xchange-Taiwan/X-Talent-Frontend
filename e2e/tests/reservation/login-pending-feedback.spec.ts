import { expect, Page, test } from '@playwright/test';

import { captureEvidence } from '../../helpers/evidence';
import { setSignedSessionCookie } from '../../helpers/session';

const USER_ID = '1';

function makeMenteeSession() {
  return {
    user: {
      id: USER_ID,
      name: 'Test Mentee',
      isMentor: false,
      onBoarding: true,
      jobTitle: 'Junior Product Designer',
      company: 'Studio X',
      personalLinks: [],
    },
    accessToken: 'mock-mentee-token',
    expires: '2099-01-01T00:00:00.000Z',
  };
}

function makeMentorSession() {
  return {
    user: {
      id: USER_ID,
      name: 'Emily Chen',
      isMentor: true,
      onBoarding: true,
      jobTitle: 'Senior UI/UX Designer',
      company: 'Tech Corp',
      personalLinks: [],
    },
    accessToken: 'mock-mentor-token',
    expires: '2099-01-01T00:00:00.000Z',
  };
}

function makePendingFeedbackReservation(opts: {
  id: number;
  counterpartyName: string;
  dtstart: number;
  dtend?: number;
  viewerRole: 'MENTEE' | 'MENTOR';
}) {
  const { id, counterpartyName, dtstart, dtend, viewerRole } = opts;
  const isMentorViewer = viewerRole === 'MENTOR';

  return {
    reservation_id: id,
    role: viewerRole,
    counterpart: {
      name: counterpartyName,
      avatar: '',
      job_title: isMentorViewer ? 'Junior Product Designer' : 'UI/UX 設計師',
      company: isMentorViewer ? 'Design Lab' : 'Google Taiwan',
    },
    dtstart,
    dtend: dtend ?? dtstart + 1800,
    cancelled_by: null,
    feedback: {
      meeting_happened: null,
      rating: null,
      next_step: 'ANSWER',
    },
  };
}

async function mockCommonRoutes(page: Page) {
  await page.route(/\/v1\/notifications/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: '0', msg: 'ok', data: { items: [] } }),
    })
  );
  await page.route(/\/v1\/mentors([?]|$)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: '0',
        msg: 'ok',
        data: { mentors: [], next_id: null },
      }),
    })
  );
}

test.describe('#740 登入後待回饋佇列彈窗與 Mentor 兩頁版選項 A 流程', () => {
  test('Mentor 登入進站：依會談時間由遠到近排序、選項 A 選「有進行」按「確定送出」直接送出、選「沒有進行」進第 2 頁必選 5 原因 +「其他」1000 字補充說明 + 暖黃下架鎖定提醒框', async ({
    page,
  }) => {
    const session = makeMentorSession();
    await setSignedSessionCookie(page, {
      ...session.user,
      token: 'mock-access-token',
    });
    await page.route(/\/api\/auth\/session/, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(session),
        });
      }
      return route.continue();
    });
    await mockCommonRoutes(page);

    const submittedPayloads: Array<{ id: number; body: unknown }> = [];

    // Deliberately return out-of-order and give 701 a later dtstart but earlier dtend than 702
    // to verify frontend sorts by dtend ascending (#760 §6: 701 -> 702 -> 703)
    await page.route(
      new RegExp(`/v1/users/${USER_ID}/reservations/pending-feedback$`),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: {
              reservations: [
                makePendingFeedbackReservation({
                  id: 703,
                  counterpartyName: 'Zahra Mirzakhani',
                  dtstart: 1761500000,
                  dtend: 1761501800,
                  viewerRole: 'MENTOR',
                }),
                makePendingFeedbackReservation({
                  id: 702,
                  counterpartyName: 'Alex Wang',
                  dtstart: 1760266800,
                  dtend: 1760270400,
                  viewerRole: 'MENTOR',
                }),
                makePendingFeedbackReservation({
                  id: 701,
                  counterpartyName: 'Emily Chen',
                  dtstart: 1760267400,
                  dtend: 1760268600,
                  viewerRole: 'MENTOR',
                }),
              ],
            },
          }),
        })
    );

    await page.route(
      new RegExp(`/v1/users/${USER_ID}/reservations/(701|702|703)/feedback$`),
      async (route) => {
        const match = route
          .request()
          .url()
          .match(/reservations\/(\d+)\/feedback$/);
        if (match) {
          submittedPayloads.push({
            id: Number(match[1]),
            body: route.request().postDataJSON(),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: '0', msg: 'ok', data: {} }),
        });
      }
    );

    await page.goto('/about');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId('feedback-queue-counter')).toHaveText(
      '第 1／3 場'
    );
    await expect(dialog.getByTestId('feedback-mentor-header')).toContainText(
      'Emily Chen'
    );
    await expect(dialog.getByTestId('feedback-mentor-header')).toContainText(
      /\d{4}\/\d{2}\/\d{2} · \d{2}:\d{2}–\d{2}:\d{2}/
    );
    await expect(
      dialog.getByTestId('feedback-mentor-header').locator('img')
    ).toHaveCount(0);

    // Unselected Mentor Step 1: 確定送出 is visible and disabled; only X button in top-right
    const submitHappenedBtn = dialog.getByRole('button', { name: '確定送出' });
    await expect(submitHappenedBtn).toBeVisible();
    await expect(submitHappenedBtn).toBeDisabled();

    // Select 有進行 -> 確定送出 enabled -> capture evidence
    await dialog
      .locator('label')
      .filter({ hasText: /^有進行$/ })
      .click();
    await expect(submitHappenedBtn).toBeEnabled();
    await captureEvidence(
      page,
      'issue-740-mentor-step1-happened-confirm-submit',
      {
        waitForSelector: '[role="dialog"]',
      }
    );

    // Click 確定送出 -> directly submits { meeting_happened: true } and promotes Session 2 (Alex Wang)
    await submitHappenedBtn.click();

    await expect(dialog.getByTestId('feedback-queue-counter')).toHaveText(
      '第 2／3 場'
    );
    await expect(dialog.getByTestId('feedback-mentor-header')).toContainText(
      'Alex Wang'
    );

    // Select 沒有進行 -> button changes to 下一步
    await dialog
      .locator('label')
      .filter({ hasText: /^沒有進行$/ })
      .click();
    const nextBtn = dialog.getByRole('button', { name: '下一步' });
    await expect(nextBtn).toBeVisible();
    await expect(nextBtn).toBeEnabled();
    await captureEvidence(page, 'issue-740-mentor-step1-not-happened-next', {
      waitForSelector: '[role="dialog"]',
    });

    await nextBtn.click();

    // Step 2: 5 reasons without 誰沒有進行會談 + warm-yellow warning box
    await expect(dialog.getByText('步驟 2 / 2 · 會談狀況')).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: '未進行會談的原因' })
    ).toBeVisible();
    await expect(dialog.getByText(/誰沒有進行會談/)).toHaveCount(0);
    await expect(
      dialog.getByRole('button', { name: '送出並填下一場' })
    ).toBeDisabled();

    for (const reasonLabel of [
      '雙方時間無法配合',
      '對方未出席',
      '未收到或錯過會議通知',
      '技術／連線問題',
      '其他',
    ]) {
      await expect(
        dialog
          .locator('label')
          .filter({ hasText: new RegExp(`^${reasonLabel}$`) })
      ).toBeVisible();
    }

    const warningBox = dialog.getByTestId('mentor-not-happened-warning');
    await expect(warningBox).toBeVisible();
    await expect(warningBox).toContainText(
      '送出後不能修改。這場會談不會計入已完成場次，學員的評價也不會公開。'
    );

    await dialog
      .locator('label')
      .filter({ hasText: /^對方未出席$/ })
      .click();
    await captureEvidence(
      page,
      'issue-740-mentor-step2-not-happened-warning-box',
      {
        waitForSelector: '[role="dialog"]',
      }
    );

    // Select 其他 -> expands optional 1000-char note field
    const otherRadioCard = dialog
      .locator('label')
      .filter({ hasText: /^其他$/ });
    await otherRadioCard.click();
    const noteField = dialog.getByLabel(/補充說明/);
    await expect(noteField).toBeVisible();
    await noteField.fill('學員臨時有事已在聊聊通知改期');
    await expect(dialog.getByTestId('feedback-note-counter')).toHaveText(
      '14 / 1000'
    );

    // Wait for 200ms collapse transition and verify:
    // 1) textarea left/right edges align 0px flush with sibling radio cards
    // 2) overflow-hidden clip wrapper keeps >=4px clearance so focus ring never clips
    await page.waitForTimeout(240);
    const clipWrapper = dialog
      .getByTestId('not-happened-note-collapse')
      .locator('> div')
      .first();

    // Ensure the warm-yellow Mentor warning box is completely visible and never clipped by scroll or footer
    const submitNextBtn = dialog.getByRole('button', {
      name: '送出並填下一場',
    });
    const [
      otherCardRect,
      clipRect,
      noteRect,
      noteCounterBox,
      warningRect,
      submitBtnRect,
    ] = await Promise.all([
      otherRadioCard.boundingBox(),
      clipWrapper.boundingBox(),
      noteField.boundingBox(),
      dialog.getByTestId('feedback-note-counter').boundingBox(),
      warningBox.boundingBox(),
      submitNextBtn.boundingBox(),
    ]);
    expect(otherCardRect).not.toBeNull();
    expect(clipRect).not.toBeNull();
    expect(noteRect).not.toBeNull();
    expect(Math.abs(noteRect!.x - otherCardRect!.x)).toBeLessThanOrEqual(1);
    expect(
      Math.abs(noteRect!.width - otherCardRect!.width)
    ).toBeLessThanOrEqual(1);
    expect(clipRect!.x).toBeLessThanOrEqual(noteRect!.x - 4);
    expect(clipRect!.x + clipRect!.width).toBeGreaterThanOrEqual(
      noteRect!.x + noteRect!.width + 4
    );
    expect(noteCounterBox).not.toBeNull();
    expect(warningRect).not.toBeNull();
    expect(submitBtnRect).not.toBeNull();
    expect(warningRect!.height).toBeGreaterThanOrEqual(44);
    expect(warningRect!.y).toBeGreaterThanOrEqual(
      noteCounterBox!.y + noteCounterBox!.height - 2
    );
    expect(warningRect!.y + warningRect!.height).toBeLessThanOrEqual(
      submitBtnRect!.y + 2
    );

    await noteField.focus();
    await captureEvidence(
      page,
      'issue-740-mentor-step2-other-note-expanded-warning',
      {
        waitForSelector: '[role="dialog"]',
      }
    );

    await dialog.getByRole('button', { name: '送出並填下一場' }).click();

    await expect(dialog.getByTestId('feedback-queue-counter')).toHaveText(
      '第 3／3 場'
    );
    await expect(dialog.getByTestId('feedback-mentor-header')).toContainText(
      'Zahra Mirzakhani'
    );

    // Final Mentor card (!hasRemainingQueueCard): Step 2 submit button displays '送出'
    await dialog
      .locator('label')
      .filter({ hasText: /^沒有進行$/ })
      .click();
    await dialog.getByRole('button', { name: '下一步' }).click();
    await expect(
      dialog.getByRole('button', { name: '送出', exact: true })
    ).toBeDisabled();
    await expect(dialog.getByRole('button', { name: '送出回饋' })).toHaveCount(
      0
    );
    await dialog
      .locator('label')
      .filter({ hasText: /^對方未出席$/ })
      .click();
    await dialog.getByRole('button', { name: '送出', exact: true }).click();
    await expect(dialog).toHaveCount(0);

    expect(submittedPayloads).toEqual([
      { id: 701, body: { meeting_happened: true } },
      {
        id: 702,
        body: {
          meeting_happened: false,
          not_happened_reason: 'OTHER',
          note: '學員臨時有事已在聊聊通知改期',
        },
      },
      {
        id: 703,
        body: {
          meeting_happened: false,
          not_happened_reason: 'COUNTERPART_ABSENT',
        },
      },
    ]);
  });

  test('Mentee 登入略過與讓位防護：URL 含 reservationId / feedbackReservationId 及預約頁面讓位不彈出；點擊 X 僅略過本次登入，重新登入後再次彈出', async ({
    page,
  }) => {
    let isLoggedIn = true;
    const menteeSession = makeMenteeSession();

    await setSignedSessionCookie(page, {
      ...menteeSession.user,
      token: 'mock-access-token',
    });

    await page.route(/\/api\/auth\/session/, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(isLoggedIn ? menteeSession : {}),
        });
      }
      return route.continue();
    });
    await mockCommonRoutes(page);

    await page.route(
      new RegExp(`/v1/users/${USER_ID}/reservations([?]|$)`),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: { reservations: [], next_dtend: 0 },
          }),
        })
    );

    await page.route(
      new RegExp(`/v1/users/${USER_ID}/reservations/pending-feedback$`),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: {
              reservations: [
                makePendingFeedbackReservation({
                  id: 801,
                  counterpartyName: 'Emily Chen',
                  dtstart: 1760266800,
                  viewerRole: 'MENTEE',
                }),
              ],
            },
          }),
        })
    );

    // 1. URL contains reservationId or feedbackReservationId -> yields (does NOT pop up)
    await page.goto('/about?reservationId=801');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.goto('/about?feedbackReservationId=801');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // 2. Reservation management page -> excluded (does NOT pop up)
    await page.goto('/reservation/mentee');
    await expect(page.getByRole('tab').first()).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // 3. Eligible page (/about without yield params) -> pops up pending feedback dialog!
    await page.goto('/about');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('這場會談是否順利進行？')).toBeVisible();
    await expect(dialog.getByTestId('feedback-mentor-header')).toContainText(
      'Emily Chen'
    );

    await captureEvidence(
      page,
      'issue-740-mentee-login-pending-feedback-popup',
      {
        waitForSelector: '[role="dialog"]',
      }
    );

    // 4. Click top-right X -> dismisses for current login session (navigating to /privacy does NOT re-pop)
    await dialog.getByRole('button', { name: '關閉回饋視窗' }).click();
    await expect(dialog).toHaveCount(0);

    await page.goto('/privacy');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // 5. Simulate logout -> unauthenticated clears session skip state -> re-login pops up again!
    isLoggedIn = false;
    await page.goto('/about');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    isLoggedIn = true;
    await page.goto('/about');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page.getByRole('dialog').getByTestId('feedback-mentor-header')
    ).toContainText('Emily Chen');
  });
});
