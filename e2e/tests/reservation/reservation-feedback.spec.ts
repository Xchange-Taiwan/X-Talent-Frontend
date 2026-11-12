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

test.describe('Mentee 會談回饋彈窗、歷史紀錄卡片狀態與版面交換 (#730)', () => {
  test('Pending/Upcoming 分頁對調、歷史紀錄四種回饋狀態顯示（含評價未公開與 1.h 位置交換）', async ({
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
      makeMenteeHistoryReservation(103, '林佳穎', {
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
    await expect(answerCard.getByRole('button', { name: '編輯' })).toHaveCount(
      0
    );
    await expect(answerCard.getByRole('status')).toHaveText('已結束');

    const publicCard = page
      .getByTestId('reservation-card')
      .filter({ hasText: '陳大文' });
    await expect(publicCard.getByRole('status')).toHaveText('已填寫');
    await expect(publicCard.getByText('10 / 10')).toBeVisible();
    await expect(
      publicCard.getByText('導師給了非常具體的作品集優化方向，收穫滿滿！')
    ).toBeVisible();
    await expect(
      publicCard.getByRole('button', { name: '編輯' })
    ).toBeVisible();
    await expect(page.getByText('尚未公開')).not.toBeVisible();

    const unpublicizedCard = page
      .getByTestId('reservation-card')
      .filter({ hasText: '林佳穎' });
    await expect(unpublicizedCard.getByRole('status')).toHaveText('評價未公開');
    await expect(
      unpublicizedCard.getByRole('button', { name: '編輯' })
    ).toBeVisible();
    await expect(
      unpublicizedCard.getByText(
        '這場會談已被標註沒有進行，因此評價不會公開；如有疑問可以透過回饋表單聯繫我們。'
      )
    ).toBeVisible();

    const notHappenedCard = page
      .getByTestId('reservation-card')
      .filter({ hasText: '蘇元貞' });
    await expect(notHappenedCard.getByRole('status')).toHaveText('未進行');
    await expect(
      notHappenedCard.getByRole('button', { name: '編輯' })
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: /刪除/ })).toHaveCount(0);

    await captureEvidence(page, 'mentee-history-feedback-card-states');
  });

  test('有進行評分流程：十顆星評分（預設 10 分）、姓名遮罩提示與字數計數、送出失敗保留內容並由 Toast 回到評論重試成功', async ({
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
    await expect(dialog.getByText('會談是否有進行？')).toBeVisible();
    await captureEvidence(page, 'meeting-feedback-dialog-step1-attendance', {
      waitForSelector: '[role="dialog"]',
    });

    await dialog.locator('label').filter({ hasText: /^是$/ }).click();
    await dialog.getByRole('button', { name: '下一步' }).click();

    await expect(dialog.getByText('為本次會談評分')).toBeVisible();
    await expect(
      dialog.getByTestId('feedback-name-masking-hint')
    ).toBeVisible();

    const starGroup = dialog.getByRole('radiogroup', { name: '整體滿意度' });
    await expect(starGroup).toBeVisible();
    const starRadios = starGroup.getByRole('radio');
    await expect(starRadios).toHaveCount(10);

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
    const commentField = dialog.getByLabel('評論內容（選填）');
    await expect(commentField).toHaveAttribute('rows', '5');
    await expect(dialog.getByTestId('feedback-content-counter')).toHaveText(
      '0 / 1000'
    );
    await commentField.fill(commentText);
    await expect(dialog.getByTestId('feedback-content-counter')).toHaveText(
      `${commentText.length} / 1000`
    );

    await captureEvidence(page, 'meeting-feedback-dialog-step2-rating-stars', {
      waitForSelector: '[role="dialog"]',
    });

    // First attempt fails -> dialog closes, failure toast shows "送出失敗，回到評論重新送出"
    await dialog.getByRole('button', { name: '送出' }).click();

    const reopenButton = page.getByRole('button', { name: '評論' });
    await expect(reopenButton).toBeVisible();
    await captureEvidence(page, 'meeting-feedback-submit-failure-toast');

    // Click "評論" to reopen dialog with preserved rating (9) & comment
    await reopenButton.click();
    await expect(dialog.getByText('為本次會談評分')).toBeVisible();
    await expect(dialog.getByTestId('meeting-rating-value')).toHaveText(
      '9 / 10'
    );
    await expect(dialog.getByLabel('評論內容（選填）')).toHaveValue(
      commentText
    );

    // Retry submit -> succeeds -> card transitions to 已填寫 + 9 / 10
    await dialog.getByRole('button', { name: '送出' }).click();
    await expect(page.getByText('已送出', { exact: true })).toBeVisible();
    await expect(
      page.getByText('X-Talent 已收到您的回饋，謝謝您！', { exact: true })
    ).toBeVisible();

    const updatedCard = page
      .getByTestId('reservation-card')
      .filter({ hasText: 'Emily Chen' });
    await expect(updatedCard.getByRole('status')).toHaveText('已填寫');
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

  test('未進行會談流程：選擇未進行原因並送出（不含多餘欄位），卡片更新為未進行；Mentor 歷史紀錄同步顯示評價', async ({
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
    await dialog.locator('label').filter({ hasText: /^否$/ }).click();
    await dialog.getByRole('button', { name: '下一步' }).click();

    await expect(dialog.getByText('未進行會談的原因')).toBeVisible();
    await expect(dialog.getByText(/誰沒有進行/)).toHaveCount(0);

    await dialog.locator('label').filter({ hasText: '未出席' }).click();
    await captureEvidence(page, 'meeting-feedback-dialog-step2-not-happened', {
      waitForSelector: '[role="dialog"]',
    });

    await dialog.getByRole('button', { name: '送出' }).click();

    await expect(page.getByText('已送出', { exact: true })).toBeVisible();
    await expect(
      page.getByText('X-Talent 已收到您的回饋，謝謝您！', { exact: true })
    ).toBeVisible();

    const card = page
      .getByTestId('reservation-card')
      .filter({ hasText: 'Alex Wang' });
    await expect(card.getByRole('status')).toHaveText('未進行');
    expect(submittedPayload).toEqual({
      meeting_happened: false,
      not_happened_reason: 'MENTOR_ABSENT',
    });

    // Verify Mentor History view tab swap & public review display
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

    await expect(page.getByText('學員評價')).toBeVisible();
    await expect(page.getByText('10 / 10')).toBeVisible();
    await expect(
      page.getByText('謝謝導師清楚剖析設計系統架構！')
    ).toBeVisible();
    await expect(page.getByRole('button', { name: '編輯' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /刪除/ })).toHaveCount(0);

    await captureEvidence(page, 'mentor-history-public-feedback-card');
  });

  test('Mentee 永久不限次數編輯回饋 (#731)：跳過出席題並預填舊值、取消還原舊值、PUT 失敗保留草稿重試、無限次儲存更新且維持原 is_public 與排序', async ({
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
    await expect(dialog.getByText('會談是否有進行？')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: '上一步' })).toHaveCount(0);
    await expect(dialog.getByTestId('meeting-rating-value')).toHaveText(
      '7 / 10'
    );

    const starGroup = dialog.getByRole('radiogroup', { name: '整體滿意度' });
    await expect(
      starGroup.getByRole('radio', { name: '7 分' })
    ).toHaveAttribute('aria-checked', 'true');
    await expect(
      starGroup.getByRole('radio', { name: '10 分' })
    ).toHaveAttribute('aria-checked', 'false');

    const commentField = dialog.getByLabel('評論內容（選填）');
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

    // 3. Edit & save: first PUT fails -> reopen from Toast preserves draft -> retry succeeds
    const firstEditedComment = '更新後的詳細回饋內容，非常推薦！';
    await starGroup.getByRole('radio', { name: '9 分' }).click();
    await commentField.fill(firstEditedComment);
    await dialog.getByRole('button', { name: '儲存' }).click();

    const reopenButton = page.getByRole('button', { name: '評論' });
    await expect(reopenButton).toBeVisible();
    await reopenButton.click();

    await expect(dialog.getByText('編輯回饋')).toBeVisible();
    await expect(dialog.getByTestId('meeting-rating-value')).toHaveText(
      '9 / 10'
    );
    await expect(commentField).toHaveValue(firstEditedComment);

    await dialog.getByRole('button', { name: '儲存' }).click();
    await expect(page.getByText('已儲存', { exact: true })).toBeVisible();
    await expect(publicCard.getByText('9 / 10')).toBeVisible();
    await expect(publicCard.getByText(firstEditedComment)).toBeVisible();
    await expect(publicCard.getByRole('status')).toHaveText('已填寫');

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
});
