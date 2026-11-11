import { expect, type Page, test } from '@playwright/test';

import { captureEvidence } from '../../helpers/evidence';
import { mockApiRoute } from '../../helpers/route';
import { setSignedSessionCookie } from '../../helpers/session';

test.use({ timezoneId: 'Asia/Taipei' });

const REAL_MENTOR_ID = '7482008160728084';
// 2026-11-17 19:00 ~ 21:30 Asia/Taipei
const SLOT_1_START = 1794913200;
const SLOT_1_END = 1794915000;
const SLOT_2_START = 1794916800;
const SLOT_2_END = 1794918600;

function makeMentorProfilePayload(withRatings: boolean) {
  return {
    code: '0',
    msg: 'ok',
    data: {
      user_id: Number(REAL_MENTOR_ID),
      name: 'Zahra Mirzakhani',
      avatar: '',
      onboarding: true,
      is_mentor: true,
      job_title: 'Senior UX Designer',
      company: 'CreativeUX Design Studio',
      years_of_experience: 'FIVE_TO_TEN',
      location: 'TWN',
      personal_statement:
        '歡迎帶著作品集或職涯問題來交流，我們可以一起拆解可落地的下一步。',
      about:
        '累積超過七年的數位產品設計經驗，喜歡從使用者研究出發，和跨職能夥伴一起將複雜問題轉化為清楚實用的產品體驗。',
      language: 'zh_TW',
      stats: {
        completed_meeting_count: 128,
        total_rating_count: withRatings ? 12 : 0,
        rating_average: withRatings ? 8.5 : null,
      },
      industry: {
        id: 1,
        subject_group: 'SOFTWARE',
        subject: '軟體及網路相關業',
        category: 'INDUSTRY',
        language: 'zh_TW',
      },
      want_position: [],
      want_skill: [],
      want_topic: [],
      have_skill: ['UX_RESEARCH', 'DESIGN_SYSTEM'],
      have_topic: ['PORTFOLIO_REVIEW', 'CAREER_COACHING'],
      experiences: [
        {
          id: 1,
          category: 'WORK',
          order: 1,
          mentor_experiences_metadata: {
            data: [
              {
                job: 'Senior UX Designer',
                company: 'CreativeUX Design Studio',
                job_period_start: '2022',
                job_period_end: '至今',
                industry: 'DESIGN',
                job_location: 'TWN',
                description: '主導跨產品設計系統與使用者研究流程。',
                is_primary: true,
              },
            ],
          },
        },
      ],
    },
  };
}

const ALL_REVIEWS = [
  {
    id: 1,
    author_name: '陳**',
    rating: 9,
    content: '分享了很具體的建議，也幫助我釐清下一步的方向。',
    created_at: '2026-10-28T10:00:00+08:00',
  },
  {
    id: 2,
    author_name: '林**',
    rating: 8,
    content: '從作品集的架構到研究故事，都給了我可以實際執行的修改方向。',
    created_at: '2026-10-27T10:00:00+08:00',
  },
  {
    id: 3,
    author_name: '王**',
    rating: 9,
    content: '很有耐心地回答問題，會談前也有先了解我的需求。',
    created_at: '2026-10-26T10:00:00+08:00',
  },
  {
    id: 4,
    author_name: '張**',
    rating: 10,
    content: '模擬面試的追問非常精準，讓我發現原本沒注意到的盲點。',
    created_at: '2026-10-25T10:00:00+08:00',
  },
  {
    id: 5,
    author_name: '李**',
    rating: 8,
    content: '提供了清晰的轉職準備時程規劃。',
    created_at: '2026-10-24T10:00:00+08:00',
  },
  {
    id: 6,
    author_name: '黃**',
    rating: 9,
    content: '針對 B2B 產品案例的敘事結構給了很棒的回饋。',
    created_at: '2026-10-23T10:00:00+08:00',
  },
  {
    id: 7,
    author_name: '周**',
    rating: 7,
    content: '幫忙梳理了履歷上的量化成果呈現方式。',
    created_at: '2026-10-22T10:00:00+08:00',
  },
  {
    id: 8,
    author_name: '徐**',
    rating: 9,
    content: '跨部門溝通案例分享非常受用。',
    created_at: '2026-10-21T10:00:00+08:00',
  },
  {
    id: 9,
    author_name: '孫**',
    rating: 8,
    content: '會談節奏掌握得很好，收穫豐富。',
    created_at: '2026-10-20T10:00:00+08:00',
  },
  {
    id: 10,
    author_name: '馬**',
    rating: 9,
    content: '對設計系統職涯發展有了更清楚的認識。',
    created_at: '2026-10-19T10:00:00+08:00',
  },
  {
    id: 11,
    author_name: '吳**',
    rating: 8,
    content: '第二頁評價：針對海外求職準備給了很實用的建議。',
    created_at: '2026-10-18T10:00:00+08:00',
  },
  {
    id: 12,
    author_name: '鄭**',
    rating: 8,
    content: '第二頁評價：很感謝導師耐心傾聽與回饋。',
    created_at: '2026-10-17T10:00:00+08:00',
  },
];

