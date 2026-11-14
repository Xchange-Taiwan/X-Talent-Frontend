import { expect, type Page, test } from '@playwright/test';

import { captureEvidence } from '../../helpers/evidence';
import { mockApiRoute } from '../../helpers/route';
import { seedMockAuthSession } from '../../helpers/session';

test.use({ timezoneId: 'Asia/Taipei' });

const REAL_MENTOR_ID = '7482008160728084';
// 2026-11-17 19:00 ~ 21:30 Asia/Taipei
const SLOT_1_START = 1794913200;
const SLOT_1_END = 1794915000;
const SLOT_2_START = 1794916800;
const SLOT_2_END = 1794918600;

const SCHEDULE_ROUTE_RE = new RegExp(
  String.raw`/v1/mentors/${REAL_MENTOR_ID}/schedule/y/\d+/m/\d+`
);
const FEEDBACK_ROUTE_RE = new RegExp(
  String.raw`/v1/mentors/${REAL_MENTOR_ID}/feedback(\?|$)`
);
const RIGHT_SCHEDULE_CARD_SELECTOR = String.raw`main .xl\:w-2\/5 .rounded-2xl`;

interface MentorMockOptions {
  isMentor?: boolean;
  ratingCount?: number;
  ratingAverage?: number | null;
  completedMeetingCount?: number;
  feedbackMode?: 'ok' | 'not-found';
  clockIso?: string;
}

function makeMentorProfilePayload(options: MentorMockOptions = {}) {
  const {
    isMentor = true,
    ratingCount = 12,
    ratingAverage = ratingCount > 0 ? 8.5 : null,
    completedMeetingCount = 128,
  } = options;

  return {
    code: '0',
    msg: 'ok',
    data: {
      user_id: Number(REAL_MENTOR_ID),
      name: 'Zahra Mirzakhani',
      avatar: '',
      onboarding: true,
      is_mentor: isMentor,
      job_title: 'Senior UX Designer',
      company: 'CreativeUX Design Studio',
      years_of_experience: 'FIVE_TO_TEN',
      location: 'TWN',
      personal_statement:
        '歡迎帶著作品集或職涯問題來交流，我們可以一起拆解可落地的下一步。',
      about:
        '你好，我是 Zahra，目前在 CreativeUX Design Studio 擔任 Senior UX Designer，累積超過七年的數位產品設計經驗，喜歡從使用者研究出發，和跨職能夥伴一起將複雜問題轉化為清楚實用的產品體驗。\n\n從平面設計走向 UX 的過程中，我也曾經面對轉職的不確定與作品集整理的挑戰。如果你正在準備轉職、整理專案故事，或希望更有信心地面對面試，我很樂意陪你梳理想法，一起規劃能實際前進的下一步。',
      language: 'zh_TW',
      stats: isMentor
        ? {
            completed_meeting_count: completedMeetingCount,
            rating_count: ratingCount,
            rating_average: ratingCount > 0 ? ratingAverage : null,
          }
        : null,
      industry: {
        id: 1,
        subject_group: 'DESIGN',
        subject: '設計及創意相關業',
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
  options: MentorMockOptions = {}
) {
  const {
    isMentor = true,
    ratingCount = 12,
    ratingAverage = ratingCount > 0 ? 8.5 : null,
    completedMeetingCount = 128,
    feedbackMode = 'ok',
    clockIso = '2026-11-11T10:00:00+08:00',
  } = options;

  await page.clock.setFixedTime(new Date(clockIso));

  await seedMockAuthSession(page, {
    id: '9001',
    name: 'Mentee Viewer',
    isMentor: false,
    onBoarding: true,
    token: 'mock-mentee-token',
  });

  await mockApiRoute(
    page,
    new RegExp(`/v1/(?:mentors|users)/${REAL_MENTOR_ID}/zh_TW/profile`),
    {
      body: makeMentorProfilePayload({
        isMentor,
        ratingCount,
        ratingAverage,
        completedMeetingCount,
      }),
    }
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

  await mockApiRoute(page, SCHEDULE_ROUTE_RE, {
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
  });

  await page.route(FEEDBACK_ROUTE_RE, (route) => {
    if (feedbackMode === 'not-found') {
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          code: '404',
          msg: 'Not Found',
          data: null,
        }),
      });
    }

    if (ratingCount <= 0) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: '0',
          msg: 'ok',
          data: {
            total_rating_count: 0,
            completed_meeting_count: completedMeetingCount,
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
    const activePool = ALL_REVIEWS.slice(0, ratingCount);

    const start = (pageNum - 1) * 10;
    const pageSlice = activePool.slice(start, start + 10);

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: '0',
        msg: 'ok',
        data: {
          total_rating_count: ratingCount,
          completed_meeting_count: completedMeetingCount,
          rating_average: ratingAverage,
          page: pageNum,
          page_size: 10,
          feedbacks: pageSlice,
        },
      }),
    });
  });
}

