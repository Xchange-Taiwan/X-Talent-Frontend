import { expect, Locator, Page, test } from '@playwright/test';

import { captureEvidence } from '../../helpers/evidence';
import { blockUnmockedExternalApi } from '../../helpers/route';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MOCK_INTERESTS = {
  code: '0',
  msg: 'ok',
  data: { interests: [], language: 'zh_TW' },
};

const MOCK_TAG_CATALOG = {
  code: '0',
  msg: 'ok',
  data: {
    catalogs: {
      skill: {
        groups: [
          {
            subject_group: 'SKILL_GROUP',
            subject: '技術能力',
            language: 'zh_TW',
            leaves: [
              {
                tag_id: 1,
                subject_group: 'FRONTEND',
                subject: '前端開發',
                language: 'zh_TW',
              },
            ],
          },
        ],
      },
      topic: {
        groups: [
          {
            subject_group: 'TOPIC_GROUP',
            subject: '服務主題',
            language: 'zh_TW',
            leaves: [
              {
                tag_id: 2,
                subject_group: 'CAREER',
                subject: '職涯規劃',
                language: 'zh_TW',
              },
            ],
          },
        ],
      },
      position: {
        groups: [
          {
            subject_group: 'POS_GROUP',
            subject: '工程職位',
            language: 'zh_TW',
            leaves: [
              {
                tag_id: 3,
                subject_group: 'SWE',
                subject: '軟體工程師',
                language: 'zh_TW',
              },
            ],
          },
        ],
      },
      industry: {
        groups: [
          {
            subject_group: 'TECH',
            subject: '科技業',
            language: 'zh_TW',
            leaves: [],
          },
        ],
      },
    },
  },
};

function makeMentor(
  id: number,
  overrides: Partial<{
    name: string;
    job_title: string;
    company: string;
    about: string;
    skills: string[];
    topics: string[];
    have_skill: string[];
    have_topic: string[];
    stats: {
      completed_meeting_count?: number | null;
      total_rating_count?: number | null;
      rating_count?: number | null;
      rating_average?: number | null;
    } | null;
  }> = {}
) {
  return {
    user_id: id,
    name: overrides.name ?? `Mentor ${id}`,
    avatar: '',
    job_title: overrides.job_title ?? 'Software Engineer',
    company: overrides.company ?? `Company ${id}`,
    years_of_experience: 'THREE_TO_FIVE_YEARS',
    location: 'TWN',
    linkedin_profile: '',
    interested_positions: [],
    skills: overrides.skills ?? [],
    topics: overrides.topics ?? [],
    want_position: [],
    want_skill: [],
    want_topic: [],
    have_skill: overrides.have_skill ?? overrides.skills ?? [],
    have_topic: overrides.have_topic ?? overrides.topics ?? [],
    industry: 'Technology',
    language: 'zh_TW',
    personal_statement: `Personal statement ${id}`,
    about: overrides.about ?? '',
    seniority_level: 'JUNIOR',
    expertises: [],
    experiences: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: `2024-01-${String(id).padStart(2, '0')}T00:00:00Z`,
    ...(overrides.stats !== undefined ? { stats: overrides.stats } : {}),
  };
}

function mentorResponse(
  mentors: ReturnType<typeof makeMentor>[],
  nextCursor: string | null = null
) {
  return {
    code: '0',
    msg: 'ok',
    data: { mentors, next_id: 0, next_cursor: nextCursor },
  };
}

const PAGE_LIMIT = 9;

/**
 * Repeatedly presses Tab until the given locator receives focus, bounded so
 * a broken tab order fails the test instead of hanging.
 */
async function tabUntilFocused(
  page: Page,
  locator: Locator,
  maxPresses: number
): Promise<void> {
  for (let i = 0; i < maxPresses; i++) {
    await page.keyboard.press('Tab');
    const isFocused = await locator.evaluate(
      (el) => el === document.activeElement
    );
    if (isFocused) return;
  }
  throw new Error(`無法在 ${maxPresses} 次 Tab 按鍵內聚焦目標元素`);
}

