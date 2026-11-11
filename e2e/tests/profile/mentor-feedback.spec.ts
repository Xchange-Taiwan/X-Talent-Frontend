import { expect, Page, test } from '@playwright/test';

import { captureEvidence } from '../../helpers/evidence';
import { mockApiRoute } from '../../helpers/route';

test.use({ timezoneId: 'Asia/Taipei' });

// Seeded mentor ID on the staging BFF so SSR fetchUserByIdServer succeeds when
// NEXT_PUBLIC_API_URL is configured, while client-side feedback & schedule
// calls are deterministically mocked via Playwright route interception.
const REAL_MENTOR_ID = '7482008160728084';

function makeMentorProfilePayload(stats?: {
  completed_meeting_count: number;
  total_rating_count: number;
  rating_average: number | null;
}) {
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
      years_of_experience: 'FIVE_TO_TEN_YEARS',
      location: 'TWN',
      personal_statement: '歡迎帶著作品集一起討論下一步職涯方向。',
      about:
        '累積超過七年的數位產品設計經驗，喜歡把複雜問題轉化為清楚實用的產品體驗。',
      language: 'zh_TW',
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
      have_skill: ['UX_RESEARCH'],
      have_topic: ['PORTFOLIO_REVIEW'],
      expertises: { professions: [], language: 'zh_TW' },
      experiences: [],
      ...(stats ? { stats } : {}),
    },
  };
}

const PAGE_1_ITEMS = [
  // Intentionally out-of-order first two entries to verify frontend newest-first sorting
  {
    id: 'fb-2',
    author_name: '林**',
    rating: 8,
    content: '從作品集的架構到研究故事，都給了我可以實際執行的修改方向。',
    created_at: '2026-10-27T10:00:00Z',
  },
  {
    id: 'fb-1',
    author_name: '陳**',
    rating: 9,
    content: '分享了很具體的建議，也幫助我釐清下一步的方向。',
    created_at: '2026-10-28T10:00:00Z',
  },
  {
    id: 'fb-3',
    author_name: '王**',
    rating: 9,
    content: '很有耐心地回答問題，會談前也有先了解我的需求。',
    created_at: '2026-10-26T10:00:00Z',
  },
  {
    id: 'fb-4',
    author_name: '張**',
    rating: 9,
    content: '協助我重新梳理面試簡報邏輯，非常實用。',
    created_at: '2026-10-25T10:00:00Z',
  },
  {
    id: 'fb-5',
    author_name: '李**',
    rating: 8,
    content: '針對轉職時間軸給出明確里程碑。',
    created_at: '2026-10-24T10:00:00Z',
  },
  {
    id: 'fb-6',
    author_name: '吳**',
    rating: 9,
    content: '深入淺出分享跨部門協作經驗。',
    created_at: '2026-10-23T10:00:00Z',
  },
  {
    id: 'fb-7',
    author_name: '劉**',
    rating: 8,
    content: '履歷修改前後差異很大，感謝指導！',
    created_at: '2026-10-22T10:00:00Z',
  },
  {
    id: 'fb-8',
    author_name: '蔡**',
    rating: 9,
    content: '給了很多設計系統落地的實戰案例。',
    created_at: '2026-10-21T10:00:00Z',
  },
  {
    id: 'fb-9',
    author_name: '許**',
    rating: 8,
    content: '一針見血點出作品集盲點。',
    created_at: '2026-10-20T10:00:00Z',
  },
  {
    id: 'fb-10',
    author_name: '鄭**',
    rating: 8,
    content: '對外商面試準備很有幫助。',
    created_at: '2026-10-19T10:00:00Z',
  },
];

const PAGE_2_ITEMS = [
  {
    id: 'fb-11',
    author_name: '黃**',
    rating: 9,
    content: '第二頁評價：幫助我建立自信面對白板題挑戰。',
    created_at: '2026-10-18T10:00:00Z',
  },
  {
    id: 'fb-12',
    author_name: '周**',
    rating: 8,
    content: '第二頁評價：提供很多實用的職涯探索資源。',
    created_at: '2026-10-17T10:00:00Z',
  },
];

async function mockBaseProfileDependencies(
  page: Page,
  stats?: {
    completed_meeting_count: number;
    total_rating_count: number;
    rating_average: number | null;
  }
) {
  await page.route(/\/api\/auth\/session/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    })
  );

  await mockApiRoute(
    page,
    new RegExp(`/v1/(?:mentors|users)/${REAL_MENTOR_ID}/zh_TW/profile`),
    { body: makeMentorProfilePayload(stats) }
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

  await mockApiRoute(
    page,
    new RegExp(`/v1/mentors/${REAL_MENTOR_ID}/schedule/`),
    {
      body: {
        code: '0',
        msg: 'ok',
        data: { segments: [] },
      },
    }
  );
}

