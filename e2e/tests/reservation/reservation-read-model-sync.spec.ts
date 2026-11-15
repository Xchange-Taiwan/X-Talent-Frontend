import { expect, type Page, test } from '@playwright/test';

import { captureEvidence } from '../../helpers/evidence';
import { mockApiRoute } from '../../helpers/route';
import { seedMockAuthSession } from '../../helpers/session';

test.use({ timezoneId: 'Asia/Taipei' });

const REAL_MENTOR_ID = '7482008160728084';
const MENTEE_ID = '1';
const SLOT_ID = 101;
const ALLOW_SLOT_ID = 102;
const RESERVATION_ID = 501;
// 2026-07-17 10:00 ~ 10:30 Asia/Taipei
const SLOT_DTSTART = 1784253600;
const SLOT_DTEND = 1784255400;
// 2026-07-17 14:00 ~ 14:30 Asia/Taipei
const ALLOW_DTSTART = 1784268000;
const ALLOW_DTEND = 1784269800;

async function mockCommonAuxiliaryRoutes(page: Page): Promise<void> {
  await page.route(/\/v1\/(?:users\/[^/]+\/)?notifications/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: '0',
        msg: 'ok',
        data: {
          unread_count: 0,
          notifications: [],
          items: [],
          next_cursor: null,
        },
      }),
    })
  );

  await page.route(/\/v1\/users\/[^/]+\/reservations\/pending-feedback$/, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: '0',
        msg: 'ok',
        data: { reservations: [] },
      }),
    })
  );
}