// ─── Setup ───────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  // Register the catch-all abort handler first so it sits at the bottom of
  // Playwright's LIFO route stack; subsequent explicit page.route() mocks
  // registered below take precedence over it.
  await blockUnmockedExternalApi(page);
  // Silence the three background interests calls (used for skill label mapping)
  await page.route(/\/v1\/users\/zh_TW\/interests/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_INTERESTS),
    })
  );
  await page.route(/\/v1\/users\/zh_TW\/tags\/catalog/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_TAG_CATALOG),
    })
  );
});

// ─── Tests ───────────────────────────────────────────────────────────────────

test('page loads → mentor cards are displayed', async ({ page }) => {
  await page.route(/\/v1\/mentors/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        mentorResponse([makeMentor(1), makeMentor(2), makeMentor(3)])
      ),
    })
  );

  // The initial listing is server-rendered in MentorPoolWithData (RSC) when
  // NEXT_PUBLIC_API_URL is configured, and falls back to client-side
  // /v1/mentors when SSR runs without a backend URL.
  await page.goto('/mentor-pool');

  const articles = page.locator('article');
  await expect(articles.first()).toBeVisible({ timeout: 15_000 });
  const count = await articles.count();
  await expect(page.getByText(`找到 ${count} 位導師`)).toBeVisible();
});

test('type keyword in search bar → mentor list updates to match results', async ({
  page,
}) => {
  await page.route(/\/v1\/mentors/, (route, request) => {
    const keyword = new URL(request.url()).searchParams.get('search_pattern');
    const data =
      keyword === 'React'
        ? [makeMentor(10), makeMentor(11)]
        : [makeMentor(1), makeMentor(2), makeMentor(3)];
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mentorResponse(data)),
    });
  });

  // Next.js still executes SSR during initial page load, but appending ?q=initial
  // immediately triggers a client-side search request. Playwright's page.route
  // intercepts this client-side fetch, deterministically seeding the card list
  // with our mock data before user interaction begins.
  await page.goto('/mentor-pool?q=initial');
  await expect(page.locator('article')).toHaveCount(3);

  const responsePromise = page.waitForResponse(/\/v1\/mentors/);
  await page.fill(
    'input[placeholder="搜尋有興趣職位、公司或是想精進的領域"]',
    'React'
  );
  await page.getByRole('button', { name: '搜尋' }).click();
  await responsePromise;

  await expect(page.locator('article')).toHaveCount(2);
});

test('apply a filter → mentor list updates to show only filtered results', async ({
  page,
}) => {
  await page.route(/\/v1\/mentors/, (route, request) => {
    // There is no position filter in the current UI (mentor-pool/data.ts
    // only defines filter_skills / filter_topics / filter_industries, in
    // that order) — filter_skills is the first combobox the test opens.
    const skill = new URL(request.url()).searchParams.get('filter_skills');
    const data = skill
      ? [makeMentor(20)]
      : [makeMentor(1), makeMentor(2), makeMentor(3)];
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mentorResponse(data)),
    });
  });

  // Next.js still executes SSR during initial page load, but appending ?q=initial
  // immediately triggers a client-side search request. Playwright's page.route
  // intercepts this client-side fetch, deterministically seeding the card list
  // with our mock data before user interaction begins.
  await page.goto('/mentor-pool?q=initial');
  await expect(page.locator('article')).toHaveCount(3);

  // Open filter popover
  await page.getByRole('button', { name: /篩選/ }).click();

  // filter_skills options come from the tag catalog, itself SSR-fetched (see
  // fetchTagCatalogServer) and therefore unmockable here — select whichever
  // real option renders first instead of a hardcoded label.
  await page.getByRole('combobox').first().click();
  await page.getByRole('option').first().click();

  const responsePromise = page.waitForResponse(/\/v1\/mentors/);
  await page.getByRole('button', { name: '套用' }).click();
  await responsePromise;

  await expect(page.locator('article')).toHaveCount(1);
});

