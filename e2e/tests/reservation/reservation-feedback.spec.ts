import { expect, Page, test } from '@playwright/test';

import { captureEvidence } from '../../helpers/evidence';
import { setSignedSessionCookie } from '../../helpers/session';

const USER_ID = '1';
const MENTEE_PAGE_URL = '/reservation/mentee';
const MENTOR_PAGE_URL = '/reservation/mentor';

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
    accessToken: 'mock-token',
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

function makeMenteeHistoryReservation(
  id: number,
  mentorName: string,
  feedback?: object
) {
  return {
    id,
    sender: {
      user_id: Number(USER_ID),
      role: 'MENTEE',
      status: 'ACCEPT',
      name: 'Test Mentee',
      avatar: '',
      job_title: 'Junior Product Designer',
      years_of_experience: 'ONE_TO_THREE',
    },
    participant: {
      user_id: 100 + id,
      role: 'MENTOR',
      status: 'ACCEPT',
      name: mentorName,
      avatar: '',
      job_title: 'UI/UX 設計師',
      years_of_experience: 'FIVE_TO_TEN',
    },
    schedule_id: id,
    dtstart: 1760958000,
    dtend: 1760959800,
    previous_reserve: null,
    messages: [
      {
        id: id * 10 + 1,
        user_id: Number(USER_ID),
        role: 'MENTEE',
        content: '想請教作品集的整理方向，以及轉職 UI/UX 設計師的準備方式。',
      },
    ],
    ...(feedback ? { feedback } : {}),
  };
}

async function setupMenteeAuth(page: Page): Promise<void> {
  const session = makeMenteeSession();
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
  await page.route(/\/v1\/notifications/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: '0', msg: 'ok', data: { items: [] } }),
    })
  );
}

async function setupMentorAuth(page: Page): Promise<void> {
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
  await page.route(/\/v1\/notifications/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: '0', msg: 'ok', data: { items: [] } }),
    })
  );
}

