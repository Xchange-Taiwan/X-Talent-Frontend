import { expect, Page, test } from '@playwright/test';

import { captureEvidence } from '../../helpers/evidence';
import { seedMockAuthSession } from '../../helpers/session';

const MENTOR_USER_ID = '2';
const MENTOR_PAGE_URL = '/reservation/mentor';

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

interface MockRawRating {
  rating: number;
  content: string;
  created_at: number;
  updated_at: number;
  author_name: string | null;
  is_public: boolean;
}

interface MockRawFeedback {
  meeting_happened: boolean | null;
  my_meeting_happened?: boolean | null;
  rating: MockRawRating | null;
  next_step: 'ANSWER' | 'RATE' | null;
}

interface MockMentorHistoryRecord {
  id: number;
  sender: {
    user_id: number;
    role: 'MENTEE';
    status: 'ACCEPT' | 'REJECT';
    name: string;
    avatar: string;
    job_title: string;
    years_of_experience: string;
  };
  participant: {
    user_id: number;
    role: 'MENTOR';
    status: 'ACCEPT' | 'REJECT';
    name: string;
    avatar: string;
    job_title: string;
    years_of_experience: string;
  };
  schedule_id: number;
  dtstart: number;
  dtend: number;
  previous_reserve: null;
  messages: Array<{
    id: number;
    user_id: number;
    role: 'MENTEE';
    content: string;
  }>;
  feedback?: MockRawFeedback;
}

function isPlainRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function makeMentorHistoryItem(opts: {
  id: number;
  menteeName: string;
  jobTitle?: string;
  yearsOfExperience?: string;
  senderStatus?: 'ACCEPT' | 'REJECT';
  participantStatus?: 'ACCEPT' | 'REJECT';
  feedback?: MockRawFeedback;
}): MockMentorHistoryRecord {
  const {
    id,
    menteeName,
    jobTitle = 'UI/UX 設計師',
    yearsOfExperience = 'FIVE_TO_TEN',
    senderStatus = 'ACCEPT',
    participantStatus = 'ACCEPT',
    feedback,
  } = opts;

  return {
    id,
    sender: {
      user_id: 300 + id,
      role: 'MENTEE',
      status: senderStatus,
      name: menteeName,
      avatar: '',
      job_title: jobTitle,
      years_of_experience: yearsOfExperience,
    },
    participant: {
      user_id: Number(MENTOR_USER_ID),
      role: 'MENTOR',
      status: participantStatus,
      name: 'Alex Mentor',
      avatar: '',
      job_title: 'Staff Product Designer',
      years_of_experience: 'TEN_PLUS',
    },
    schedule_id: id,
    dtstart: 1761649200,
    dtend: 1761651000,
    previous_reserve: null,
    messages: [
      {
        id: id * 10 + 1,
        user_id: 300 + id,
        role: 'MENTEE',
        content: '希望能請教設計系統導入與跨團隊協作經驗！',
      },
    ],
    ...(feedback ? { feedback } : {}),
  };
}

async function setupAuthenticatedMentor(page: Page) {
  await seedMockAuthSession(page, {
    id: MENTOR_USER_ID,
    name: 'Alex Mentor',
    isMentor: true,
    onBoarding: true,
    jobTitle: 'Staff Product Designer',
    company: 'X-Talent',
  });
  await page.route(/\/v1\/users\/.*\/notifications\/unread-count/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: '0',
        msg: 'ok',
        data: { unread_count: 0 },
      }),
    })
  );
}