test('scroll to bottom → additional mentors are loaded and appended', async ({
  page,
}) => {
  const firstPage = Array.from({ length: PAGE_LIMIT }, (_, i) =>
    makeMentor(i + 1)
  );
  const secondPage = [makeMentor(10), makeMentor(11), makeMentor(12)];

  await page.route(/\/v1\/mentors/, (route, request) => {
    const cursor = new URL(request.url()).searchParams.get('cursor');
    const data = cursor ? secondPage : firstPage;
    const nextCursor = cursor ? null : 'opaque-cursor-page-2';
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mentorResponse(data, nextCursor)),
    });
  });

  // Force the client-side (mockable) fetch path — via any search condition —
  // instead of the unmocked SSR listing, so the first page's next_cursor
  // continuation token is deterministically seeded before scrolling.
  await page.goto('/mentor-pool?q=test');
  await expect(page.locator('article')).toHaveCount(PAGE_LIMIT);

  // Bring the last card into the viewport — IntersectionObserver fires and
  // triggers fetchMoreMentors using the server-returned next_cursor token.
  const loadMorePromise = page.waitForResponse(
    (res) =>
      /\/v1\/mentors/.test(res.url()) &&
      new URL(res.url()).searchParams.get('cursor') === 'opaque-cursor-page-2'
  );
  await page.locator('article').last().scrollIntoViewIfNeeded();
  await loadMorePromise;

  await expect(page.locator('article')).toHaveCount(PAGE_LIMIT + 3);
});

test('search returns no results → empty state message is shown', async ({
  page,
}) => {
  await page.route(/\/v1\/mentors/, (route, request) => {
    const keyword = new URL(request.url()).searchParams.get('search_pattern');
    const data = keyword === 'xyznotfound' ? [] : [makeMentor(1)];
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mentorResponse(data)),
    });
  });

  // Next.js still executes SSR during initial page load, but ?q=initial triggers
  // a client-side search request intercepted by page.route, ensuring a deterministic
  // visible card is present before verifying the empty state.
  await page.goto('/mentor-pool?q=initial');
  await expect(page.locator('article').first()).toBeVisible({
    timeout: 15_000,
  });

  const responsePromise = page.waitForResponse(/\/v1\/mentors/);
  await page.fill(
    'input[placeholder="搜尋有興趣職位、公司或是想精進的領域"]',
    'xyznotfound'
  );
  await page.getByRole('button', { name: '搜尋' }).click();
  await responsePromise;

  await expect(page.getByText('找不到符合的導師')).toBeVisible();
  await expect(page.locator('article')).toHaveCount(0);
});

test('Tab 聚焦導師卡片 → 顯示焦點外框 → Enter 導向個人頁面', async ({
  page,
}) => {
  await page.route(/\/v1\/mentors/, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mentorResponse([makeMentor(1)])),
    });
  });

  // Force the client-side (mockable) fetch path so the rendered card, and
  // therefore its /profile/{id} target, is deterministic.
  await page.goto('/mentor-pool?q=test');
  const card = page.locator('article').first();
  await expect(card).toBeVisible({ timeout: 15_000 });

  const cardLink = card.getByRole('link');
  await tabUntilFocused(page, cardLink, 60);
  await expect(cardLink).toBeFocused();

  // The whole-card <Link> is absolutely positioned inside an
  // `overflow-hidden` <article>, so the focus ring is applied to the
  // <article> itself (FOCUS_WITHIN_RING_CLASSES) instead of the <Link> to
  // avoid being clipped. Assert it renders instead of the old
  // `focus-visible` no-op.
  await expect(card).not.toHaveCSS('box-shadow', 'none');

  // Enter triggers the native <a> click behavior and navigates.
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/profile\/1$/);
});

