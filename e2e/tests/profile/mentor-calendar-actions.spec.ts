import { expect, Page, test } from '@playwright/test';

import { mockApiRoute } from '../../helpers/route';
import { seedMockAuthSession } from '../../helpers/session';

test.use({ timezoneId: 'Asia/Taipei' });

const REAL_MENTOR_ID = '7482008160728084';
const MENTEE_ID = 888;
const SLOT_ID = 101;
const RESERVATION_ID = 501;
// 2026-07-17 10:00:00 ~ 10:30:00 Asia/Taipei
const SLOT_DTSTART = 1784253600;
const SLOT_DTEND = 1784255400;

async function setupMentorSession(page: Page): Promise<void> {
  await seedMockAuthSession(page, {
    id: REAL_MENTOR_ID,
    name: 'Test Mentor',
    isMentor: true,
    onBoarding: true,
    jobTitle: 'Software Engineer',
    company: 'Own Company',
  });
}

function makeMentorProfile() {
  return {
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
      years_of_experience: 'BELOW_ONE_YEAR',
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
      experiences: [
        {
          id: 1,
          category: 'WORK',
          order: 1,
          mentor_experiences_metadata: {
            data: [
              {
                job: '工程師',
                company: '測試公司',
                job_period_start: '2020',
                job_period_end: '2023',
                industry: 'TECH',
                job_location: 'TWN',
                description: '工作內容',
              },
            ],
          },
        },
      ],
    },
  };
}

function makeScheduleSegments(virtualStatus: 'PENDING' | 'BOOKED') {
  return {
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
          dt_type: virtualStatus,
          dt_year: 2026,
          dt_month: 7,
          dtstart: SLOT_DTSTART,
          dtend: SLOT_DTEND,
          timezone: 'UTC',
        },
      ],
    },
  };
}

function makeReservationRecord(status: 'PENDING' | 'ACCEPT') {
  return {
    id: RESERVATION_ID,
    sender: {
      user_id: MENTEE_ID,
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
        user_id: MENTEE_ID,
        role: 'MENTEE',
        content: '想請教職涯轉換與履歷準備方向',
      },
    ],
  };
}