test.describe('Mentor 預約歷史紀錄卡片與「確認會談」彈窗流程 (#735)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await setupAuthenticatedMentor(page);
  });

  test('歷史紀錄卡片依狀態顯示公開回饋（遮罩姓名 · 分數 / 10 · 日期）、不揭露 Mentee 未進行回答、且點「確認會談」走兩頁版（有進行直接送出／沒有進行必選原因與補充說明並鎖定）', async ({
    page,
  }) => {
    const historyState = [
      // 1. Mentor confirmed 有進行 + received public Mentee feedback (#760 §3.1 feedback.meeting_happened)
      makeMentorHistoryItem({
        id: 701,
        menteeName: 'Zahra Mirzakhani',
        jobTitle: 'Senior UX Designer',
        feedback: {
          meeting_happened: true,
          rating: {
            rating: 10,
            content: '非常感謝導師提供可立即落地的設計系統治理建議！',
            created_at: 1761652000,
            updated_at: 1761652000,
            author_name: 'Z***',
            is_public: true,
          },
          next_step: null,
        },
      }),
      // 2. Mentor pending confirmation + Mentee already submitted public rating (immediately visible while 確認會談 stays open)
      makeMentorHistoryItem({
        id: 702,
        menteeName: 'Emily Chen',
        jobTitle: 'UI/UX 設計師',
        feedback: {
          meeting_happened: null,
          rating: {
            rating: 9,
            content: '導師分享的作品集架構拆解非常清楚。',
            created_at: 1761479200,
            updated_at: 1761479200,
            author_name: 'E***',
            is_public: true,
          },
          next_step: 'ANSWER',
        },
      }),
      // 3. Mentor pending confirmation without Mentee rating yet
      makeMentorHistoryItem({
        id: 703,
        menteeName: 'Kevin Lin',
        jobTitle: '前端工程師',
        feedback: {
          meeting_happened: null,
          rating: null,
          next_step: 'ANSWER',
        },
      }),
      // 4. Mentor confirmed 有進行 while Mentee answered 沒有進行 -> MUST show 查看紀錄 (own answer) & hide unpublicized rating without leaking Mentee's answer
      makeMentorHistoryItem({
        id: 704,
        menteeName: 'Mia Wu',
        jobTitle: '產品經理',
        feedback: {
          meeting_happened: false,
          my_meeting_happened: true,
          rating: {
            rating: 6,
            content: '這段未公開回饋絕對不可顯示給導師',
            created_at: 1761300000,
            updated_at: 1761300000,
            author_name: 'M***',
            is_public: false,
          },
          next_step: null,
        },
      }),
      // 5. Cancelled reservation -> never shows 確認會談
      makeMentorHistoryItem({
        id: 705,
        menteeName: 'Alex Wang',
        jobTitle: '後端工程師',
        senderStatus: 'REJECT',
      }),
    ];

    const submittedPayloads: Array<{
      id: string;
      body: Record<string, unknown>;
    }> = [];

    await page.route(
      new RegExp(`/v1/users/${MENTOR_USER_ID}/reservations([?]|$)`),
      (route) => {
        const url = new URL(route.request().url());
        const state = url.searchParams.get('state');
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            makeReservationResponse(
              state === 'MENTOR_HISTORY' ? historyState : []
            )
          ),
        });
      }
    );

    await page.route(
      /\/v1\/users\/2\/reservations\/(\d+)\/feedback$/,
      (route) => {
        const match = route
          .request()
          .url()
          .match(/\/reservations\/(\d+)\/feedback$/);
        const targetId = match ? Number(match[1]) : 0;
        const parsedJson: unknown = route.request().postDataJSON();
        const body = isPlainRecord(parsedJson) ? parsedJson : {};
        submittedPayloads.push({ id: String(targetId), body });

        const idx = historyState.findIndex((it) => it.id === targetId);
        if (idx !== -1) {
          const prev = historyState[idx];
          const happened = body.meeting_happened === true;
          const prevRating = prev.feedback?.rating ?? null;
          historyState[idx] = {
            ...prev,
            feedback: {
              meeting_happened: happened,
              rating: prevRating
                ? {
                    ...prevRating,
                    is_public: happened ? prevRating.is_public : false,
                  }
                : null,
              next_step: null,
            },
          };
        }

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: '0', msg: 'ok', data: {} }),
        });
      }
    );

    await page.goto(`${MENTOR_PAGE_URL}?tab=history`);

    // Card 701: Expand 查看紀錄 ⌄ -> displays 已回報：有進行 + Z*** · 10 / 10 · YYYY/MM/DD + content, zero edit/delete buttons
    const card701 = page.locator('[data-reservation-id="701"]');
    await expect(card701).toBeVisible();
    await card701.getByRole('button', { name: '查看紀錄' }).click();
    await expect(card701.getByTestId('mentor-attendance-record')).toHaveText(
      '已回報：有進行'
    );
    const meta701 = card701.getByTestId('mentor-feedback-meta');
    await expect(meta701).toContainText('Z***');
    await expect(meta701).toContainText('10 / 10');
    await expect(meta701).toContainText(/\d{4}\/\d{2}\/\d{2}/);
    await expect(
      card701.getByText('非常感謝導師提供可立即落地的設計系統治理建議！')
    ).toBeVisible();
    await expect(card701.getByRole('button', { name: '編輯' })).toHaveCount(0);
    await expect(card701.getByRole('button', { name: /刪除/ })).toHaveCount(0);

    // Card 702: Public rating immediately visible alongside 確認會談 button before Mentor answers
    const card702 = page.locator('[data-reservation-id="702"]');
    const meta702 = card702.getByTestId('mentor-feedback-meta');
    await expect(meta702).toContainText('E***');
    await expect(meta702).toContainText('9 / 10');
    await expect(
      card702.getByText('導師分享的作品集架構拆解非常清楚。')
    ).toBeVisible();

    // Scroll back to top so both expanded Card 701 (masked name · score/10 · date + content)
    // and Card 702 (pending 確認會談 + visible public feedback) are framed inside the viewport
    await page.evaluate(() => window.scrollTo(0, 0));
    await card701.scrollIntoViewIfNeeded();
    await captureEvidence(
      page,
      '735-mentor-history-cards-expanded-public-feedback'
    );

    // Card 704: Mentee answered 沒有進行 while Mentor answered 有進行 -> shows 查看紀錄 (NOT 未進行), hides unpublicized rating
    const card704 = page.locator('[data-reservation-id="704"]');
    await expect(
      card704.getByRole('button', { name: '查看紀錄' })
    ).toBeVisible();
    await expect(card704.getByText('未進行')).toHaveCount(0);
    await card704.getByRole('button', { name: '查看紀錄' }).click();
    await expect(card704.getByTestId('mentor-attendance-record')).toHaveText(
      '已回報：有進行'
    );
    await expect(
      card704.getByText('這段未公開回饋絕對不可顯示給導師')
    ).toHaveCount(0);
    await expect(card704.getByText(/目前尚無|等待|尚未/)).toHaveCount(0);

    // Card 705 (Cancelled): shows 已由學員取消 badge, no 確認會談 button
    const card705 = page.locator('[data-reservation-id="705"]');
    await expect(card705.getByRole('button', { name: '確認會談' })).toHaveCount(
      0
    );

    // Card 703: Mentor clicks 確認會談 -> selects 有進行 -> clicks 確定送出 directly from Step 1 -> locks into 查看紀錄 ⌄
    const card703 = page.locator('[data-reservation-id="703"]');
    await card703.getByRole('button', { name: '確認會談' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId('feedback-dialog-title')).toHaveText(
      '確認會談'
    );
    await expect(dialog.getByTestId('feedback-mentor-header')).toContainText(
      'Kevin Lin'
    );
    await expect(
      dialog.getByRole('button', { name: '確定送出' })
    ).toBeDisabled();

    await dialog
      .locator('label')
      .filter({ hasText: /^有進行$/ })
      .click();
    await expect(
      dialog.getByRole('button', { name: '確定送出' })
    ).toBeEnabled();

    await captureEvidence(page, '735-mentor-confirm-session-step1-happened', {
      waitForSelector: '[role="dialog"]',
    });

    await dialog.getByRole('button', { name: '確定送出' }).click();
    await expect(dialog).not.toBeVisible();

    expect(submittedPayloads[0]).toEqual({
      id: '703',
      body: { meeting_happened: true },
    });
    await expect(card703.getByRole('button', { name: '確認會談' })).toHaveCount(
      0
    );
    await expect(
      card703.getByRole('button', { name: '查看紀錄' })
    ).toBeVisible();

    // Card 702: Mentor clicks 確認會談 -> 沒有進行 -> Step 2 (5 shared Design Hub reasons without 誰沒有進行會談 + OTHER 1000-char note + warning box) -> 送出 -> locks to 未進行 & hides rating!
    await card702.scrollIntoViewIfNeeded();
    await card702.getByRole('button', { name: '確認會談' }).click();

    await expect(dialog).toBeVisible();
    await dialog
      .locator('label')
      .filter({ hasText: /^沒有進行$/ })
      .click();
    await dialog.getByRole('button', { name: '下一步' }).click();

    await expect(dialog.getByText('步驟 2 / 2 · 會談狀況')).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: '未進行會談的原因' })
    ).toBeVisible();
    await expect(dialog.getByText(/誰沒有進行會談/)).toHaveCount(0);
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
    await expect(
      dialog.getByTestId('mentor-not-happened-warning')
    ).toContainText(
      '送出後不能修改。這場會談不會計入已完成場次，學員的評價也不會公開。'
    );

    // Select 其他 -> expands 補充說明（選填）
    await dialog
      .locator('label')
      .filter({ hasText: /^其他$/ })
      .click();
    const noteField = dialog.getByLabel(/補充說明/);
    await expect(noteField).toBeVisible();
    await noteField.fill('學員因臨時加班來訊改期，當日未進行會談');

    await captureEvidence(
      page,
      '735-mentor-confirm-session-step2-not-happened',
      { waitForSelector: '[role="dialog"]' }
    );

    await dialog.getByRole('button', { name: '送出' }).click();
    await expect(dialog).not.toBeVisible();

    expect(submittedPayloads[1]).toEqual({
      id: '702',
      body: {
        meeting_happened: false,
        not_happened_reason: 'OTHER',
        note: '學員因臨時加班來訊改期，當日未進行會談',
      },
    });

    // Locked as 未進行 and Mentee's previously visible rating is now hidden
    await expect(card702.getByRole('button', { name: '確認會談' })).toHaveCount(
      0
    );
    await expect(card702.getByText('未進行')).toBeVisible();
    await expect(
      card702.getByText('導師分享的作品集架構拆解非常清楚。')
    ).toHaveCount(0);

    // Reload page so in-memory optimistic cache clears and cards render purely from
    // #760 §3.1 API shape `{ meeting_happened: true | false, rating, next_step: null }`
    await page.reload();
    await expect(
      card703.getByRole('button', { name: '查看紀錄' })
    ).toBeVisible();
    await card703.getByRole('button', { name: '查看紀錄' }).click();
    await expect(card703.getByTestId('mentor-attendance-record')).toHaveText(
      '已回報：有進行'
    );
    await expect(card702.getByText('未進行')).toBeVisible();

    await captureEvidence(
      page,
      '874-mentor-history-reloaded-meeting-happened-states'
    );
  });

  test('URL 帶入 reservation_id 深連結且 Mentor 待回答時自動切至歷史紀錄並開啟「確認會談」彈窗，關閉或送出後清除參數且手機版 RWD 排版正常', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const historyItems = [
      makeMentorHistoryItem({
        id: 801,
        menteeName: 'Emily Chen',
        jobTitle: 'UI/UX 設計師',
        feedback: {
          meeting_happened: null,
          rating: null,
          next_step: 'ANSWER',
        },
      }),
    ];

    await page.route(
      new RegExp(`/v1/users/${MENTOR_USER_ID}/reservations([?]|$)`),
      (route) => {
        const url = new URL(route.request().url());
        const state = url.searchParams.get('state');
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            makeReservationResponse(
              state === 'MENTOR_HISTORY' ? historyItems : []
            )
          ),
        });
      }
    );

    await page.goto(`${MENTOR_PAGE_URL}?reservation_id=801`);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId('feedback-dialog-title')).toHaveText(
      '確認會談'
    );
    await expect(dialog.getByTestId('feedback-mentor-header')).toContainText(
      'Emily Chen'
    );
    await expect(dialog.getByText('步驟 1 / 2 · 確認會談')).toBeVisible();

    await captureEvidence(
      page,
      '735-mobile-deeplink-mentor-confirm-dialog-open',
      { waitForSelector: '[role="dialog"]' }
    );

    // Closing strips one-shot reservation_id so reload will not re-open the modal
    await dialog.getByRole('button', { name: '關閉回饋視窗' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveURL('/reservation/mentor?tab=history');

    const highlightedCard = page.locator('[data-reservation-id="801"]');
    await expect(highlightedCard).toHaveAttribute('data-highlighted', 'true');
    await expect(
      highlightedCard.getByRole('button', { name: '確認會談' })
    ).toBeVisible();

    await page.reload();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