test('點擊 PopularPositionChips 熱門職位標籤 → 觸發篩選並更新列表，點進導師個人頁後 page.goBack() 返回保留原篩選條件與導師列表快取', async ({
  page,
}) => {
  let chipFetchCount = 0;

  await page.route(/\/v1\/mentors(\?|$)/, (route, request) => {
    const keyword = new URL(request.url()).searchParams.get('search_pattern');
    if (keyword === '前端工程師') {
      chipFetchCount += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mentorResponse([makeMentor(1), makeMentor(2)])),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        mentorResponse([makeMentor(1), makeMentor(2), makeMentor(3)])
      ),
    });
  });

  await page.goto('/mentor-pool?q=initial');
  await expect(page.locator('article')).toHaveCount(3);

  const chipGroup = page.getByLabel('熱門職位');
  const chipResponsePromise = page.waitForResponse(
    (res) =>
      /\/v1\/mentors(\?|$)/.test(res.url()) &&
      new URL(res.url()).searchParams.get('search_pattern') === '前端工程師'
  );
  await chipGroup.getByRole('button', { name: '前端工程師' }).click();
  await chipResponsePromise;

  await expect(page).toHaveURL(
    /q=%E5%89%8D%E7%AB%AF%E5%B7%A5%E7%A8%8B%E5%B8%AB/
  );
  await expect(
    page.locator('input[placeholder="搜尋有興趣職位、公司或是想精進的領域"]')
  ).toHaveValue('前端工程師');
  await expect(page.locator('article')).toHaveCount(2);
  await expect(page.getByText('找到 2 位導師')).toBeVisible();
  expect(chipFetchCount).toBe(1);

  // 點進篩選後的導師個人頁再透過 page.goBack() 返回，驗證篩選條件與快取列表保留
  await page
    .locator('article')
    .first()
    .getByRole('link', { name: '前往 Mentor 1 的個人頁面' })
    .click();
  await expect(page).toHaveURL(/\/profile\/1$/);

  await page.goBack();

  await expect(page).toHaveURL(
    /\/mentor-pool\?q=%E5%89%8D%E7%AB%AF%E5%B7%A5%E7%A8%8B%E5%B8%AB/
  );
  await expect(
    page.locator('input[placeholder="搜尋有興趣職位、公司或是想精進的領域"]')
  ).toHaveValue('前端工程師');
  await expect(page.locator('article')).toHaveCount(2);
  await expect(page.getByText('找到 2 位導師')).toBeVisible();
  expect(chipFetchCount).toBe(1);
});

test('篩選下拉選單向下展開不遮擋觸發器、導師卡片同列等高對齊、合併主題與技能標籤並將命中篩選置頂去重 (#859)', async ({
  page,
}) => {
  await page.route(/\/v1\/mentors/, (route, request) => {
    const skill = new URL(request.url()).searchParams.get('filter_skills');
    const data = [
      makeMentor(1, {
        job_title: 'Senior Frontend Engineer',
        company: 'Company A',
        about:
          '擁有多年前端架構與跨國團隊帶領經驗，專注於效能優化、設計系統與工程文化建立。',
        have_topic: ['職涯規劃'],
        have_skill: ['職涯規劃', '前端開發'],
      }),
      makeMentor(2, {
        job_title: '',
        company: '',
        about: '簡短自介。',
        have_topic: ['職涯規劃'],
        have_skill: skill ? [skill] : ['前端開發'],
      }),
    ];
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mentorResponse(data)),
    });
  });

  await page.goto('/mentor-pool?q=initial');
  const cards = page.locator('article');
  await expect(cards).toHaveCount(2);

  // 1. 驗證同列卡片高度一致（即使第二張卡片無職稱/公司且自介僅一行）
  const box1 = await cards.nth(0).boundingBox();
  const box2 = await cards.nth(1).boundingBox();
  expect(box1).not.toBeNull();
  expect(box2).not.toBeNull();
  expect(Math.abs(box1!.height - box2!.height)).toBeLessThanOrEqual(1);

  // 2. 驗證卡片同時渲染主題與技能標籤，且重複標籤已去重
  const firstCardDisplayTags = cards
    .nth(0)
    .getByTestId('display-container')
    .locator('> div');
  await expect(firstCardDisplayTags).toHaveText(['職涯規劃', '前端開發']);

  // 3. 驗證篩選選單使用 popper 向下展開，不遮擋觸發器本身
  await page.getByRole('button', { name: /篩選/ }).click();
  const firstCombobox = page.getByRole('combobox').first();
  const triggerBox = await firstCombobox.boundingBox();
  await firstCombobox.click();

  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible();
  await expect(listbox).toHaveAttribute('data-side', 'bottom');

  const listboxBox = await listbox.boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(listboxBox).not.toBeNull();
  expect(listboxBox!.y).toBeGreaterThanOrEqual(
    triggerBox!.y + triggerBox!.height - 2
  );

  // 4. 選擇技能篩選並套用後，命中的技能標籤置頂顯示
  const firstOption = page.getByRole('option').first();
  const selectedLabel = (await firstOption.textContent())?.trim() ?? '';
  await firstOption.click();

  const responsePromise = page.waitForResponse(/\/v1\/mentors/);
  await page.getByRole('button', { name: '套用' }).click();
  await responsePromise;

  const secondCardFirstTag = cards
    .nth(1)
    .getByTestId('display-container')
    .locator('> div')
    .first();
  if (selectedLabel) {
    await expect(secondCardFirstTag).toHaveText(selectedLabel);
  }
});