async function setupBaseMentorMocks(
  page: Page,
  options: { withRatings: boolean }
) {
  await page.clock.setFixedTime(new Date('2026-11-11T10:00:00+08:00'));

  await setSignedSessionCookie(page, {
    id: '9001',
    name: 'Mentee Viewer',
    isMentor: false,
    onBoarding: true,
    token: 'mock-mentee-token',
  });

  await page.route(/\/api\/auth\/session/, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: '9001',
            name: 'Mentee Viewer',
            isMentor: false,
            onBoarding: true,
          },
          accessToken: 'mock-mentee-token',
          expires: '2099-01-01T00:00:00.000Z',
        }),
      });
    }
    return route.continue();
  });

  await mockApiRoute(
    page,
    new RegExp(`/v1/(?:mentors|users)/${REAL_MENTOR_ID}/zh_TW/profile`),
    { body: makeMentorProfilePayload(options.withRatings) }
  );

  await mockApiRoute(page, /\/v1\/users\/zh_TW\/tags\/catalog/, {
    body: {
      code: '0',
      msg: 'ok',
      data: {
        catalogs: {
          skill: {
            groups: [
              { subject_group: 'UX_RESEARCH', subject: '使用者研究' },
              { subject_group: 'DESIGN_SYSTEM', subject: '設計系統' },
            ],
          },
          topic: {
            groups: [
              { subject_group: 'PORTFOLIO_REVIEW', subject: '作品集健檢' },
              { subject_group: 'CAREER_COACHING', subject: '職涯規劃' },
            ],
          },
          position: { groups: [] },
          industry: {
            groups: [
              { subject_group: 'SOFTWARE', subject: '軟體及網路相關業' },
              { subject_group: 'DESIGN', subject: '設計及創意相關業' },
            ],
          },
        },
      },
    },
  });

  await mockApiRoute(
    page,
    new RegExp(`/v1/mentors/${REAL_MENTOR_ID}/schedule/y/\\d+/m/\\d+`),
    {
      body: {
        code: '0',
        msg: 'ok',
        data: {
          segments: [
            {
              id: 301,
              user_id: Number(REAL_MENTOR_ID),
              dt_type: 'ALLOW',
              dt_year: 2026,
              dt_month: 11,
              dtstart: SLOT_1_START,
              dtend: SLOT_1_END,
              timezone: 'UTC',
            },
            {
              id: 302,
              user_id: Number(REAL_MENTOR_ID),
              dt_type: 'ALLOW',
              dt_year: 2026,
              dt_month: 11,
              dtstart: SLOT_2_START,
              dtend: SLOT_2_END,
              timezone: 'UTC',
            },
          ],
        },
      },
    }
  );

  await page.route(
    new RegExp(`/v1/mentors/${REAL_MENTOR_ID}/feedback(\\?|$)`),
    (route) => {
      if (!options.withRatings) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: {
              total_rating_count: 0,
              completed_meeting_count: 128,
              rating_average: null,
              page: 1,
              page_size: 10,
              feedbacks: [],
            },
          }),
        });
      }

      const url = new URL(route.request().url());
      const pageNum = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
      const sortBy = url.searchParams.get('sort_by') ?? 'newest';
      const sorted = [...ALL_REVIEWS];

      if (sortBy === 'rating_desc') {
        sorted.sort((a, b) => b.rating - a.rating);
      } else if (sortBy === 'rating_asc') {
        sorted.sort((a, b) => a.rating - b.rating);
      }

      const start = (pageNum - 1) * 10;
      const pageSlice = sorted.slice(start, start + 10);

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: '0',
          msg: 'ok',
          data: {
            total_rating_count: ALL_REVIEWS.length,
            completed_meeting_count: 128,
            rating_average: 8.5,
            page: pageNum,
            page_size: 10,
            feedbacks: pageSlice,
          },
        }),
      });
    }
  );
}