test.describe('ReservationReadModel 多頁保留、行事曆單次同步與即時草稿還原 (#899)', () => {
  test('Mentee 歷史紀錄載入第 2 頁後編輯第 2 頁評價 → 保留 Pages 1..2 且不重抓第 1 頁覆蓋', async ({
    page,
  }) => {
    await seedMockAuthSession(page, {
      id: MENTEE_ID,
      name: 'Test Mentee',
      isMentor: false,
      onBoarding: true,
      jobTitle: 'Product Designer',
      company: 'Studio X',
    });
    await mockCommonAuxiliaryRoutes(page);

    let historyPage1Calls = 0;
    let historyPage2Calls = 0;
    let page2Content = '第二頁初始回饋內容';
    let page2Rating = 8;

    const makeHistoryItem = (
      id: number,
      mentorName: string,
      dtstart: number,
      rating: number,
      content: string
    ) => ({
      id,
      sender: {
        user_id: Number(MENTEE_ID),
        role: 'MENTEE',
        status: 'ACCEPT',
        name: 'Test Mentee',
        avatar: '',
        job_title: 'Product Designer',
        years_of_experience: 'ONE_TO_THREE',
      },
      participant: {
        user_id: 200 + id,
        role: 'MENTOR',
        status: 'ACCEPT',
        name: mentorName,
        avatar: '',
        job_title: 'Staff Engineer',
        years_of_experience: 'FIVE_TO_TEN',
      },
      schedule_id: id,
      dtstart,
      dtend: dtstart + 1800,
      previous_reserve: null,
      messages: [],
      feedback: {
        meeting_happened: true,
        my_meeting_happened: true,
        rating: {
          rating,
          content,
          created_at: dtstart + 3600,
          updated_at: dtstart + 3600,
          author_name: '王＊明',
          is_public: true,
        },
        next_step: null,
      },
    });

    await page.route(
      new RegExp(`/v1/users/${MENTEE_ID}/reservations([?]|$)`),
      (route) => {
        const url = new URL(route.request().url());
        const state = url.searchParams.get('state');
        const nextDtend = url.searchParams.get('next_dtend');

        if (state !== 'MENTEE_HISTORY') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              code: '0',
              msg: 'ok',
              data: { reservations: [], next_dtend: 0 },
            }),
          });
        }

        if (!nextDtend) {
          historyPage1Calls += 1;
          const page1 = Array.from({ length: 10 }, (_, idx) =>
            makeHistoryItem(
              601 + idx,
              `第一頁導師 ${idx + 1}`,
              1761000000 - idx * 3600,
              9,
              `第一頁回饋 ${idx + 1}`
            )
          );
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              code: '0',
              msg: 'ok',
              data: { reservations: page1, next_dtend: 1760900000 },
            }),
          });
        }

        historyPage2Calls += 1;
        const page2 = [
          makeHistoryItem(
            711,
            '第二頁目標導師 Lin',
            1760890000,
            page2Rating,
            page2Content
          ),
        ];
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: { reservations: page2, next_dtend: 0 },
          }),
        });
      }
    );

    await page.route(
      new RegExp(`/v1/users/${MENTEE_ID}/reservations/711/feedback$`),
      (route) => {
        const body = route.request().postDataJSON() as {
          rating: number;
          content: string;
        };
        page2Rating = body.rating;
        page2Content = body.content;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: '0', msg: 'ok', data: {} }),
        });
      }
    );

    await page.goto('/reservation/mentee?tab=history');
    await expect(page.getByText('第一頁導師 1', { exact: true })).toBeVisible();

    const loadMoreBtn = page.getByRole('button', { name: '載入更多' });
    await expect(loadMoreBtn).toBeVisible();
    await loadMoreBtn.click();

    const page2Card = page
      .getByTestId('reservation-card')
      .filter({ hasText: '第二頁目標導師 Lin' });
    await expect(page2Card).toBeVisible();
    expect(historyPage1Calls).toBe(1);
    expect(historyPage2Calls).toBe(1);

    // Expand and edit feedback on the Page 2 item
    await page2Card.getByRole('button', { name: '查看回饋' }).click();
    await page2Card.getByRole('button', { name: '編輯' }).click();

    const editDialog = page.getByRole('dialog');
    await expect(editDialog.getByText('編輯回饋')).toBeVisible();
    const starGroup = editDialog.getByRole('radiogroup', {
      name: '整體滿意度',
    });
    await starGroup.getByRole('radio', { name: '10 分' }).click();
    await editDialog
      .getByLabel(/文字回饋/)
      .fill('第二頁編輯後仍完整保留所有已載入分頁！');
    await editDialog.getByRole('button', { name: '儲存' }).click();

    await expect(page.getByText('已儲存', { exact: true })).toBeVisible();
    await expect(page2Card.getByText('10 / 10')).toBeVisible();
    await expect(
      page2Card.getByText('第二頁編輯後仍完整保留所有已載入分頁！')
    ).toBeVisible();
    await expect(page.getByText('第一頁導師 1', { exact: true })).toBeVisible();

    // Crucial regression check: Page 1 must NOT be refetched on own feedback edit!
    expect(historyPage1Calls).toBe(1);

    await page2Card.scrollIntoViewIfNeeded();
    await captureEvidence(page, '899-history-page2-feedback-edited-retained');
  });

  test('AcceptReservationDialog 統一套用 500 字驗證，且個人檔案 QuickReplyDialog 接受預約單次刷新不重複拉取、MentorScheduleDialog 取消零網路即時還原', async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date('2026-07-15T10:00:00+08:00'));

    await seedMockAuthSession(page, {
      id: REAL_MENTOR_ID,
      name: 'Test Mentor',
      isMentor: true,
      onBoarding: true,
      jobTitle: 'Software Engineer',
      company: 'Own Company',
    });
    await mockCommonAuxiliaryRoutes(page);

    let reservationAccepted = false;
    let mentorPendingFetches = 0;
    let mentorUpcomingFetches = 0;
    let scheduleJulyFetches = 0;

    const makeRecord = (status: 'PENDING' | 'ACCEPT') => ({
      id: RESERVATION_ID,
      version: 1,
      sender: {
        user_id: 888,
        role: 'MENTEE',
        status: 'ACCEPT',
        name: 'Alice Mentee',
        avatar: '',
        job_title: 'Frontend Developer',
        years_of_experience: 'ONE_TO_THREE',
      },
      participant: {
        user_id: Number(REAL_MENTOR_ID),
        role: 'MENTOR',
        status,
        name: 'Test Mentor',
        avatar: '',
        job_title: 'Software Engineer',
        years_of_experience: 'THREE_TO_FIVE',
      },
      schedule_id: SLOT_ID,
      dtstart: SLOT_DTSTART,
      dtend: SLOT_DTEND,
      previous_reserve: null,
      messages: [
        {
          id: 1,
          user_id: 888,
          role: 'MENTEE',
          content: '想請教大型前端狀態同步架構設計',
        },
      ],
    });

    await mockApiRoute(page, new RegExp(`/v1/users/${REAL_MENTOR_ID}$`), {
      body: {
        code: '0',
        msg: 'ok',
        data: {
          user_id: Number(REAL_MENTOR_ID),
          name: 'Test Mentor',
          avatar: '',
          onboarding: true,
          is_mentor: true,
          job_title: 'Software Engineer',
          company: 'Own Company',
          years_of_experience: 'THREE_TO_FIVE',
          location: 'TWN',
          personal_statement: 'I am a mentor',
          about: 'About me',
          language: 'zh_TW',
          industry: {
            id: 1,
            subject_group: 'TECH',
            subject: '科技業',
            category: 'INDUSTRY',
            language: 'zh_TW',
          },
          want_position: [],
          want_skill: [],
          want_topic: [],
          have_skill: ['TEST_SKILL'],
          have_topic: ['TEST_TOPIC'],
          expertises: {
            professions: [
              {
                id: 1,
                subject_group: 'DATA',
                subject: '資料分析',
                category: 'EXPERTISE',
                language: 'zh_TW',
              },
            ],
            language: 'zh_TW',
          },
          experiences: [],
        },
      },
    });

    await page.route(
      new RegExp(`/v1/mentors/${REAL_MENTOR_ID}/schedule/y/2026/m/7`),
      (route) => {
        scheduleJulyFetches += 1;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: {
              segments: [
                {
                  id: SLOT_ID,
                  user_id: Number(REAL_MENTOR_ID),
                  dt_type: 'ALLOW',
                  dt_year: 2026,
                  dt_month: 7,
                  dtstart: SLOT_DTSTART,
                  dtend: SLOT_DTEND,
                  timezone: 'UTC',
                },
                {
                  id: -RESERVATION_ID,
                  user_id: Number(REAL_MENTOR_ID),
                  dt_type: reservationAccepted ? 'BOOKED' : 'PENDING',
                  dt_year: 2026,
                  dt_month: 7,
                  dtstart: SLOT_DTSTART,
                  dtend: SLOT_DTEND,
                  timezone: 'UTC',
                },
                {
                  id: ALLOW_SLOT_ID,
                  user_id: Number(REAL_MENTOR_ID),
                  dt_type: 'ALLOW',
                  dt_year: 2026,
                  dt_month: 7,
                  dtstart: ALLOW_DTSTART,
                  dtend: ALLOW_DTEND,
                  timezone: 'UTC',
                },
              ],
            },
          }),
        });
      }
    );

    await mockApiRoute(
      page,
      new RegExp(`/v1/mentors/${REAL_MENTOR_ID}/schedule/y/2026/m/8`),
      { body: { code: '0', msg: 'ok', data: { segments: [] } } }
    );

    await page.route(
      new RegExp(`/v1/users/${REAL_MENTOR_ID}/reservations([?]|$)`),
      (route) => {
        const state = new URL(route.request().url()).searchParams.get('state');
        if (state === 'MENTOR_PENDING') {
          mentorPendingFetches += 1;
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              code: '0',
              msg: 'ok',
              data: {
                reservations: reservationAccepted
                  ? []
                  : [makeRecord('PENDING')],
                next_dtend: 0,
              },
            }),
          });
        }
        if (state === 'MENTOR_UPCOMING') {
          mentorUpcomingFetches += 1;
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              code: '0',
              msg: 'ok',
              data: {
                reservations: reservationAccepted ? [makeRecord('ACCEPT')] : [],
                next_dtend: 0,
              },
            }),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: { reservations: [], next_dtend: 0 },
          }),
        });
      }
    );

    await page.route(
      new RegExp(
        `/v1/users/${REAL_MENTOR_ID}/reservations/${RESERVATION_ID}([?]|$)`
      ),
      (route) => {
        if (route.request().method() === 'PUT') {
          reservationAccepted = true;
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              code: '0',
              msg: 'ok',
              data: makeRecord('ACCEPT'),
            }),
          });
        }
        return route.continue();
      }
    );

    // 1. Verify unified >500-char validation in AcceptReservationDialog on /reservation/mentor
    await page.goto('/reservation/mentor?tab=pending');
    const acceptTrigger = page.getByRole('button', { name: '接受' }).first();
    await expect(acceptTrigger).toBeVisible({ timeout: 15_000 });
    await acceptTrigger.click();

    const acceptDialog = page.getByRole('dialog', { name: '接受學員預約' });
    await expect(acceptDialog).toBeVisible();
    await acceptDialog.getByText('附上回覆訊息（選填）').click();
    await acceptDialog.locator('textarea').fill('A'.repeat(501));
    await expect(
      acceptDialog.getByText('回覆訊息請勿超過 500 字')
    ).toBeVisible();
    await expect(
      acceptDialog.getByRole('button', { name: '接受' })
    ).toBeDisabled();

    await captureEvidence(
      page,
      '899-accept-reservation-dialog-reply-max-length-validation',
      { waitForSelector: '[role="dialog"]' }
    );

    await acceptDialog.getByRole('button', { name: '取消' }).click();
    await expect(acceptDialog).toBeHidden();

    // 2. Navigate to Mentor's own profile calendar: verify QuickReplyDialog single-fetch sync + MentorScheduleDialog zero-network discard
    await page.goto(`/profile/${REAL_MENTOR_ID}`);
    const dayBtn = page.getByTestId('day-2026-07-17');
    await expect(dayBtn).toBeVisible({ timeout: 15_000 });
    await dayBtn.click();

    const pendingRow = page
      .locator('[role="button"]')
      .filter({ hasText: '審核中' });
    await expect(pendingRow).toBeVisible();

    const pendingBeforeAccept = mentorPendingFetches;
    const upcomingBeforeAccept = mentorUpcomingFetches;
    const scheduleBeforeAccept = scheduleJulyFetches;

    await pendingRow.click();
    const quickReplyDialog = page.getByRole('dialog', {
      name: '待您回復的預約申請',
    });
    await expect(quickReplyDialog).toBeVisible();
    await quickReplyDialog.getByText('附上回覆訊息（選填）').click();
    await quickReplyDialog.locator('textarea').fill('期待見面交流！');
    await quickReplyDialog.getByRole('button', { name: '接受' }).click();

    await expect(quickReplyDialog).toBeHidden({ timeout: 10_000 });
    await expect(
      page.locator('[role="button"]').filter({ hasText: '學員 Alice Mentee' })
    ).toBeVisible();

    // Exactly ONE refresh per subscribed slice (no duplicate reservation fetch from schedule.reload!)
    expect(mentorPendingFetches - pendingBeforeAccept).toBe(1);
    expect(mentorUpcomingFetches - upcomingBeforeAccept).toBe(1);
    expect(scheduleJulyFetches - scheduleBeforeAccept).toBe(1);

    await captureEvidence(
      page,
      '899-mentor-calendar-synced-after-quick-reply-accept'
    );

    // 3. Open MentorScheduleDialog, edit 14:00-14:30 -> 45m, then click 取消 -> 0 extra schedule GETs & restored slot
    await page.getByRole('button', { name: '預約設定' }).click();
    const scheduleDialog = page.getByRole('dialog', { name: '設定可預約時段' });
    await expect(scheduleDialog).toBeVisible();
    await scheduleDialog.getByTestId('day-2026-07-17').click();
    await expect(scheduleDialog.getByText('14:00 – 14:30')).toBeVisible();

    const scheduleFetchesBeforeDraftDiscard = scheduleJulyFetches;

    await scheduleDialog
      .locator('[role="button"]')
      .filter({ hasText: '14:00 – 14:30' })
      .click();
    const editSlotModal = page.getByRole('dialog', { name: '編輯時段' });
    await expect(editSlotModal).toBeVisible();
    await editSlotModal.getByRole('button', { name: '45 分' }).click();
    await editSlotModal.getByRole('button', { name: '完成' }).click();
    await expect(scheduleDialog.getByText('14:00 – 14:45')).toBeVisible();

    await scheduleDialog.getByRole('button', { name: '取消' }).click();
    await expect(scheduleDialog).toBeHidden();

    // Reopen MentorScheduleDialog: saved 14:00 – 14:30 is restored immediately with ZERO extra schedule HTTP calls!
    await page.getByRole('button', { name: '預約設定' }).click();
    await expect(scheduleDialog).toBeVisible();
    await scheduleDialog.getByTestId('day-2026-07-17').click();
    await expect(scheduleDialog.getByText('14:00 – 14:30')).toBeVisible();
    expect(scheduleJulyFetches).toBe(scheduleFetchesBeforeDraftDiscard);

    await captureEvidence(
      page,
      '899-mentor-schedule-instant-discard-restored',
      { waitForSelector: '[role="dialog"]' }
    );
  });
});
