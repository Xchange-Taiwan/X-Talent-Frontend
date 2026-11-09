import { expect, Locator, Page, test } from '@playwright/test';

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
    job_title: string;
    company: string;
    about: string;
    skills: string[];
    topics: string[];
    have_skill: string[];
    have_topic: string[];
  }> = {}
) {
  return {
    user_id: id,
    name: `Mentor ${id}`,
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
  };
}

function mentorResponse(mentors: ReturnType<typeof makeMentor>[]) {
  return { code: '0', msg: 'ok', data: { mentors, next_id: 0 } };
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
  // Abort any external API call not explicitly mocked above so tests fail fast
  // instead of waiting for the real AWS endpoint to time out.
  await blockUnmockedExternalApi(page);
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
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mentorResponse(data)),
    });
  });

  // Force the client-side (mockable) fetch path — via any search condition —
  // instead of the unmocked SSR listing, so mentors.length is a deterministic
  // multiple of PAGE_LIMIT and container.tsx's scroll-trigger guard
  // (mentors.length % PAGE_LIMIT === 0) reliably fires fetchMoreMentors.
  await page.goto('/mentor-pool?q=test');
  await expect(page.locator('article')).toHaveCount(PAGE_LIMIT);

  // Bring the last card into the viewport — IntersectionObserver fires and
  // triggers fetchMoreMentors (guard: mentors.length % PAGE_LIMIT === 0)
  const loadMorePromise = page.waitForResponse(/\/v1\/mentors/);
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
  await firstCombobox.click();

  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible();
  await expect(listbox).toHaveAttribute('data-side', 'bottom');

  const triggerBox = await firstCombobox.boundingBox();
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