test('搜尋導師後卡片依方案 B 顯示純數字平均分與已完成場次、0 則隱藏、同列等高且手機版長名字截斷分數不換行 (#737)', async ({
  page,
}) => {
  const initialMentors = [makeMentor(1)];
  const ratedMentors = [
    makeMentor(101, {
      name: '陳宥廷 Austin',
      job_title: 'Senior Product Manager',
      company: 'Google',
      about:
        '擁有跨國科技產品策略與職涯輔導實務經驗，協助學員釐清職涯方向與產品思維。',
      have_topic: ['職涯規劃'],
      have_skill: ['產品策略', '履歷健檢'],
      stats: {
        completed_meeting_count: 18,
        total_rating_count: 12,
        rating_average: 9.8,
      },
    }),
    makeMentor(102, {
      name: '林佳穎 Claire',
      job_title: 'Staff UX Designer',
      company: 'Appier',
      about:
        '專注於大型產品設計系統與跨部門協作，陪伴設計師準備作品集檢視與面試演練。',
      have_topic: ['職涯規劃'],
      have_skill: ['前端開發'],
      stats: {
        completed_meeting_count: 5,
        total_rating_count: 0,
        rating_average: null,
      },
    }),
    makeMentor(103, {
      name: '李明哲 Ming-Zhe Lee',
      job_title: 'Backend Tech Lead',
      company: 'Shopee',
      about: '專精於高併發分散式系統架構與後端工程團隊帶領。',
      have_topic: ['職涯規劃'],
      have_skill: ['前端開發'],
      stats: {
        completed_meeting_count: 0,
        total_rating_count: 0,
        rating_average: null,
      },
    }),
    makeMentor(104, {
      name: '張哲瑋 Christopher Alexander Chang-Williams',
      job_title: 'Senior UX Designer',
      company: 'CreativeUX Design Studio',
      about:
        '協助設計師從使用者研究到產品落地建立完整影響力，熟悉跨文化設計團隊合作。',
      have_topic: ['職涯規劃'],
      have_skill: ['前端開發'],
      stats: {
        completed_meeting_count: 12,
        rating_count: 8,
        rating_average: 9.6,
      },
    }),
  ];

  await page.route(/\/v1\/mentors/, (route, request) => {
    const keyword = new URL(request.url()).searchParams.get('search_pattern');
    const data = keyword === '設計' ? ratedMentors : initialMentors;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mentorResponse(data)),
    });
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/mentor-pool?q=initial');
  await expect(page.locator('article')).toHaveCount(1);

  const searchResponsePromise = page.waitForResponse(
    (res) =>
      /\/v1\/mentors/.test(res.url()) &&
      new URL(res.url()).searchParams.get('search_pattern') === '設計'
  );
  await page.fill(
    'input[placeholder="搜尋有興趣職位、公司或是想精進的領域"]',
    '設計'
  );
  await page.getByRole('button', { name: '搜尋' }).click();
  await searchResponsePromise;

  const cards = page.locator('article');
  await expect(cards).toHaveCount(4);

  // 1. 方案 B 三行結構：姓名左 + 純數字平均分右（無星星與則數）→ 職稱滿寬 → 已完成場次靠左對齊職稱下方
  const firstCard = cards.nth(0);
  const firstName = firstCard.getByRole('heading', { name: '陳宥廷 Austin' });
  const firstRating = firstCard.getByText('9.8 / 10');
  const firstJobRow = firstCard
    .locator('div', {
      hasText: 'Senior Product Manager',
    })
    .last();
  const firstSessions = firstCard.getByText('已完成 18 場 1-on-1');

  await expect(firstName).toBeVisible();
  await expect(firstRating).toBeVisible();
  await expect(firstSessions).toBeVisible();
  await expect(firstCard).not.toContainText('12 則');
  await expect(firstCard).not.toContainText('★');
  await expect(firstCard).not.toContainText('⭐');

  const nameBox = await firstName.boundingBox();
  const ratingBox = await firstRating.boundingBox();
  const jobBox = await firstJobRow.boundingBox();
  const sessionsBox = await firstSessions.boundingBox();
  expect(nameBox).not.toBeNull();
  expect(ratingBox).not.toBeNull();
  expect(jobBox).not.toBeNull();
  expect(sessionsBox).not.toBeNull();
  expect(Math.abs(nameBox!.y - ratingBox!.y)).toBeLessThan(8);
  expect(ratingBox!.x).toBeGreaterThan(nameBox!.x + nameBox!.width);
  expect(jobBox!.y).toBeGreaterThan(nameBox!.y);
  expect(sessionsBox!.y).toBeGreaterThan(jobBox!.y);
  expect(Math.abs(jobBox!.x - sessionsBox!.x)).toBeLessThanOrEqual(2);

  // 2. 0 則評價隱藏評分、0 場隱藏已完成場次，且同列卡片維持等高
  const secondCard = cards.nth(1);
  await expect(secondCard.getByText('已完成 5 場 1-on-1')).toBeVisible();
  await expect(secondCard).not.toContainText('/ 10');

  const thirdCard = cards.nth(2);
  await expect(thirdCard).not.toContainText('/ 10');
  await expect(thirdCard).not.toContainText('已完成');

  const firstCardBox = await firstCard.boundingBox();
  const thirdCardBox = await thirdCard.boundingBox();
  expect(firstCardBox).not.toBeNull();
  expect(thirdCardBox).not.toBeNull();
  expect(
    Math.abs(firstCardBox!.height - thirdCardBox!.height)
  ).toBeLessThanOrEqual(1);

  await firstCard.evaluate((el) => {
    const top = el.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
  });
  await expect(firstRating).toBeVisible();
  await expect(firstSessions).toBeVisible();
  await captureEvidence(page, 'mentor-pool-card-rating-desktop');

  // 3. 手機版 RWD (AC 7.f)：長名字與分數同列，名字單行 Ellipsis 截斷、分數不換行
  await page.setViewportSize({ width: 375, height: 812 });
  const longNameCard = cards.nth(3);
  await longNameCard.evaluate((el) => {
    const top = el.getBoundingClientRect().top + window.scrollY - 88;
    window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
  });

  const longNameHeading = longNameCard.getByRole('heading', {
    name: '張哲瑋 Christopher Alexander Chang-Williams',
  });
  const longNameScore = longNameCard.getByText('9.6 / 10');
  const longNameSessions = longNameCard.getByText('已完成 12 場 1-on-1');

  await expect(longNameHeading).toBeVisible();
  await expect(longNameScore).toBeVisible();
  await expect(longNameSessions).toBeVisible();

  const mobileMetrics = await longNameHeading.evaluate((el) => {
    const style = window.getComputedStyle(el);
    return {
      overflow: style.overflow,
      textOverflow: style.textOverflow,
      whiteSpace: style.whiteSpace,
      isTruncated: el.scrollWidth > el.clientWidth,
    };
  });
  expect(mobileMetrics.overflow).toBe('hidden');
  expect(mobileMetrics.textOverflow).toBe('ellipsis');
  expect(mobileMetrics.whiteSpace).toBe('nowrap');
  expect(mobileMetrics.isTruncated).toBe(true);

  const mobileNameBox = await longNameHeading.boundingBox();
  const mobileScoreBox = await longNameScore.boundingBox();
  expect(mobileNameBox).not.toBeNull();
  expect(mobileScoreBox).not.toBeNull();
  expect(Math.abs(mobileNameBox!.y - mobileScoreBox!.y)).toBeLessThan(8);
  expect(mobileScoreBox!.height).toBeLessThanOrEqual(28);

  await captureEvidence(page, 'mentor-pool-card-rating-mobile');
});