test.describe('導師個人頁評價區塊與摘要列 (#736)', () => {
  test('顯示摘要列平均評分與場次、切換「評價 12」Tab 維持摘要列固定、依最新時間排序並支援分頁與行動版 RWD', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockBaseProfileDependencies(page, {
      completed_meeting_count: 128,
      total_rating_count: 12,
      rating_average: 8.5,
    });

    const requestedPages: number[] = [];
    await page.route(
      (url) => url.pathname.endsWith(`/v1/mentors/${REAL_MENTOR_ID}/feedback`),
      (route) => {
        const url = new URL(route.request().url());
        const currentPage = Number(url.searchParams.get('page') ?? '1');
        requestedPages.push(currentPage);
        const items = currentPage === 2 ? PAGE_2_ITEMS : PAGE_1_ITEMS;

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: {
              total_rating_count: 12,
              rating_average: 8.5,
              completed_meeting_count: 128,
              page: currentPage,
              page_size: 10,
              items,
            },
          }),
        });
      }
    );

    await page.goto(`/profile/${REAL_MENTOR_ID}`);

    const summaryRegion = page.getByRole('region', { name: '導師會談摘要' });
    await expect(summaryRegion).toBeVisible({ timeout: 15_000 });
    await expect(summaryRegion).toContainText('8.5');
    await expect(summaryRegion).toContainText('/ 10');
    await expect(summaryRegion).toContainText('128');

    const aboutTab = page.getByRole('tab', { name: '簡介' });
    const reviewsTab = page.getByRole('tab', { name: '評價 12' });
    await expect(aboutTab).toHaveAttribute('aria-selected', 'true');
    await expect(reviewsTab).toBeVisible();

    const summaryBoxOnAbout = await summaryRegion.boundingBox();
    expect(summaryBoxOnAbout).not.toBeNull();

    await reviewsTab.click();
    await expect(reviewsTab).toHaveAttribute('aria-selected', 'true');

    // Summary bar remains fixed at identical position and height when switching tabs
    const summaryBoxOnReviews = await summaryRegion.boundingBox();
    expect(summaryBoxOnReviews).not.toBeNull();
    expect(
      Math.abs(summaryBoxOnReviews!.y - summaryBoxOnAbout!.y)
    ).toBeLessThan(2);
    expect(
      Math.abs(summaryBoxOnReviews!.height - summaryBoxOnAbout!.height)
    ).toBeLessThan(2);

    await expect(page.getByText('12 則會談評價')).toBeVisible();
    await expect(
      page.getByText('分享了很具體的建議，也幫助我釐清下一步的方向。')
    ).toBeVisible();

    // Verify newest-first sorting: 陳** (2026/10/28) renders before 林** (2026/10/27)
    const reviewItems = page
      .getByRole('list', { name: '學員評價列表' })
      .locator('li');
    await expect(reviewItems).toHaveCount(10);
    await expect(reviewItems.nth(0)).toContainText('陳**');
    await expect(reviewItems.nth(0)).toContainText('2026/10/28');
    await expect(reviewItems.nth(1)).toContainText('林**');
    await expect(reviewItems.nth(1)).toContainText('2026/10/27');

    await captureEvidence(page, '01-mentor-profile-reviews-tab');

    // Click next page and verify Page 2 loads
    const paginationNav = page.getByRole('navigation', { name: '評價分頁' });
    await expect(paginationNav).toBeVisible();
    await paginationNav.getByRole('button', { name: '下一頁' }).click();

    await expect(
      page.getByText('第二頁評價：幫助我建立自信面對白板題挑戰。')
    ).toBeVisible();
    expect(requestedPages).toContain(2);

    // Switch to Mobile RWD viewport (375x812) and return to Page 1
    await page.setViewportSize({ width: 375, height: 812 });
    await paginationNav.getByRole('button', { name: '上一頁' }).click();
    await expect(
      page.getByText('分享了很具體的建議，也幫助我釐清下一步的方向。')
    ).toBeVisible();

    // Scroll back to top so header, summary bar, tabs, reviews, and calendar layout can be verified & captured
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));

    const headerBlock = page.getByTestId('profile-header-block');
    const tabList = page.getByRole('tablist');
    const leftColumn = page.locator('main .xl\\:w-3\\/5');
    const rightColumn = page.locator('main .xl\\:w-2\\/5');

    await expect(headerBlock).toBeVisible();
    await expect(summaryRegion).toBeVisible();
    await expect(tabList).toBeVisible();
    await expect(rightColumn.getByText('可預約日期')).toBeVisible();

    const headerBox = await headerBlock.boundingBox();
    const mobileSummaryBox = await summaryRegion.boundingBox();
    const tabListBox = await tabList.boundingBox();
    const item0Box = await reviewItems.nth(0).boundingBox();
    const item1Box = await reviewItems.nth(1).boundingBox();
    const leftColBox = await leftColumn.boundingBox();
    const rightColBox = await rightColumn.boundingBox();

    expect(headerBox).not.toBeNull();
    expect(mobileSummaryBox).not.toBeNull();
    expect(tabListBox).not.toBeNull();
    expect(item0Box).not.toBeNull();
    expect(item1Box).not.toBeNull();
    expect(leftColBox).not.toBeNull();
    expect(rightColBox).not.toBeNull();

    // 1. Mobile RWD: Summary bar and Tabs do NOT overlap Name/Job Title header block
    expect(mobileSummaryBox!.y).toBeGreaterThanOrEqual(
      headerBox!.y + headerBox!.height - 1
    );
    expect(tabListBox!.y).toBeGreaterThanOrEqual(
      mobileSummaryBox!.y + mobileSummaryBox!.height - 1
    );

    // 2. Mobile RWD: Review items stack vertically in a single column
    expect(Math.abs(item0Box!.x - item1Box!.x)).toBeLessThanOrEqual(2);
    expect(item1Box!.y).toBeGreaterThanOrEqual(
      item0Box!.y + item0Box!.height - 1
    );

    // 3. Mobile RWD: Schedule calendar moves below the left reviews column
    expect(rightColBox!.y).toBeGreaterThanOrEqual(
      leftColBox!.y + leftColBox!.height - 1
    );

    await captureEvidence(page, '01-mentor-profile-reviews-mobile-rwd', {
      fullPage: true,
    });
  });

  test('0 則評價時隱藏「評分」區塊並於「評價 0」Tab 顯示「目前還沒有評價」空狀態，且 0 場 0 評時切換 Tab 摘要列固定不跳動（含 Tablet RWD）', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockBaseProfileDependencies(page, {
      completed_meeting_count: 128,
      total_rating_count: 0,
      rating_average: null,
    });

    let completedMeetingsInMock = 128;
    await page.route(
      (url) => url.pathname.endsWith(`/v1/mentors/${REAL_MENTOR_ID}/feedback`),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: {
              total_rating_count: 0,
              rating_average: null,
              completed_meeting_count: completedMeetingsInMock,
              page: 1,
              page_size: 10,
              items: [],
            },
          }),
        })
    );

    await page.goto(`/profile/${REAL_MENTOR_ID}`);

    const summaryRegion = page.getByRole('region', { name: '導師會談摘要' });
    await expect(summaryRegion).toBeVisible({ timeout: 15_000 });
    await expect(summaryRegion).toContainText('已完成 1-on-1');
    await expect(summaryRegion).toContainText('128');
    await expect(summaryRegion).not.toContainText('評分');
    await expect(summaryRegion).not.toContainText('/ 10');

    const emptyTab = page.getByRole('tab', { name: '評價 0' });
    await expect(emptyTab).toBeVisible();
    await emptyTab.click();

    await expect(page.getByText('目前還沒有評價')).toBeVisible();
    await expect(
      page.getByText('完成會談後，學員的評價會顯示在這裡。')
    ).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: '評價分頁' })
    ).not.toBeVisible();

    await captureEvidence(page, '02-mentor-profile-reviews-empty');

    // Now verify 0 completed meetings & 0 ratings: summary bar stays fixed without height jump on Tab switch
    completedMeetingsInMock = 0;
    await mockBaseProfileDependencies(page, {
      completed_meeting_count: 0,
      total_rating_count: 0,
      rating_average: null,
    });
    await page.goto(`/profile/${REAL_MENTOR_ID}`);

    await expect(summaryRegion).toBeVisible({ timeout: 15_000 });
    await expect(summaryRegion).toContainText(
      '尚未有任何評價，您可以成為第一個預約的 Mentee！'
    );
    const zeroStatsBoxBefore = await summaryRegion.boundingBox();
    expect(zeroStatsBoxBefore).not.toBeNull();

    await page.getByRole('tab', { name: '評價 0' }).click();
    await expect(page.getByText('目前還沒有評價')).toBeVisible();
    await expect(summaryRegion).toBeVisible();

    const zeroStatsBoxAfter = await summaryRegion.boundingBox();
    expect(zeroStatsBoxAfter).not.toBeNull();
    expect(
      Math.abs(zeroStatsBoxAfter!.y - zeroStatsBoxBefore!.y)
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(zeroStatsBoxAfter!.height - zeroStatsBoxBefore!.height)
    ).toBeLessThanOrEqual(1);

    // Verify Tablet viewport (768x1024)
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByText('目前還沒有評價')).toBeVisible();
    await expect(summaryRegion).toBeVisible();
  });

  test('後端評價 API 尚未上線回傳 404 時 graceful fallback 至空狀態而不崩潰', async ({
    page,
  }) => {
    await mockBaseProfileDependencies(page);

    await mockApiRoute(
      page,
      new RegExp(`/v1/mentors/${REAL_MENTOR_ID}/feedback`),
      {
        status: 404,
        body: { code: '404', msg: 'Not Found', data: null },
      }
    );

    await page.goto(`/profile/${REAL_MENTOR_ID}`);

    const emptyTab = page.getByRole('tab', { name: '評價 0' });
    await expect(emptyTab).toBeVisible({ timeout: 15_000 });
    await emptyTab.click();

    await expect(page.getByText('目前還沒有評價')).toBeVisible();
    await expect(
      page.getByText('完成會談後，學員的評價會顯示在這裡。')
    ).toBeVisible();
  });
});