test.describe('Mentee 會談回饋彈窗、歷史紀錄收合面板與版面翻新 (#730 / #734 / #731)', () => {
  test('Pending/Upcoming 分頁對調、歷史卡片右上預設收合「查看回饋 ⌄」與 #734 暖黃「評價未公開」展開面板 + Tooltip', async ({
    page,
  }) => {
    await setupMenteeAuth(page);

    const historyItems = [
      makeMenteeHistoryReservation(101, 'Emily Chen', {
        meeting_happened: null,
        rating: null,
        next_step: 'ANSWER',
      }),
      makeMenteeHistoryReservation(102, '陳大文', {
        meeting_happened: true,
        rating: {
          rating: 10,
          content: '導師給了非常具體的作品集優化方向，收穫滿滿！',
          created_at: 1760960000,
          updated_at: 1760960000,
          author_name: '王＊明',
          is_public: true,
        },
        next_step: null,
      }),
      makeMenteeHistoryReservation(103, 'Zahra Mirzakhani', {
        meeting_happened: false,
        rating: {
          rating: 8,
          content: '感謝導師分享職涯建議。',
          created_at: 1760960000,
          updated_at: 1760960500,
          author_name: '王＊明',
          is_public: false,
        },
        next_step: null,
      }),
      makeMenteeHistoryReservation(104, '蘇元貞', {
        meeting_happened: false,
        rating: null,
        next_step: null,
      }),
    ];

    await page.route(
      new RegExp(`/v1/users/${USER_ID}/reservations([?]|$)`),
      (route) => {
        const url = new URL(route.request().url());
        const state = url.searchParams.get('state');
        const list = state === 'MENTEE_HISTORY' ? historyItems : [];
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeReservationResponse(list)),
        });
      }
    );

    await page.goto(MENTEE_PAGE_URL);

    // 1. Verify Pending & Upcoming tabs swapped and Pending is selected by default: [等待回覆, 即將到來, 歷史紀錄]
    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(0)).toContainText('等待回覆');
    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.nth(1)).toContainText('即將到來');
    await expect(tabs.nth(2)).toContainText('歷史紀錄');

    // 2. Switch to History tab
    await tabs.nth(2).click();

    const answerCard = page
      .getByTestId('reservation-card')
      .filter({ hasText: 'Emily Chen' });
    await expect(
      answerCard.getByRole('button', { name: '填寫回饋' })
    ).toBeVisible();
    await expect(answerCard.getByRole('status')).toHaveCount(0);

    const publicCard = page
      .getByTestId('reservation-card')
      .filter({ hasText: '陳大文' });
    const viewFeedbackBtn = publicCard.getByRole('button', {
      name: '查看回饋',
    });
    await expect(viewFeedbackBtn).toBeVisible();
    await expect(viewFeedbackBtn).toHaveAttribute('aria-expanded', 'false');
    await expect(
      publicCard.getByTestId('reservation-feedback-public')
    ).toHaveCount(0);
    await expect(page.getByText('尚未公開')).not.toBeVisible();

    const unpublicizedCard = page
      .getByTestId('reservation-card')
      .filter({ hasText: 'Zahra Mirzakhani' });
    await expect(unpublicizedCard.getByRole('status')).toHaveText('評價未公開');
    const expandUnpubBtn = unpublicizedCard.getByRole('button', {
      name: '展開評價未公開說明',
    });
    await expect(expandUnpubBtn).toBeVisible();
    await expect(expandUnpubBtn).toHaveAttribute('aria-expanded', 'false');
    await expect(
      unpublicizedCard.getByTestId('reservation-feedback-unpublicized')
    ).toHaveCount(0);

    const notHappenedCard = page
      .getByTestId('reservation-card')
      .filter({ hasText: '蘇元貞' });
    await expect(notHappenedCard.getByRole('status')).toHaveText('未進行');

    await captureEvidence(page, 'mentee-history-feedback-cards-collapsed');

    // 3. Expand both 查看回饋 & 評價未公開 panels + verify dark tooltip on chevron
    await viewFeedbackBtn.click();
    await expect(publicCard.getByText('我的回饋')).toBeVisible();
    await expect(publicCard.getByText('10 / 10')).toBeVisible();
    await expect(
      publicCard.getByText('導師給了非常具體的作品集優化方向，收穫滿滿！')
    ).toBeVisible();
    await expect(
      publicCard.getByRole('button', { name: '編輯' })
    ).toBeVisible();

    await expandUnpubBtn.click();
    const collapseUnpubBtn = unpublicizedCard.getByRole('button', {
      name: '收合評價未公開說明',
    });
    await expect(collapseUnpubBtn).toHaveAttribute('aria-expanded', 'true');
    await expect(unpublicizedCard.getByText('我的回饋')).toBeVisible();
    await expect(
      unpublicizedCard.getByText(
        '這場會談已被標註沒有進行，因此評價不會公開；如有疑問可以透過回饋表單聯繫我們。'
      )
    ).toBeVisible();
    await expect(
      unpublicizedCard.getByRole('button', { name: '編輯' })
    ).toBeVisible();

    await collapseUnpubBtn.hover();
    await expect(
      unpublicizedCard.getByTestId('unpublicized-toggle-tooltip')
    ).toHaveText('收合評價未公開說明');

    await captureEvidence(page, 'mentee-history-unpublicized-expanded-tooltip');
  });

  test('有進行評分流程：導師標頭、blur(3px) 遮罩、ⓘ 遮罩姓名 Tooltip、送出失敗保留彈窗內容並顯示紅底 Toast、重試成功', async ({
    page,
  }) => {
    await setupMenteeAuth(page);

    let feedbackSubmitted = false;
    let postAttempt = 0;
    const capturedBodies: unknown[] = [];

    await page.route(
      new RegExp(`/v1/users/${USER_ID}/reservations([?]|$)`),
      (route) => {
        const url = new URL(route.request().url());
        const state = url.searchParams.get('state');
        if (state !== 'MENTEE_HISTORY') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(makeReservationResponse([])),
          });
        }

        const item = makeMenteeHistoryReservation(
          201,
          'Emily Chen',
          feedbackSubmitted
            ? {
                meeting_happened: true,
                rating: {
                  rating: 9,
                  content: '非常實用的作品集調整建議，謝謝導師！',
                  created_at: 1760960000,
                  updated_at: 1760960000,
                  author_name: '王＊明',
                  is_public: true,
                },
                next_step: null,
              }
            : {
                meeting_happened: null,
                rating: null,
                next_step: 'ANSWER',
              }
        );

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeReservationResponse([item])),
        });
      }
    );

    await page.route(
      new RegExp(`/v1/users/${USER_ID}/reservations/201/feedback$`),
      async (route) => {
        postAttempt += 1;
        capturedBodies.push(route.request().postDataJSON());
        if (postAttempt === 1) {
          return route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ code: '500', msg: 'Server Error' }),
          });
        }
        feedbackSubmitted = true;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: '0', msg: 'ok', data: {} }),
        });
      }
    );

    await page.goto(`${MENTEE_PAGE_URL}?tab=history`);

    const feedbackBtn = page.getByRole('button', { name: '填寫回饋' });
    await expect(feedbackBtn).toBeVisible();
    await feedbackBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('步驟 1 / 2 · 確認會談')).toBeVisible();
    await expect(dialog.getByText('這場會談是否順利進行？')).toBeVisible();
    await expect(dialog.getByTestId('feedback-mentor-header')).toContainText(
      'Emily Chen'
    );

    await captureEvidence(page, 'meeting-feedback-dialog-step1-attendance', {
      waitForSelector: '[role="dialog"]',
    });

    await dialog
      .locator('label')
      .filter({ hasText: /^有進行$/ })
      .click();
    await dialog.getByRole('button', { name: /下一步/ }).click();

    await expect(dialog.getByText('步驟 2 / 2 · 交流回饋')).toBeVisible();
    await expect(dialog.getByText('為本次會議評分')).toBeVisible();

    const maskInfoBtn = dialog.getByRole('button', { name: '姓名遮罩說明' });
    await maskInfoBtn.hover();
    const maskTooltip = dialog.getByTestId('feedback-name-masking-tooltip');
    await expect(maskTooltip).toBeVisible();
    await expect(maskTooltip).toHaveText('顯示時不會完整公開姓名與個人資料');
    const maskBtnBox = await maskInfoBtn.boundingBox();
    const maskTooltipBox = await maskTooltip.boundingBox();
    const ratingValueBox = await dialog
      .getByTestId('meeting-rating-value')
      .boundingBox();
    if (!maskBtnBox || !maskTooltipBox || !ratingValueBox) {
      throw new Error(
        'Expected masking button, tooltip, and rating value boundingBoxes'
      );
    }
    expect(maskTooltipBox.x).toBeGreaterThanOrEqual(
      maskBtnBox.x + maskBtnBox.width
    );
    const overlapsRatingValue =
      maskTooltipBox.x < ratingValueBox.x + ratingValueBox.width &&
      maskTooltipBox.x + maskTooltipBox.width > ratingValueBox.x &&
      maskTooltipBox.y < ratingValueBox.y + ratingValueBox.height &&
      maskTooltipBox.y + maskTooltipBox.height > ratingValueBox.y;
    expect(overlapsRatingValue).toBe(false);

    const starGroup = dialog.getByRole('radiogroup', { name: '整體滿意度' });
    await expect(starGroup.getByRole('radio')).toHaveCount(10);

    const star10 = starGroup.getByRole('radio', { name: '10 分' });
    await expect(star10).toHaveAttribute('aria-checked', 'true');
    await expect(dialog.getByTestId('meeting-rating-value')).toHaveText(
      '10 / 10'
    );

    await star10.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(
      starGroup.getByRole('radio', { name: '9 分' })
    ).toHaveAttribute('aria-checked', 'true');
    await expect(dialog.getByTestId('meeting-rating-value')).toHaveText(
      '9 / 10'
    );

    const commentText = '非常實用的作品集調整建議，謝謝導師！';
    const commentField = dialog.getByLabel(/文字回饋/);
    await expect(commentField).toHaveAttribute('rows', '5');
    await commentField.fill(commentText);
    await expect(dialog.getByTestId('feedback-content-counter')).toHaveText(
      `${commentText.length} / 1000`
    );

    await maskInfoBtn.hover();
    await expect(
      dialog.getByTestId('feedback-name-masking-tooltip')
    ).toBeVisible();
    await captureEvidence(
      page,
      'meeting-feedback-dialog-step2-rating-masking-tooltip',
      {
        waitForSelector: '[role="dialog"]',
      }
    );

    // First attempt fails -> dialog stays open with content intact + red destructive toast appears
    await dialog.getByRole('button', { name: '送出回饋' }).click();

    await expect(page.getByText('送出失敗', { exact: true })).toBeVisible();
    await expect(
      page.getByText('內容已保留，請再試一次。', { exact: true })
    ).toBeVisible();
    await expect(dialog.getByText('為本次會議評分')).toBeVisible();
    await expect(dialog.getByTestId('meeting-rating-value')).toHaveText(
      '9 / 10'
    );
    await expect(commentField).toHaveValue(commentText);

    await captureEvidence(page, 'meeting-feedback-submit-failure-red-toast', {
      waitForSelector: '[role="dialog"]',
    });

    // Retry submit directly inside the open dialog -> succeeds -> card transitions to 查看回饋 ⌄
    await dialog.getByRole('button', { name: '送出回饋' }).click();
    await expect(page.getByText('已送出', { exact: true })).toBeVisible();

    const updatedCard = page
      .getByTestId('reservation-card')
      .filter({ hasText: 'Emily Chen' });
    const viewFeedbackBtn = updatedCard.getByRole('button', {
      name: '查看回饋',
    });
    await expect(viewFeedbackBtn).toBeVisible();
    await viewFeedbackBtn.click();
    await expect(updatedCard.getByText('9 / 10')).toBeVisible();

    await captureEvidence(page, 'meeting-feedback-submit-success');

    expect(capturedBodies).toEqual([
      {
        meeting_happened: true,
        feedback: {
          rating: 9,
          content: commentText,
        },
      },
      {
        meeting_happened: true,
        feedback: {
          rating: 9,
          content: commentText,
        },
      },
    ]);
  });

  test('未進行會談流程：原因單選（選其他展開 1000 字補充說明、改選非其他自動收合）送出後卡片更新為未進行；Mentor 歷史紀錄可展開查看回饋', async ({
    page,
  }) => {
    await setupMenteeAuth(page);

    let reportedNotHappened = false;
    let submittedPayload: unknown = null;

    await page.route(
      new RegExp(`/v1/users/${USER_ID}/reservations([?]|$)`),
      (route) => {
        const url = new URL(route.request().url());
        const state = url.searchParams.get('state');
        if (state === 'MENTEE_HISTORY') {
          const item = makeMenteeHistoryReservation(
            301,
            'Alex Wang',
            reportedNotHappened
              ? {
                  meeting_happened: false,
                  rating: null,
                  next_step: null,
                }
              : {
                  meeting_happened: null,
                  rating: null,
                  next_step: 'ANSWER',
                }
          );
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(makeReservationResponse([item])),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeReservationResponse([])),
        });
      }
    );

    await page.route(
      new RegExp(`/v1/users/${USER_ID}/reservations/301/feedback$`),
      async (route) => {
        submittedPayload = route.request().postDataJSON();
        reportedNotHappened = true;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: '0', msg: 'ok', data: {} }),
        });
      }
    );

    await page.goto(`${MENTEE_PAGE_URL}?tab=history`);
    await page.getByRole('button', { name: '填寫回饋' }).click();

    const dialog = page.getByRole('dialog');
    await dialog
      .locator('label')
      .filter({ hasText: /^沒有進行$/ })
      .click();
    await dialog.getByRole('button', { name: /下一步/ }).click();

    await expect(dialog.getByText('步驟 2 / 2 · 會談狀況')).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: '未進行會談的原因' })
    ).toBeVisible();
    await expect(dialog.getByText('誰沒有進行會談？')).toHaveCount(0);
    await expect(dialog.getByText('為何沒有成功進行？')).toBeVisible();

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

    await dialog
      .locator('label')
      .filter({ hasText: /^對方未出席$/ })
      .click();
    await expect(
      dialog.getByTestId('not-happened-note-collapse')
    ).toHaveAttribute('data-expanded', 'false');

    await dialog
      .locator('label')
      .filter({ hasText: /^其他$/ })
      .click();
    await expect(
      dialog.getByTestId('not-happened-note-collapse')
    ).toHaveAttribute('data-expanded', 'true');

    const noteTextarea = dialog.getByLabel(/補充說明/);
    await expect(noteTextarea).toBeVisible();
    await expect(noteTextarea).toHaveAttribute(
      'placeholder',
      '說說發生了什麼事…'
    );
    await noteTextarea.fill('等候 15 分鐘未上線');
    const noteCounter = dialog.getByTestId('feedback-note-counter');
    await expect(noteCounter).toHaveText('11 / 1000');

    // Switching to non-OTHER reason collapses note input; switching back to 其他 re-expands with draft preserved
    await dialog
      .locator('label')
      .filter({ hasText: /^對方未出席$/ })
      .click();
    await expect(
      dialog.getByTestId('not-happened-note-collapse')
    ).toHaveAttribute('data-expanded', 'false');
    await dialog
      .locator('label')
      .filter({ hasText: /^其他$/ })
      .click();
    await expect(
      dialog.getByTestId('not-happened-note-collapse')
    ).toHaveAttribute('data-expanded', 'true');

    // Note textarea, 1000-char counter, and sticky footer buttons ("上一步" & "送出回饋") must stay completely unclipped within the 720p viewport
    const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
    const submitButton = dialog.getByRole('button', { name: '送出回饋' });
    const backButton = dialog.getByRole('button', { name: '上一步' });
    await expect(submitButton).toBeVisible();
    await expect(backButton).toBeVisible();
    await expect
      .poll(async () => {
        const submitBox = await submitButton.boundingBox();
        const counterBox = await noteCounter.boundingBox();
        if (!submitBox || !counterBox) return false;
        return (
          counterBox.y + counterBox.height <= submitBox.y &&
          submitBox.y + submitBox.height <= viewport.height
        );
      })
      .toBe(true);

    await captureEvidence(page, 'meeting-feedback-dialog-step2-not-happened', {
      waitForSelector: '[role="dialog"]',
    });

    await dialog.getByRole('button', { name: '送出回饋' }).click();

    await expect(page.getByText('已送出', { exact: true })).toBeVisible();

    const card = page
      .getByTestId('reservation-card')
      .filter({ hasText: 'Alex Wang' });
    await expect(card.getByRole('status')).toHaveText('未進行');
    expect(submittedPayload).toEqual({
      meeting_happened: false,
      not_happened_reason: 'OTHER',
      not_happened_note: '等候 15 分鐘未上線',
    });

    // Verify Mentor History view tab swap & collapsible 查看回饋 public review display
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await setupMentorAuth(page);
    await page.route(
      new RegExp(`/v1/users/${USER_ID}/reservations([?]|$)`),
      (route) => {
        const url = new URL(route.request().url());
        const state = url.searchParams.get('state');
        if (state === 'MENTOR_HISTORY') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(
              makeReservationResponse([
                {
                  id: 401,
                  sender: {
                    user_id: 50,
                    role: 'MENTEE',
                    status: 'ACCEPT',
                    name: '王小明',
                    avatar: '',
                    job_title: '前端工程師',
                    years_of_experience: 'ONE_TO_THREE',
                  },
                  participant: {
                    user_id: Number(USER_ID),
                    role: 'MENTOR',
                    status: 'ACCEPT',
                    name: 'Emily Chen',
                    avatar: '',
                    job_title: 'Senior UI/UX Designer',
                    years_of_experience: 'FIVE_TO_TEN',
                  },
                  schedule_id: 401,
                  dtstart: 1760958000,
                  dtend: 1760959800,
                  previous_reserve: null,
                  messages: [],
                  feedback: {
                    meeting_happened: true,
                    rating: {
                      rating: 10,
                      content: '謝謝導師清楚剖析設計系統架構！',
                      created_at: 1760960000,
                      updated_at: 1760960000,
                      author_name: '王＊明',
                      is_public: true,
                    },
                    next_step: null,
                  },
                },
              ])
            ),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeReservationResponse([])),
        });
      }
    );

    await page.goto(`${MENTOR_PAGE_URL}?tab=history`);

    const mentorTabs = page.getByRole('tab');
    await expect(mentorTabs.nth(0)).toContainText('待您回覆');
    await expect(mentorTabs.nth(1)).toContainText('即將到來');
    await expect(mentorTabs.nth(2)).toContainText('歷史紀錄');

    await page.getByRole('button', { name: '查看回饋' }).click();
    await expect(page.getByText('學員評價')).toBeVisible();
    await expect(page.getByText('10 / 10')).toBeVisible();
    await expect(
      page.getByText('謝謝導師清楚剖析設計系統架構！')
    ).toBeVisible();
    await expect(page.getByRole('button', { name: '編輯' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /刪除/ })).toHaveCount(0);

    await captureEvidence(page, 'mentor-history-public-feedback-card');
  });

  test('Mentee 永久不限次數編輯回饋 (#731)：展開後點編輯跳過出席題並預填舊值、取消還原舊值、PUT 失敗保留內容並顯示紅底 Toast、無限次儲存更新且維持原 is_public 與排序', async ({
    page,
  }) => {
    await setupMenteeAuth(page);

    const feedbackStateById: Record<
      number,
      {
        meeting_happened: boolean;
        rating: {
          rating: number;
          content: string;
          created_at: number;
          updated_at: number;
          author_name: string;
          is_public: boolean;
        } | null;
        next_step: null;
      }
    > = {
      501: {
        meeting_happened: true,
        rating: {
          rating: 7,
          content: '準備得非常充分，直接給了我下一步該做什麼。',
          created_at: 1760960000,
          updated_at: 1760960000,
          author_name: '王＊明',
          is_public: true,
        },
        next_step: null,
      },
      502: {
        meeting_happened: false,
        rating: {
          rating: 8,
          content: '感謝導師分享職涯建議。',
          created_at: 1760950000,
          updated_at: 1760950500,
          author_name: '王＊明',
          is_public: false,
        },
        next_step: null,
      },
      503: {
        meeting_happened: false,
        rating: null,
        next_step: null,
      },
    };

    const capturedPutRequests: Array<{
      reservationId: number;
      method: string;
      body: unknown;
    }> = [];
    let put501Attempt = 0;

    await page.route(
      new RegExp(`/v1/users/${USER_ID}/reservations([?]|$)`),
      (route) => {
        const url = new URL(route.request().url());
        const state = url.searchParams.get('state');
        if (state !== 'MENTEE_HISTORY') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(makeReservationResponse([])),
          });
        }

        const list = [
          makeMenteeHistoryReservation(501, '陳大文', feedbackStateById[501]),
          makeMenteeHistoryReservation(502, '林佳穎', feedbackStateById[502]),
          makeMenteeHistoryReservation(503, '蘇元貞', feedbackStateById[503]),
        ];
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeReservationResponse(list)),
        });
      }
    );

    await page.route(
      new RegExp(`/v1/users/${USER_ID}/reservations/(501|502)/feedback$`),
      async (route) => {
        const match = route
          .request()
          .url()
          .match(/\/reservations\/(\d+)\/feedback$/);
        const reservationId = Number(match?.[1] ?? 0);
        const method = route.request().method();
        const rawBody: unknown = route.request().postDataJSON();
        const body =
          rawBody &&
          typeof rawBody === 'object' &&
          'rating' in rawBody &&
          typeof rawBody.rating === 'number' &&
          'content' in rawBody &&
          typeof rawBody.content === 'string'
            ? { rating: rawBody.rating, content: rawBody.content }
            : { rating: 0, content: '' };
        capturedPutRequests.push({ reservationId, method, body });

        if (reservationId === 501) {
          put501Attempt += 1;
          if (put501Attempt === 1) {
            return route.fulfill({
              status: 500,
              contentType: 'application/json',
              body: JSON.stringify({ code: '500', msg: 'Server Error' }),
            });
          }
        }

        const existing = feedbackStateById[reservationId];
        if (existing?.rating) {
          existing.rating = {
            ...existing.rating,
            rating: body.rating,
            content: body.content,
            updated_at: existing.rating.updated_at + 100,
          };
        }

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: '0', msg: 'ok', data: {} }),
        });
      }
    );

    await page.goto(`${MENTEE_PAGE_URL}?tab=history`);

    const publicCard = page
      .getByTestId('reservation-card')
      .filter({ hasText: '陳大文' });
    const unpublicizedCard = page
      .getByTestId('reservation-card')
      .filter({ hasText: '林佳穎' });
    const absentCard = page
      .getByTestId('reservation-card')
      .filter({ hasText: '蘇元貞' });

    // Expand both rated cards first
    await publicCard.getByRole('button', { name: '查看回饋' }).click();
    await unpublicizedCard
      .getByRole('button', { name: '展開評價未公開說明' })
      .click();

    await expect(
      publicCard.getByRole('button', { name: '編輯' })
    ).toBeVisible();
    await expect(
      unpublicizedCard.getByRole('button', { name: '編輯' })
    ).toBeVisible();
    await expect(absentCard.getByRole('button', { name: '編輯' })).toHaveCount(
      0
    );
    await expect(page.getByRole('button', { name: /刪除/ })).toHaveCount(0);

    // 1. Click 編輯 -> skips Step 1 attendance question and prefills saved rating (7, NOT 10) & content
    await publicCard.getByRole('button', { name: '編輯' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('編輯回饋')).toBeVisible();
    await expect(dialog.getByText('這場會談是否順利進行？')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: '上一步' })).toHaveCount(0);
    await expect(dialog.getByTestId('meeting-rating-value')).toHaveText(
      '7 / 10'
    );

    const starGroup = dialog.getByRole('radiogroup', { name: '整體滿意度' });
    await expect(
      starGroup.getByRole('radio', { name: '7 分' })
    ).toHaveAttribute('aria-checked', 'true');

    const commentField = dialog.getByLabel(/文字回饋/);
    await expect(commentField).toHaveAttribute('rows', '5');
    await expect(commentField).toHaveClass(/resize-none/);
    await expect(commentField).toHaveValue(
      '準備得非常充分，直接給了我下一步該做什麼。'
    );

    await captureEvidence(page, 'meeting-feedback-edit-dialog-prefilled', {
      waitForSelector: '[role="dialog"]',
    });

    // 2. Manual cancel restores saved values (7 / 10 & original comment) instead of resetting to 10
    await starGroup.getByRole('radio', { name: '4 分' }).click();
    await commentField.fill('暫時修改但點擊取消不儲存');
    await dialog.getByRole('button', { name: '取消' }).click();
    await expect(dialog).not.toBeVisible();

    await publicCard.getByRole('button', { name: '編輯' }).click();
    await expect(dialog.getByTestId('meeting-rating-value')).toHaveText(
      '7 / 10'
    );
    await expect(commentField).toHaveValue(
      '準備得非常充分，直接給了我下一步該做什麼。'
    );

    // 3. Edit & save: first PUT fails -> dialog stays open with draft + red toast -> retry succeeds
    const firstEditedComment = '更新後的詳細回饋內容，非常推薦！';
    await starGroup.getByRole('radio', { name: '9 分' }).click();
    await commentField.fill(firstEditedComment);
    await dialog.getByRole('button', { name: '儲存' }).click();

    await expect(page.getByText('儲存失敗', { exact: true })).toBeVisible();
    await expect(
      page.getByText('內容已保留，請再試一次。', { exact: true })
    ).toBeVisible();
    await expect(dialog.getByTestId('meeting-rating-value')).toHaveText(
      '9 / 10'
    );
    await expect(commentField).toHaveValue(firstEditedComment);

    await dialog.getByRole('button', { name: '儲存' }).click();
    await expect(page.getByText('已儲存', { exact: true })).toBeVisible();
    await expect(publicCard.getByText('9 / 10')).toBeVisible();
    await expect(publicCard.getByText(firstEditedComment)).toBeVisible();

    // 4. Second edit on the same card (unlimited edits) + edit unpublicized card preserving 評價未公開 & card order
    await publicCard.getByRole('button', { name: '編輯' }).click();
    await expect(dialog.getByTestId('meeting-rating-value')).toHaveText(
      '9 / 10'
    );
    const secondEditedComment = '第二次編輯：導師補充的架構資源也非常實用！';
    await starGroup.getByRole('radio', { name: '10 分' }).click();
    await commentField.fill(secondEditedComment);
    await dialog.getByRole('button', { name: '儲存' }).click();
    await expect(publicCard.getByText('10 / 10')).toBeVisible();
    await expect(publicCard.getByText(secondEditedComment)).toBeVisible();

    await unpublicizedCard.getByRole('button', { name: '編輯' }).click();
    await expect(dialog.getByTestId('meeting-rating-value')).toHaveText(
      '8 / 10'
    );
    await starGroup.getByRole('radio', { name: '6 分' }).click();
    await commentField.fill('更新後的未公開回饋內容。');
    await dialog.getByRole('button', { name: '儲存' }).click();

    await expect(unpublicizedCard.getByRole('status')).toHaveText('評價未公開');
    await expect(unpublicizedCard.getByText('6 / 10')).toBeVisible();
    await expect(
      unpublicizedCard.getByText('更新後的未公開回饋內容。')
    ).toBeVisible();

    // Card order remains unchanged: 陳大文 -> 林佳穎 -> 蘇元貞
    const allCards = page.getByTestId('reservation-card');
    await expect(allCards.nth(0)).toContainText('陳大文');
    await expect(allCards.nth(1)).toContainText('林佳穎');
    await expect(allCards.nth(2)).toContainText('蘇元貞');

    await captureEvidence(page, 'meeting-feedback-edit-updated-cards');

    expect(capturedPutRequests).toEqual([
      {
        reservationId: 501,
        method: 'PUT',
        body: { rating: 9, content: firstEditedComment },
      },
      {
        reservationId: 501,
        method: 'PUT',
        body: { rating: 9, content: firstEditedComment },
      },
      {
        reservationId: 501,
        method: 'PUT',
        body: { rating: 10, content: secondEditedComment },
      },
      {
        reservationId: 502,
        method: 'PUT',
        body: { rating: 6, content: '更新後的未公開回饋內容。' },
      },
    ]);
  });

  test('#740 多場待填佇列：分段進度條、-5deg 傾斜底卡、略過 X Tooltip 無裁切，且送出後父層清單更新不跳場', async ({
    page,
  }) => {
    await setupMenteeAuth(page);

    const submittedIds = new Set<number>();

    await page.route(
      new RegExp(`/v1/users/${USER_ID}/reservations([?]|$)`),
      (route) => {
        const url = new URL(route.request().url());
        const state = url.searchParams.get('state');
        if (state === 'MENTEE_HISTORY') {
          const queueCandidates = [
            { id: 601, name: 'Emily Chen' },
            { id: 602, name: 'Alex Wang' },
            { id: 603, name: 'Zahra Mirzakhani' },
          ].map((entry) =>
            makeMenteeHistoryReservation(
              entry.id,
              entry.name,
              submittedIds.has(entry.id)
                ? {
                    meeting_happened: true,
                    rating: {
                      rating: 9,
                      content: '收穫良多！',
                      created_at: 1760950000,
                      updated_at: 1760950000,
                      author_name: '王＊明',
                      is_public: true,
                    },
                    next_step: null,
                  }
                : {
                    meeting_happened: null,
                    rating: null,
                    next_step: 'ANSWER',
                  }
            )
          );
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(makeReservationResponse(queueCandidates)),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeReservationResponse([])),
        });
      }
    );

    await page.route(
      new RegExp(`/v1/users/${USER_ID}/reservations/(601|602|603)/feedback$`),
      async (route) => {
        const match = route
          .request()
          .url()
          .match(/reservations\/(\d+)\/feedback$/);
        if (match) {
          submittedIds.add(Number(match[1]));
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: '0', msg: 'ok', data: {} }),
        });
      }
    );

    await page.goto(`${MENTEE_PAGE_URL}?tab=history&feedback=queue`);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId('feedback-queue-counter')).toHaveText(
      '第 1／3 場'
    );
    await expect(
      dialog.getByTestId('feedback-queue-progressbar')
    ).toBeVisible();
    await expect(dialog.getByTestId('feedback-queue-back-card')).toBeVisible();
    await expect(dialog.getByTestId('feedback-mentor-header')).toContainText(
      'Emily Chen'
    );

    // Hover skip button -> verify tooltip renders cleanly inside viewport without clipping
    const skipBtn = dialog.getByRole('button', {
      name: '略過 Emily Chen 這場回饋',
    });
    await skipBtn.hover();
    const skipTooltip = dialog.getByTestId('feedback-skip-tooltip');
    await expect(skipTooltip).toBeVisible();
    await expect(skipTooltip).toContainText(
      '略過這場，下次登入再提醒；也可到歷史紀錄填寫。'
    );
    const tooltipBox = await skipTooltip.boundingBox();
    const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
    if (!tooltipBox) {
      throw new Error('Expected skip tooltip boundingBox to be non-null');
    }
    expect(tooltipBox.x).toBeGreaterThanOrEqual(0);
    expect(tooltipBox.y).toBeGreaterThanOrEqual(0);
    expect(tooltipBox.x + tooltipBox.width).toBeLessThanOrEqual(viewport.width);

    await captureEvidence(page, 'meeting-feedback-dialog-multi-session-queue', {
      waitForSelector: '[role="dialog"]',
    });

    // Pressing Escape while tooltip is open dismisses ONLY the tooltip without closing dialog
    await page.keyboard.press('Escape');
    await expect(skipTooltip).not.toBeVisible();
    await expect(dialog).toBeVisible();

    // Submit Session 1 (Emily Chen) -> non-final button shows 送出並填下一場 -> parent MENTEE_HISTORY refetches and shrinks pending list -> must advance to Session 2 (Alex Wang) without skipping
    await dialog
      .locator('label')
      .filter({ hasText: /^有進行$/ })
      .click();
    await dialog.getByRole('button', { name: /下一步/ }).click();
    await dialog.getByRole('radio', { name: '9 分' }).click();
    await dialog.getByLabel(/文字回饋/).fill('收穫良多！');
    await dialog.getByRole('button', { name: '送出並填下一場' }).click();

    await expect(dialog.getByTestId('feedback-queue-counter')).toHaveText(
      '第 2／3 場'
    );
    await expect(
      dialog.getByTestId('feedback-queue-progressbar').locator('span').nth(0)
    ).toHaveAttribute('data-state', 'completed');
    await expect(dialog.getByTestId('feedback-mentor-header')).toContainText(
      'Alex Wang'
    );
    await expect(dialog.getByText('步驟 1 / 2 · 確認會談')).toBeVisible();
  });
});