async function assertEqualWidthSummaryColumns(
  page: Page,
  expectedCount: number
) {
  const summaryBar = page.getByRole('region', { name: '導師摘要資訊' });
  const summaryGrid = summaryBar.getByTestId('mentor-summary-grid');
  const cells = summaryGrid.locator('> div');

  await expect(cells).toHaveCount(expectedCount);

  const barBox = await summaryBar.boundingBox();
  const gridBox = await summaryGrid.boundingBox();
  expect(barBox).not.toBeNull();
  expect(gridBox).not.toBeNull();
  expect(Math.abs(gridBox!.width - barBox!.width)).toBeLessThanOrEqual(2);

  const expectedColWidth = gridBox!.width / expectedCount;
  for (let i = 0; i < expectedCount; i += 1) {
    const cellBox = await cells.nth(i).boundingBox();
    expect(cellBox).not.toBeNull();
    expect(Math.abs(cellBox!.width - expectedColWidth)).toBeLessThanOrEqual(2);
  }
}

async function revalidateClientProfileViaSpa(
  page: Page,
  nextClockIso: string
): Promise<void> {
  // 先等待初始 /profile 頁面的動態 UI 與 useAsyncRead initialDto 快取寫入完成，
  // 確保舊時間戳已寫入快取後才推進時鐘，避免返回時快取未過期而不發送 /profile 請求
  await expect(page.locator('main img[alt^="Avatar of "]').first()).toBeVisible(
    { timeout: 30_000 }
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );

  await page.clock.setFixedTime(new Date(nextClockIso));
  await page.getByRole('link', { name: 'Go to homepage' }).click();
  await expect(page).toHaveURL('/', { timeout: 30_000 });

  const profileResponse = page.waitForResponse(
    new RegExp(`/v1/(?:mentors|users)/${REAL_MENTOR_ID}/zh_TW/profile`),
    { timeout: 30_000 }
  );
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/profile/${REAL_MENTOR_ID}$`), {
    timeout: 30_000,
  });
  await profileResponse;
  await expect(
    page.getByRole('main').getByText('Zahra Mirzakhani', { exact: true })
  ).toBeVisible({ timeout: 15_000 });
}

test.describe('導師個人頁評價區塊與 RWD 排版 (#736)', () => {
  test('有評價狀態：滿寬 4 格摘要列、雙欄頂部水平對齊、切換評價 Tab、分頁與 Desktop / Tablet / Mobile RWD', async ({
    page,
  }) => {
    await setupBaseMentorMocks(page, {
      ratingCount: 12,
      ratingAverage: 8.5,
      completedMeetingCount: 128,
      clockIso: '2026-11-11T10:00:00+08:00',
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/profile/${REAL_MENTOR_ID}`);
    await revalidateClientProfileViaSpa(page, '2026-11-11T10:02:00+08:00');

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
    await expect(summaryBar.getByText('產業', { exact: true })).toHaveCount(0);
    await expect(summaryBar.getByText(/設計及創意相關業/)).toHaveCount(0);
    await assertEqualWidthSummaryColumns(page, 4);

    // 驗證預設「簡介」分頁渲染完成：導師產業以 #hashtag 渲染於「關於我」標題正下方、自我介紹內文上方，且不重複堆疊經驗／地點／產業標題
    const aboutPanel = page.getByRole('tabpanel', { name: '簡介' });
    const aboutHeading = aboutPanel.getByText('關於我', { exact: true });
    const industryHashtag = aboutPanel.getByTestId('mentor-industry-hashtag');
    const aboutBody = aboutPanel.getByText(/累積超過七年的數位產品設計經驗/);

    await expect(aboutPanel).toBeVisible();
    await expect(aboutHeading).toBeVisible();
    await expect(industryHashtag).toBeVisible();
    await expect(industryHashtag).toHaveText('#設計及創意相關業');
    await expect(aboutBody).toBeVisible();
    await expect(aboutPanel.getByText('經驗', { exact: true })).toHaveCount(0);
    await expect(aboutPanel.getByText('地點', { exact: true })).toHaveCount(0);
    await expect(aboutPanel.getByText('產業', { exact: true })).toHaveCount(0);

    // 驗證「關於我」與 #hashtag 的字色（text-brand-700）、字重（font-medium）與上下間距（mb-3 = 12px）對齊設計稿
    const hashtagStyles = await industryHashtag.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        color: style.color,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        marginBottom: style.marginBottom,
      };
    });
    const headingMarginBottom = await aboutHeading.evaluate(
      (el) => window.getComputedStyle(el).marginBottom
    );
    expect(headingMarginBottom).toBe('12px');
    expect(hashtagStyles.color).toBe('rgb(26, 122, 122)');
    expect(hashtagStyles.fontSize).toBe('14px');
    expect(hashtagStyles.fontWeight).toBe('500');
    expect(hashtagStyles.marginBottom).toBe('12px');

    const aboutHeadingBox = await aboutHeading.boundingBox();
    const hashtagBox = await industryHashtag.boundingBox();
    const aboutBodyBox = await aboutBody.boundingBox();
    expect(aboutHeadingBox).not.toBeNull();
    expect(hashtagBox).not.toBeNull();
    expect(aboutBodyBox).not.toBeNull();
    expect(hashtagBox!.y).toBeGreaterThanOrEqual(
      aboutHeadingBox!.y + aboutHeadingBox!.height - 1
    );
    expect(aboutBodyBox!.y).toBeGreaterThanOrEqual(
      hashtagBox!.y + hashtagBox!.height - 1
    );

    // 驗證左欄「簡介｜評價 12」Tabs 頂端與右欄「可預約日期」卡片頂端水平齊平
    const tabList = page.getByRole('tablist', { name: '導師頁面分頁' });
    const rightScheduleCard = page
      .locator(RIGHT_SCHEDULE_CARD_SELECTOR)
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
    await captureEvidence(page, 'mentor-profile-about-hashtag-desktop', {
      waitForSelector: '[data-testid="mentor-industry-hashtag"]',
    });

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
      waitForSelector: '[data-testid="mentor-feedback-section"]',
      fullPage: true,
    });

    await expect(
      feedbackSection.getByRole('combobox', { name: '評價排序' })
    ).toHaveCount(0);

    // 分頁互動：點擊第 2 頁顯示第 11~12 筆評價，再切回第 1 頁對齊預設時間由新到舊畫面
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

    await page.getByRole('button', { name: '上一頁' }).click();
    const firstReviewItem = feedbackSection.locator('ul > li').first();
    await expect(firstReviewItem).toContainText('陳**');

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
      waitForSelector: '[data-testid="mentor-feedback-section"]',
      fullPage: true,
    });
  });

  test('尚無評價狀態：頂部摘要列隱藏評分並滿寬 3 格均分，切換至「評價 0」顯示空狀態', async ({
    page,
  }) => {
    await setupBaseMentorMocks(page, {
      ratingCount: 0,
      ratingAverage: null,
      completedMeetingCount: 128,
      clockIso: '2026-11-11T10:00:00+08:00',
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/profile/${REAL_MENTOR_ID}`);
    await revalidateClientProfileViaSpa(page, '2026-11-11T10:02:00+08:00');

    const summaryBar = page.getByRole('region', { name: '導師摘要資訊' });
    await expect(summaryBar).toBeVisible();
    await expect(
      summaryBar.getByText('已完成 1-on-1', { exact: true })
    ).toBeVisible();
    await expect(summaryBar.getByText('經驗', { exact: true })).toBeVisible();
    await expect(summaryBar.getByText('地點', { exact: true })).toBeVisible();
    await expect(summaryBar.getByText('產業', { exact: true })).toHaveCount(0);
    await expect(summaryBar.getByText('評分', { exact: true })).toHaveCount(0);
    await assertEqualWidthSummaryColumns(page, 3);

    await expect(
      page
        .getByRole('tabpanel', { name: '簡介' })
        .getByTestId('mentor-industry-hashtag')
    ).toHaveText('#設計及創意相關業');

    const rightScheduleCard = page
      .locator(RIGHT_SCHEDULE_CARD_SELECTOR)
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
    await captureEvidence(page, 'mentor-profile-feedback-empty-desktop', {
      waitForSelector: '[data-testid="mentor-feedback-empty"]',
    });
  });

  test('/profile stats.rating_count Fallback（/feedback 404）、0 場次隱藏「已完成 1-on-1」等寬均分與學員個人頁角色隔離', async ({
    page,
  }) => {
    // 1. 當 /v1/mentors/{id}/feedback 回傳 404 時，從 /profile 的 stats (rating_count / rating_average / completed_meeting_count) 正確 Fallback
    await setupBaseMentorMocks(page, {
      ratingCount: 8,
      ratingAverage: 9.2,
      completedMeetingCount: 64,
      feedbackMode: 'not-found',
      clockIso: '2026-11-11T10:00:00+08:00',
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/profile/${REAL_MENTOR_ID}`);
    // 推進超過 60s DTO 快取 TTL 並經 SPA 往返，確保瀏覽器端實際透過 /profile 回傳的 stats.rating_count 進行映射（不被 SSR initialDto 繞過）
    await revalidateClientProfileViaSpa(page, '2026-11-11T10:02:00+08:00');

    const summaryBar = page.getByRole('region', { name: '導師摘要資訊' });
    await expect(summaryBar).toBeVisible();
    await expect(summaryBar.getByText('9.2', { exact: true })).toBeVisible();
    await expect(summaryBar.getByText('64', { exact: true })).toBeVisible();
    const fallbackFeedbackTab = page.getByRole('tab', { name: /評價\s*8/ });
    await expect(fallbackFeedbackTab).toBeVisible();
    await assertEqualWidthSummaryColumns(page, 4);

    await fallbackFeedbackTab.click();
    const fallbackSection = page.getByTestId('mentor-feedback-section');
    await expect(fallbackSection).toBeVisible();
    await expect(
      fallbackSection.getByText('9.2', { exact: true })
    ).toBeVisible();
    await expect(
      fallbackSection.getByText('8 則會談評價', { exact: true })
    ).toBeVisible();
    await expect(page.getByTestId('mentor-feedback-list-empty')).toBeVisible();
    await expect(
      fallbackSection.getByRole('list', { name: '會談評價列表' })
    ).toHaveCount(0);
    await expect(
      fallbackSection.getByRole('navigation', { name: '評價分頁' })
    ).toHaveCount(0);

    // 2. completed_meeting_count = 0 且有評價：隱藏「已完成 1-on-1」格，剩餘 3 格（評分、經驗、地點）等寬均分滿寬
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await setupBaseMentorMocks(page, {
      ratingCount: 5,
      ratingAverage: 8.8,
      completedMeetingCount: 0,
      clockIso: '2026-11-11T10:02:00+08:00',
    });
    await revalidateClientProfileViaSpa(page, '2026-11-11T10:04:00+08:00');

    await expect(summaryBar.getByText('評分', { exact: true })).toBeVisible();
    await expect(summaryBar.getByText('8.8', { exact: true })).toBeVisible();
    await expect(
      summaryBar.getByText('已完成 1-on-1', { exact: true })
    ).toHaveCount(0);
    await expect(summaryBar.getByText('經驗', { exact: true })).toBeVisible();
    await expect(summaryBar.getByText('地點', { exact: true })).toBeVisible();
    await assertEqualWidthSummaryColumns(page, 3);

    // 3. 新導師 0 則評價且 0 場次：同時隱藏「評分」與「已完成 1-on-1」，剩餘 2 格（經驗、地點）等寬均分滿寬
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await setupBaseMentorMocks(page, {
      ratingCount: 0,
      ratingAverage: null,
      completedMeetingCount: 0,
      clockIso: '2026-11-11T10:04:00+08:00',
    });
    await revalidateClientProfileViaSpa(page, '2026-11-11T10:06:00+08:00');

    await expect(summaryBar.getByText('評分', { exact: true })).toHaveCount(0);
    await expect(
      summaryBar.getByText('已完成 1-on-1', { exact: true })
    ).toHaveCount(0);
    await expect(summaryBar.getByText('經驗', { exact: true })).toBeVisible();
    await expect(summaryBar.getByText('地點', { exact: true })).toBeVisible();
    await assertEqualWidthSummaryColumns(page, 2);

    // 4. 學員個人頁（is_mentor: false）：不渲染導師摘要列與評價分頁，且學員狀態掛載期間不發送 /feedback 請求
    let menteeFeedbackCalls = 0;
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await setupBaseMentorMocks(page, {
      isMentor: false,
      ratingCount: 0,
      completedMeetingCount: 0,
      clockIso: '2026-11-11T10:06:00+08:00',
    });
    await revalidateClientProfileViaSpa(page, '2026-11-11T10:08:00+08:00');

    await expect(
      page.getByRole('region', { name: '導師摘要資訊' })
    ).toHaveCount(0);
    await expect(
      page.getByRole('tablist', { name: '導師頁面分頁' })
    ).toHaveCount(0);

    await page.route(FEEDBACK_ROUTE_RE, (route) => {
      menteeFeedbackCalls += 1;
      return route.fulfill({ status: 200, body: '{}' });
    });
    await revalidateClientProfileViaSpa(page, '2026-11-11T10:10:00+08:00');

    await expect(page.getByText('關於我', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('region', { name: '導師摘要資訊' })
    ).toHaveCount(0);
    await expect(
      page.getByRole('tablist', { name: '導師頁面分頁' })
    ).toHaveCount(0);
    expect(menteeFeedbackCalls).toBe(0);
  });

  test('mentorFeedbackReadModel 分頁快取重用與預約回饋編輯後跨頁同步無效化 (#888)', async ({
    page,
  }) => {
    await seedMockAuthSession(page, {
      id: '1',
      name: 'Test Mentee',
      isMentor: false,
      onBoarding: true,
      jobTitle: 'Junior Product Designer',
      company: 'Studio X',
    });

    await mockApiRoute(page, /\/v1\/notifications/, {
      body: { code: '0', msg: 'ok', data: { items: [] } },
    });
    await mockApiRoute(page, /\/v1\/users\/1\/reservations\/pending-feedback/, {
      body: { code: '0', msg: 'ok', data: { items: [] } },
    });

    let currentRating = 8;
    let currentComment = '分享了很具體的建議，也幫助我釐清下一步的方向。';
    let currentAverage = 8.5;
    let feedbackPage1Calls = 0;
    let feedbackPage2Calls = 0;

    await page.route(
      new RegExp(String.raw`/v1/users/${REAL_MENTOR_ID}/profile(\?|$)`),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            makeMentorProfilePayload({
              isMentor: true,
              ratingCount: 12,
              ratingAverage: currentAverage,
              completedMeetingCount: 128,
            })
          ),
        })
    );

    await mockApiRoute(page, SCHEDULE_ROUTE_RE, {
      body: {
        code: '0',
        msg: 'ok',
        data: {
          schedule: [
            {
              id: 501,
              user_id: Number(REAL_MENTOR_ID),
              dtstart: SLOT_1_START,
              dtend: SLOT_1_END,
              rrule: null,
            },
          ],
          booked_dates: [],
        },
      },
    });

    await page.route(FEEDBACK_ROUTE_RE, (route) => {
      const url = new URL(route.request().url());
      const requestedPage = Number(url.searchParams.get('page') ?? '1');
      if (requestedPage === 2) {
        feedbackPage2Calls += 1;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: {
              total_count: 12,
              page: 2,
              page_size: 10,
              rating_average: currentAverage,
              completed_meeting_count: 128,
              feedbacks: [
                {
                  id: 'fb-p2-1',
                  author_name: '吳**',
                  rating: 9,
                  content: '第二頁的職涯討論回饋內容。',
                  created_at: '2026-10-15T10:00:00Z',
                  is_public: true,
                },
              ],
            },
          }),
        });
      }

      feedbackPage1Calls += 1;
      const page1Items = Array.from({ length: 10 }, (_, idx) => ({
        id: `fb-p1-${idx + 1}`,
        author_name: idx === 0 ? '陳**' : '林**',
        rating: idx === 0 ? currentRating : 8,
        content:
          idx === 0
            ? currentComment
            : `第 ${idx + 1} 則公開評價：提供了具體的調整方向。`,
        created_at: `2026-10-${String(28 - idx).padStart(2, '0')}T10:00:00Z`,
        is_public: true,
      }));

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: '0',
          msg: 'ok',
          data: {
            total_count: 12,
            page: 1,
            page_size: 10,
            rating_average: currentAverage,
            completed_meeting_count: 128,
            feedbacks: page1Items,
          },
        }),
      });
    });

    await page.route(/\/v1\/users\/1\/reservations([?]|$)/, (route) => {
      const url = new URL(route.request().url());
      const state = url.searchParams.get('state');
      const reservations =
        state === 'MENTEE_HISTORY'
          ? [
              {
                id: 888,
                sender: {
                  user_id: 1,
                  role: 'MENTEE',
                  status: 'ACCEPT',
                  name: 'Test Mentee',
                  avatar: '',
                  job_title: 'Junior Product Designer',
                  years_of_experience: 'ONE_TO_THREE',
                },
                participant: {
                  user_id: Number(REAL_MENTOR_ID),
                  role: 'MENTOR',
                  status: 'ACCEPT',
                  name: 'Zahra Mirzakhani',
                  avatar: '',
                  job_title: 'Senior UX Designer',
                  company: 'CreativeUX Design Studio',
                  years_of_experience: 'FIVE_TO_TEN',
                },
                schedule_id: 501,
                dtstart: 1760958000,
                dtend: 1760959800,
                previous_reserve: null,
                messages: [
                  {
                    id: 8881,
                    user_id: 1,
                    role: 'MENTEE',
                    content: '想請教作品集的研究敘事結構。',
                  },
                ],
                feedback: {
                  meeting_happened: true,
                  my_meeting_happened: true,
                  rating: {
                    rating: currentRating,
                    content: currentComment,
                    created_at: 1760960000,
                    updated_at: 1760960000,
                    author_name: '陳**',
                    is_public: true,
                  },
                  next_step: null,
                },
              },
            ]
          : [];

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: '0',
          msg: 'ok',
          data: { reservations, next_dtend: 0 },
        }),
      });
    });

    await page.route(
      /\/v1\/users\/1\/reservations\/888\/feedback$/,
      (route) => {
        const rawBody: unknown = route.request().postDataJSON();
        if (rawBody && typeof rawBody === 'object') {
          if ('rating' in rawBody && typeof rawBody.rating === 'number') {
            currentRating = rawBody.rating;
          }
          if ('content' in rawBody && typeof rawBody.content === 'string') {
            currentComment = rawBody.content;
          }
        }
        currentAverage = 9.5;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: '0', msg: 'ok', data: {} }),
        });
      }
    );

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/reservation/mentee?tab=history');

    const zahraCard = page
      .getByTestId('reservation-card')
      .filter({ hasText: 'Zahra Mirzakhani' });
    await expect(zahraCard).toBeVisible();

    // 1. SPA navigate to mentor profile and open 評價 tab
    await zahraCard
      .getByRole('link', { name: /Zahra Mirzakhani/ })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`/profile/${REAL_MENTOR_ID}$`));

    const reviewsTab = page.getByRole('tab', { name: /評價/ });
    await expect(reviewsTab).toBeVisible();
    await reviewsTab.click();

    const feedbackSection = page.getByTestId('mentor-feedback-section');
    await expect(feedbackSection).toBeVisible();
    await expect(feedbackSection.getByText(currentComment)).toBeVisible();
    expect(feedbackPage1Calls).toBe(1);

    // 2. Paginate Page 1 -> Page 2 -> Page 1 and verify Page 1 hits mentorFeedbackReadModel cache
    await feedbackSection.getByRole('button', { name: '第 2 頁' }).click();
    await expect(
      feedbackSection.getByText('第二頁的職涯討論回饋內容。')
    ).toBeVisible();
    expect(feedbackPage2Calls).toBe(1);

    await feedbackSection.getByRole('button', { name: '上一頁' }).click();
    await expect(feedbackSection.getByText(currentComment)).toBeVisible();
    expect(feedbackPage1Calls).toBe(1);

    // 3. SPA navigate back to reservation history, edit public feedback (#731), and return without TTL expiry
    await page.goBack();
    await expect(page).toHaveURL(/\/reservation\/mentee\?tab=history/);

    await zahraCard.getByRole('button', { name: '查看回饋' }).click();
    await zahraCard.getByRole('button', { name: '編輯' }).click();

    const editDialog = page.getByRole('dialog');
    await expect(editDialog.getByText('編輯回饋')).toBeVisible();
    const updatedComment = '透過統一回饋突變通道即時同步更新的公開評價內容！';
    await editDialog
      .getByRole('radiogroup', { name: '整體滿意度' })
      .getByRole('radio', { name: '10 分' })
      .click();
    await editDialog.getByLabel(/文字回饋/).fill(updatedComment);
    await editDialog.getByRole('button', { name: '儲存' }).click();
    await expect(editDialog).not.toBeVisible();

    // 4. SPA navigate back to mentor profile -> mentorFeedbackReadModel was invalidated and refetches fresh Page 1
    await zahraCard
      .getByRole('link', { name: /Zahra Mirzakhani/ })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`/profile/${REAL_MENTOR_ID}$`));

    await page.getByRole('tab', { name: /評價/ }).click();
    await expect(feedbackSection.getByText(updatedComment)).toBeVisible();
    expect(feedbackPage1Calls).toBe(2);

    await captureEvidence(page, '888-mentor-feedback-synced-after-edit', {
      waitForSelector: '[data-testid="mentor-feedback-section"]',
    });
  });
});