test.describe('導師個人頁評價區塊與 RWD 排版 (#736)', () => {
  test('有評價狀態：滿寬 4 格摘要列、雙欄頂部水平對齊、切換評價 Tab、分頁與排序、Desktop / Tablet / Mobile RWD', async ({
    page,
  }) => {
    await setupBaseMentorMocks(page, { withRatings: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/profile/${REAL_MENTOR_ID}`);

    const summaryBar = page.getByRole('region', { name: '導師摘要資訊' });
    await expect(summaryBar).toBeVisible();
    await expect(summaryBar.getByText('評分', { exact: true })).toBeVisible();
    await expect(summaryBar.getByText('8.5', { exact: true })).toBeVisible();
    await expect(summaryBar.getByText('/ 10', { exact: true })).toBeVisible();
    await expect(
      summaryBar.getByText('已完成 1-on-1', { exact: true })
    ).toBeVisible();
    await expect(summaryBar.getByText('128', { exact: true })).toBeVisible();
    await expect(summaryBar.getByText('經驗', { exact: true })).toBeVisible();
    await expect(summaryBar.getByText('地點', { exact: true })).toBeVisible();
    await expect(summaryBar.getByText('產業', { exact: true })).toBeVisible();

    // 驗證預設「簡介」分頁渲染完成，且不重複堆疊經驗／地點／產業標題
    const aboutPanel = page.getByRole('tabpanel', { name: '簡介' });
    await expect(aboutPanel).toBeVisible();
    await expect(aboutPanel.getByText('關於我', { exact: true })).toBeVisible();
    await expect(aboutPanel.getByText('經驗', { exact: true })).toHaveCount(0);
    await expect(aboutPanel.getByText('地點', { exact: true })).toHaveCount(0);
    await expect(aboutPanel.getByText('產業', { exact: true })).toHaveCount(0);

    // 驗證左欄「簡介｜評價 12」Tabs 頂端與右欄「可預約日期」卡片頂端水平齊平
    const tabList = page.getByRole('tablist', { name: '導師頁面分頁' });
    const rightScheduleCard = page
      .locator('main .xl\\:w-2\\/5 .rounded-2xl')
      .first();
    await expect(tabList).toBeVisible();
    await expect(rightScheduleCard).toBeVisible();
    await expect(page.getByRole('button', { name: /07:00 PM/ })).toBeVisible();

    const tabListBox = await tabList.boundingBox();
    const rightCardBox = await rightScheduleCard.boundingBox();
    expect(tabListBox).not.toBeNull();
    expect(rightCardBox).not.toBeNull();
    expect(Math.abs(tabListBox!.y - rightCardBox!.y)).toBeLessThan(6);

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await captureEvidence(page, 'mentor-profile-about-tab-desktop');

    // 點擊切換至「評價 12」Tab，確認評價總分卡、遮罩姓氏首字卡片與分頁器渲染且右欄行事曆固定不動
    const feedbackTab = page.getByRole('tab', { name: /評價\s*12/ });
    await feedbackTab.click();

    const feedbackSection = page.getByTestId('mentor-feedback-section');
    await expect(feedbackSection).toBeVisible();
    await expect(
      feedbackSection.getByText('8.5', { exact: true })
    ).toBeVisible();
    await expect(
      feedbackSection.getByText('12 則會談評價', { exact: true })
    ).toBeVisible();
    await expect(
      feedbackSection.getByText('陳**', { exact: true })
    ).toBeVisible();
    await expect(
      feedbackSection.getByText(
        '分享了很具體的建議，也幫助我釐清下一步的方向。'
      )
    ).toBeVisible();
    await expect(
      feedbackSection.getByRole('navigation', { name: '評價分頁' })
    ).toBeVisible();
    await expect(rightScheduleCard).toBeVisible();

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await captureEvidence(page, 'mentor-profile-feedback-tab-desktop', {
      fullPage: true,
    });

    // 分頁互動：點擊第 2 頁顯示第 11~12 筆評價
    const page2Btn = page.getByRole('button', { name: '第 2 頁' });
    await expect(page2Btn).toBeVisible();
    await page2Btn.click();
    await expect(
      feedbackSection.getByText('吳**', { exact: true })
    ).toBeVisible();
    await expect(
      feedbackSection.getByText(
        '第二頁評價：針對海外求職準備給了很實用的建議。'
      )
    ).toBeVisible();

    // 排序互動：切換為「評分由高到低」自動回到第 1 頁並以最高分排序
    await page.getByRole('combobox', { name: '評價排序' }).click();
    await page.getByRole('option', { name: '評分由高到低' }).click();
    const firstReviewItem = feedbackSection.locator('ul > li').first();
    await expect(firstReviewItem).toContainText('張**');
    await expect(firstReviewItem).toContainText('10 / 10');

    // Tablet (768x1024) RWD 驗證：單欄排列且行事曆移至下方
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(summaryBar).toBeVisible();
    await expect(feedbackSection).toBeVisible();
    await expect(rightScheduleCard).toBeVisible();

    const tabletFeedbackBox = await feedbackSection.boundingBox();
    const tabletCalendarBox = await rightScheduleCard.boundingBox();
    expect(tabletFeedbackBox).not.toBeNull();
    expect(tabletCalendarBox).not.toBeNull();
    expect(tabletCalendarBox!.y).toBeGreaterThanOrEqual(
      tabletFeedbackBox!.y + tabletFeedbackBox!.height
    );

    // Mobile (375x812) RWD 驗證與全頁截圖：確認頂部姓名職稱區與摘要列不重疊、評價單欄、行事曆移至下方
    await page.setViewportSize({ width: 375, height: 812 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await expect(summaryBar).toBeVisible();
    await expect(feedbackSection).toBeVisible();
    await expect(rightScheduleCard).toBeVisible();
    await expect(
      feedbackSection.getByText('12 則會談評價', { exact: true })
    ).toBeVisible();

    const profileHeaderBlock = summaryBar.locator(
      'xpath=preceding-sibling::div[1]'
    );
    const mobileHeaderBox = await profileHeaderBlock.boundingBox();
    const mobileSummaryBox = await summaryBar.boundingBox();
    const mobileFirstReviewBox = await feedbackSection
      .locator('ul > li')
      .nth(0)
      .boundingBox();
    const mobileSecondReviewBox = await feedbackSection
      .locator('ul > li')
      .nth(1)
      .boundingBox();
    const mobileFeedbackBox = await feedbackSection.boundingBox();
    const mobileCalendarBox = await rightScheduleCard.boundingBox();

    expect(mobileHeaderBox).not.toBeNull();
    expect(mobileSummaryBox).not.toBeNull();
    expect(mobileFirstReviewBox).not.toBeNull();
    expect(mobileSecondReviewBox).not.toBeNull();
    expect(mobileFeedbackBox).not.toBeNull();
    expect(mobileCalendarBox).not.toBeNull();

    // 頂部姓名職稱區塊與下方摘要列不重疊
    expect(mobileSummaryBox!.y).toBeGreaterThanOrEqual(
      mobileHeaderBox!.y + mobileHeaderBox!.height
    );
    // 評價卡片維持單欄垂直堆疊
    expect(
      Math.abs(mobileFirstReviewBox!.x - mobileSecondReviewBox!.x)
    ).toBeLessThanOrEqual(2);
    expect(mobileSecondReviewBox!.y).toBeGreaterThanOrEqual(
      mobileFirstReviewBox!.y + mobileFirstReviewBox!.height - 1
    );
    // 預約行事曆移至評價區塊下方
    expect(mobileCalendarBox!.y).toBeGreaterThanOrEqual(
      mobileFeedbackBox!.y + mobileFeedbackBox!.height
    );

    await captureEvidence(page, 'mentor-profile-feedback-tab-mobile', {
      fullPage: true,
    });
  });

  test('尚無評價狀態：頂部摘要列隱藏評分並滿寬 3 格均分，切換至「評價 0」顯示空狀態', async ({
    page,
  }) => {
    await setupBaseMentorMocks(page, { withRatings: false });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/profile/${REAL_MENTOR_ID}`);

    const summaryBar = page.getByRole('region', { name: '導師摘要資訊' });
    await expect(summaryBar).toBeVisible();
    await expect(
      summaryBar.getByText('已完成 1-on-1', { exact: true })
    ).toBeVisible();
    await expect(summaryBar.getByText('經驗', { exact: true })).toBeVisible();
    await expect(summaryBar.getByText('地點', { exact: true })).toBeVisible();
    await expect(summaryBar.getByText('產業', { exact: true })).toBeVisible();
    await expect(summaryBar.getByText('評分', { exact: true })).toHaveCount(0);

    const rightScheduleCard = page
      .locator('main .xl\\:w-2\\/5 .rounded-2xl')
      .first();
    await expect(rightScheduleCard).toBeVisible();

    const feedbackZeroTab = page.getByRole('tab', { name: /評價\s*0/ });
    await expect(feedbackZeroTab).toBeVisible();
    await feedbackZeroTab.click();

    const emptyState = page.getByTestId('mentor-feedback-empty');
    await expect(emptyState).toBeVisible();
    await expect(
      emptyState.getByText('目前還沒有評價', { exact: true })
    ).toBeVisible();
    await expect(
      emptyState.getByText('完成會談後，學員的評價會顯示在這裡。', {
        exact: true,
      })
    ).toBeVisible();

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await captureEvidence(page, 'mentor-profile-feedback-empty-desktop');
  });
});