test.describe('導師個人頁日曆直接操作預約與鎖定時段攔截 (#788)', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-07-15T10:00:00+08:00'));
    await setupMentorSession(page);

    await mockApiRoute(
      page,
      new RegExp(`/v1/(?:mentors|users)/${REAL_MENTOR_ID}/zh_TW/profile`),
      { body: makeMentorProfile() }
    );
    await mockApiRoute(page, /\/v1\/users\/zh_TW\/tags\/catalog/, {
      body: {
        code: '0',
        msg: 'ok',
        data: {
          catalogs: {
            skill: { groups: [] },
            topic: { groups: [] },
            position: { groups: [] },
            industry: { groups: [] },
          },
        },
      },
    });
  });

  test('導師點擊日曆 PENDING 時段 → 開啟 QuickReplyDialog 並完成接受預約', async ({
    page,
  }) => {
    await mockApiRoute(
      page,
      new RegExp(`/v1/mentors/${REAL_MENTOR_ID}/schedule/y/2026/m/7`),
      { body: makeScheduleSegments('PENDING') }
    );

    await page.route(
      new RegExp(`/v1/users/${REAL_MENTOR_ID}/reservations(\\?|$)`),
      (route) => {
        const state = new URL(route.request().url()).searchParams.get('state');
        const list =
          state === 'MENTOR_PENDING' ? [makeReservationRecord('PENDING')] : [];
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: { reservations: list, next_dtend: 0 },
          }),
        });
      }
    );

    let putPayload: {
      my_status?: string;
      messages?: { content: string }[];
    } | null = null;
    await page.route(
      new RegExp(`/v1/users/${REAL_MENTOR_ID}/reservations/${RESERVATION_ID}$`),
      async (route) => {
        if (route.request().method() === 'PUT') {
          putPayload = await route.request().postDataJSON();
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              code: '0',
              msg: 'ok',
              data: { id: RESERVATION_ID, status: 'ACCEPT' },
            }),
          });
        }
        return route.fallback();
      }
    );

    await page.goto(`/profile/${REAL_MENTOR_ID}`);
    await page.getByTestId('day-2026-07-17').click();

    const bookedSlotBtn = page.getByRole('button', {
      name: /查看 .* Alice Mentee 預約詳情/,
    });
    await expect(bookedSlotBtn).toBeVisible({ timeout: 15_000 });
    await bookedSlotBtn.click();

    const quickReplyDialog = page.getByRole('dialog', {
      name: '待您回復的預約申請',
    });
    await expect(quickReplyDialog).toBeVisible();
    await expect(quickReplyDialog.getByText('Alice Mentee')).toBeVisible();

    await quickReplyDialog.getByRole('button', { name: '接受' }).click();
    await expect(quickReplyDialog).not.toBeVisible({ timeout: 10_000 });

    expect(putPayload).not.toBeNull();
    expect(putPayload!.my_status).toBe('ACCEPT');
  });

  test('導師點擊日曆 BOOKED 時段 → 開啟 ConfirmedReservationDialog 並可加入 Google Meet 或取消預約', async ({
    page,
  }) => {
    await mockApiRoute(
      page,
      new RegExp(`/v1/mentors/${REAL_MENTOR_ID}/schedule/y/2026/m/7`),
      { body: makeScheduleSegments('BOOKED') }
    );

    await page.route(
      new RegExp(`/v1/users/${REAL_MENTOR_ID}/reservations(\\?|$)`),
      (route) => {
        const state = new URL(route.request().url()).searchParams.get('state');
        const list =
          state === 'MENTOR_UPCOMING' ? [makeReservationRecord('ACCEPT')] : [];
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: { reservations: list, next_dtend: 0 },
          }),
        });
      }
    );

    await mockApiRoute(
      page,
      new RegExp(
        `/v1/users/${REAL_MENTOR_ID}/reservations/${RESERVATION_ID}/google-meet`
      ),
      {
        status: 404,
        body: { code: '404', msg: 'Meeting not ready', data: null },
      }
    );

    let cancelPutCalled = false;
    await page.route(
      new RegExp(`/v1/users/${REAL_MENTOR_ID}/reservations/${RESERVATION_ID}$`),
      (route) => {
        if (route.request().method() === 'PUT') {
          cancelPutCalled = true;
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              code: '0',
              msg: 'ok',
              data: { id: RESERVATION_ID, status: 'REJECT' },
            }),
          });
        }
        return route.fallback();
      }
    );

    await page.goto(`/profile/${REAL_MENTOR_ID}`);
    await page.getByTestId('day-2026-07-17').click();

    const bookedSlotBtn = page.getByRole('button', {
      name: /查看 .* Alice Mentee 預約詳情/,
    });
    await expect(bookedSlotBtn).toBeVisible({ timeout: 15_000 });
    await bookedSlotBtn.click();

    const confirmedDialog = page.getByRole('dialog', {
      name: '已確認預約詳情',
    });
    await expect(confirmedDialog).toBeVisible();

    // 1. Click JoinMeetButton when meeting is not ready (404) -> shows informative toast
    await confirmedDialog
      .getByRole('button', { name: '加入 Google Meet' })
      .click();
    await expect(
      page.getByText('連結尚未就緒或不存在（會議狀態需為已排程）。', {
        exact: true,
      })
    ).toBeVisible();

    // 2. Click 取消預約 -> fill reason -> confirm
    await confirmedDialog.getByRole('button', { name: '取消預約' }).click();
    const cancelModal = page.getByRole('dialog', { name: /取消預約/ });
    await expect(cancelModal).toBeVisible();
    await cancelModal.locator('textarea').fill('臨時有會議需改期');
    await cancelModal.getByRole('button', { name: '取消預約' }).click();

    await expect(confirmedDialog).not.toBeVisible({ timeout: 10_000 });
    expect(cancelPutCalled).toBe(true);
  });

  test('MentorScheduleDialog 刪除已有預約或後端鎖定的時段時顯示攔截提示', async ({
    page,
  }) => {
    await mockApiRoute(
      page,
      new RegExp(`/v1/mentors/${REAL_MENTOR_ID}/schedule/y/2026/m/7`),
      {
        body: {
          code: '0',
          msg: 'ok',
          data: {
            segments: [
              // Slot 1: has an active BOOKED virtual segment -> blocked in UI immediately
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
                dt_type: 'BOOKED',
                dt_year: 2026,
                dt_month: 7,
                dtstart: SLOT_DTSTART,
                dtend: SLOT_DTEND,
                timezone: 'UTC',
              },
              // Slot 2: had a historical cancelled reservation -> backend DELETE returns AvailabilityLockedError
              {
                id: 102,
                user_id: Number(REAL_MENTOR_ID),
                dt_type: 'ALLOW',
                dt_year: 2026,
                dt_month: 7,
                dtstart: 1784268000, // 2026-07-17 14:00
                dtend: 1784269800, // 2026-07-17 14:30
                timezone: 'UTC',
              },
            ],
          },
        },
      }
    );

    await mockApiRoute(
      page,
      new RegExp(`/v1/users/${REAL_MENTOR_ID}/reservations(\\?|$)`),
      {
        body: {
          code: '0',
          msg: 'ok',
          data: {
            reservations: [makeReservationRecord('ACCEPT')],
            next_dtend: 0,
          },
        },
      }
    );

    await page.route(
      new RegExp(`/v1/mentors/${REAL_MENTOR_ID}/schedule/102`),
      (route) => {
        if (route.request().method() === 'DELETE') {
          return route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({
              code: '409',
              msg: 'Schedule with reservations cannot be deleted',
            }),
          });
        }
        return route.fallback();
      }
    );

    await page.goto(`/profile/${REAL_MENTOR_ID}`);
    await page.getByRole('button', { name: '預約設定' }).click();

    const scheduleDialog = page.getByRole('dialog', { name: '設定可預約時段' });
    await expect(scheduleDialog).toBeVisible();
    await scheduleDialog.getByTestId('day-2026-07-17').click();

    // 1. Clicking X on the actively booked 10:00 – 10:30 slot opens the lock prompt dialog
    const bookedSlotRow = scheduleDialog
      .locator('[role="button"]')
      .filter({ hasText: '10:00 – 10:30' });
    await bookedSlotRow.locator('button:has(svg.lucide-x)').click();

    const promptDialog = page.getByRole('dialog', {
      name: /已預約此時段|此時段已有預約/,
    });
    await expect(promptDialog).toBeVisible();
    await promptDialog.getByRole('button', { name: '取消' }).click();
    await expect(promptDialog).not.toBeVisible();

    // 2. Deleting the 14:00 – 14:30 slot (locked by backend history) and saving shows error toast and keeps dialog open
    const historyLockedSlotRow = scheduleDialog
      .locator('[role="button"]')
      .filter({ hasText: '14:00 – 14:30' });
    await historyLockedSlotRow.locator('button:has(svg.lucide-x)').click();
    await scheduleDialog.getByRole('button', { name: '儲存' }).click();

    await expect(
      page.getByText('儲存失敗,請稍後再試', { exact: true })
    ).toBeVisible({
      timeout: 10_000,
    });
    await expect(scheduleDialog).toBeVisible();
  });
});