test('帶 utm_* 追蹤參數進入搜尋並滾動分頁後，移除追蹤參數切回相同條件時命中正規化快取且保留原始代碼標籤置頂 (#886)', async ({
  page,
}) => {
  let frontendPageOneFetchCount = 0;

  const firstPage = Array.from({ length: PAGE_LIMIT }, (_, i) =>
    makeMentor(i + 1, {
      name: `Frontend Mentor ${i + 1}`,
      have_topic: ['職涯規劃'],
      have_skill: ['前端開發'],
    })
  );
  const secondPage = [
    makeMentor(10, {
      name: 'Frontend Mentor 10',
      have_topic: ['職涯規劃'],
      have_skill: ['前端開發'],
    }),
  ];

  await page.route(/\/v1\/mentors(\?|$)/, (route, request) => {
    const url = new URL(request.url());
    const keyword = url.searchParams.get('search_pattern');
    const skill = url.searchParams.get('filter_skills');
    const cursor = url.searchParams.get('cursor');

    if (skill) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          mentorResponse([
            makeMentor(50, {
              name: 'Skill Matched Mentor',
              have_topic: ['職涯規劃'],
              have_skill: [skill],
            }),
          ])
        ),
      });
    }

    if (keyword === '前端工程師') {
      if (cursor === 'opaque-fe-page-2') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mentorResponse(secondPage, null)),
        });
      }
      frontendPageOneFetchCount += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mentorResponse(firstPage, 'opaque-fe-page-2')),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mentorResponse([makeMentor(99)])),
    });
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(
    '/mentor-pool?utm_source=discord&utm_medium=social&q=%E5%89%8D%E7%AB%AF%E5%B7%A5%E7%A8%8B%E5%B8%AB'
  );
  await expect(page.locator('article')).toHaveCount(PAGE_LIMIT);
  expect(frontendPageOneFetchCount).toBeGreaterThanOrEqual(1);
  expect(frontendPageOneFetchCount).toBeLessThanOrEqual(2);
  const fetchCountAfterInitialMount = frontendPageOneFetchCount;

  // 1. 滾動到底部觸發 mentorPoolReadModel.loadMore 載入第 2 頁（共 10 筆）
  const loadMorePromise = page.waitForResponse(
    (res) =>
      /\/v1\/mentors/.test(res.url()) &&
      new URL(res.url()).searchParams.get('cursor') === 'opaque-fe-page-2'
  );
  await page.locator('article').last().scrollIntoViewIfNeeded();
  await loadMorePromise;

  await expect(page.locator('article')).toHaveCount(PAGE_LIMIT + 1);
  await expect(page.getByText(`找到 ${PAGE_LIMIT + 1} 位導師`)).toBeVisible();

  // 2. 套用技能篩選：驗證 MentorCardList 以原始 subject_group 代碼置頂再解析顯示名稱
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.getByRole('button', { name: /篩選/ }).click();
  await page.getByRole('combobox').first().click();
  const firstSkillOption = page.getByRole('option').first();
  const selectedSkillLabel =
    (await firstSkillOption.textContent())?.trim() ?? '';
  await firstSkillOption.click();

  const skillResponsePromise = page.waitForResponse(
    (res) =>
      /\/v1\/mentors/.test(res.url()) &&
      Boolean(new URL(res.url()).searchParams.get('filter_skills'))
  );
  await page.getByRole('button', { name: '套用' }).click();
  await skillResponsePromise;

  await expect(page.locator('article')).toHaveCount(1);
  if (selectedSkillLabel) {
    await expect(
      page
        .locator('article')
        .first()
        .getByTestId('display-container')
        .locator('> div')
        .first()
    ).toHaveText(selectedSkillLabel);
  }
  await captureEvidence(page, 'mentor-pool-code-prioritized-filter');

  // 3. 透過 Header 導覽切回乾淨的 /mentor-pool（移除 utm_*），再點擊「前端工程師」熱門標籤：
  // 必須直接命中先前帶 utm_* 建立的正規化快取（保留 10 筆分頁資料，不重複發送第 1 頁 API）
  await page.locator('header').getByRole('link', { name: '尋找導師' }).click();
  await expect(page).toHaveURL(/\/mentor-pool$/);

  await page
    .getByLabel('熱門職位')
    .getByRole('button', { name: '前端工程師' })
    .click();
  await expect(page).toHaveURL(
    /\/mentor-pool\?q=%E5%89%8D%E7%AB%AF%E5%B7%A5%E7%A8%8B%E5%B8%AB$/
  );
  await expect(page.locator('article')).toHaveCount(PAGE_LIMIT + 1);
  await expect(page.getByText(`找到 ${PAGE_LIMIT + 1} 位導師`)).toBeVisible();
  expect(frontendPageOneFetchCount).toBe(fetchCountAfterInitialMount);

  await captureEvidence(page, 'mentor-pool-canonical-cache-hit');
});
