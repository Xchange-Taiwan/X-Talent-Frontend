import { expect, test } from '@playwright/test';

import { blockUnmockedExternalApi } from '../../helpers/route';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MOCK_INTERESTS = {
  code: '0',
  msg: 'ok',
  data: { interests: [], language: 'zh_TW' },
};

function makeMentor(id: number) {
  return {
    user_id: id,
    name: `Mentor ${id}`,
    avatar: '',
    job_title: 'Software Engineer',
    company: `Company ${id}`,
    years_of_experience: 'THREE_TO_FIVE_YEARS',
    location: 'TWN',
    linkedin_profile: '',
    interested_positions: [],
    skills: [],
    topics: [],
    industry: 'Technology',
    language: 'zh_TW',
    personal_statement: `Personal statement ${id}`,
    about: '',
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
  // Abort any external API call not explicitly mocked above so tests fail fast
  // instead of waiting for the real AWS endpoint to time out.
  await blockUnmockedExternalApi(page);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

test('page loads → mentor cards are displayed', async ({ page }) => {
  // The initial listing is server-rendered in MentorPoolWithData (RSC) —
  // page.route() only intercepts browser-initiated requests, so it can't mock
  // this fetch. Assert internal consistency (heading count matches rendered
  // cards) against whatever the real dev backend returns, instead of a
  // hardcoded mock-driven count.
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
    const data = keyword
      ? [makeMentor(10), makeMentor(11)]
      : [makeMentor(1), makeMentor(2), makeMentor(3)];
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mentorResponse(data)),
    });
  });

  // Initial render comes from the unmocked SSR fetch — only wait for cards to
  // exist, then verify the mocked client-side search actually replaces them.
  await page.goto('/mentor-pool');
  await expect(page.locator('article').first()).toBeVisible({
    timeout: 15_000,
  });

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

  // Initial render comes from the unmocked SSR fetch — only wait for cards to
  // exist, then verify the mocked client-side filter actually replaces them.
  await page.goto('/mentor-pool');
  await expect(page.locator('article').first()).toBeVisible({
    timeout: 15_000,
  });

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
    const data = keyword ? [] : [makeMentor(1)];
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mentorResponse(data)),
    });
  });

  // Initial render comes from the unmocked SSR fetch — only wait for a card
  // to exist, then verify the mocked no-results search actually clears it.
  await page.goto('/mentor-pool');
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
