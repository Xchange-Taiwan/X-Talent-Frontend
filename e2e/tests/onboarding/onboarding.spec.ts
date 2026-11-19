import { expect, Page, test } from '@playwright/test';

import { captureEvidence } from '../../helpers/evidence';
import { mockApiRoute } from '../../helpers/route';
import { seedMockAuthSession } from '../../helpers/session';

// ─── Mock payloads ───────────────────────────────────────────────────────────

const MOCK_COUNTRIES = { code: '0', msg: 'ok', data: { TWN: '台灣' } };

const MOCK_INDUSTRIES = {
  code: '0',
  msg: 'ok',
  data: {
    professions: [
      {
        id: 1,
        subject_group: 'TECH',
        subject: '科技業',
        category: 'INDUSTRY',
        language: 'zh_TW',
        profession_metadata: { desc: '', icon: '' },
      },
    ],
  },
};

function makeInterestBody(subject: string) {
  return {
    code: '0',
    msg: 'ok',
    data: {
      interests: [
        {
          id: 1,
          subject_group: 'TEST_GROUP',
          subject,
          category: 'TEST',
          language: 'zh_TW',
          desc: { icon: '', desc: '' },
        },
      ],
      language: 'zh_TW',
    },
  };
}

const MOCK_USER_PROFILE = {
  code: '0',
  msg: 'ok',
  data: {
    user_id: 1,
    name: 'Test User',
    avatar: '',
    onboarding: true,
    is_mentor: false,
    job_title: '',
    company: '',
    years_of_experience: 'BELOW_ONE_YEAR',
    location: 'TWN',
    language: 'zh_TW',
    interested_positions: { interests: [], language: null },
    skills: { interests: [], language: null },
    topics: { interests: [], language: null },
    industry: {
      id: 0,
      category: '',
      language: 'zh_TW',
      subject_group: '',
      subject: '',
      profession_metadata: { desc: '', icon: '' },
    },
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Mock the five option-list APIs so dropdowns and checkbox lists are populated
 * without a real backend.
 */
const MOCK_TAG_CATALOG = {
  code: '0',
  msg: 'ok',
  data: {
    language: 'zh_TW',
    catalogs: {
      position: {
        kind: 'position',
        groups: [
          {
            language: 'zh_TW',
            subject_group: 'software_dev',
            subject: '軟體開發',
            leaves: [
              {
                tag_id: 1,
                language: 'zh_TW',
                subject_group: 'frontend_engineer',
                subject: '前端工程師',
              },
            ],
          },
        ],
      },
      skill: {
        kind: 'skill',
        groups: [
          {
            language: 'zh_TW',
            subject_group: 'software_dev',
            subject: '軟體開發',
            leaves: [
              {
                tag_id: 2,
                language: 'zh_TW',
                subject_group: 'react',
                subject: 'React',
              },
            ],
          },
        ],
      },
      topic: {
        kind: 'topic',
        groups: [
          {
            language: 'zh_TW',
            subject_group: 'career',
            subject: '職涯發展',
            leaves: [
              {
                tag_id: 3,
                language: 'zh_TW',
                subject_group: 'resume',
                subject: '履歷健檢',
              },
            ],
          },
        ],
      },
      industry: {
        kind: 'industry',
        groups: [
          {
            language: 'zh_TW',
            subject_group: 'TECH',
            subject: '科技業',
            leaves: [],
          },
        ],
      },
    },
  },
};

async function setupPageMocks(page: Page): Promise<void> {
  await mockApiRoute(page, /\/v1\/users\/zh_TW\/countries/, {
    body: MOCK_COUNTRIES,
  });
  await mockApiRoute(page, /\/v1\/users\/zh_TW\/industries/, {
    body: MOCK_INDUSTRIES,
  });
  await mockApiRoute(page, /\/v1\/users\/zh_TW\/tags\/catalog/, {
    body: MOCK_TAG_CATALOG,
  });

  // Three interest types share one endpoint; differentiate by query param.
  await page.route(/\/v1\/users\/zh_TW\/interests/, (route) => {
    const url = route.request().url();
    if (url.includes('INTERESTED_POSITION')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeInterestBody('測試職位')),
      });
    }
    if (url.includes('SKILL')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeInterestBody('測試技能')),
      });
    }
    if (url.includes('TOPIC')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeInterestBody('測試主題')),
      });
    }
    return route.continue();
  });
}

/**
 * Seed the onboarding session (SSR JWE cookie + stateful CSR /api/auth/session)
 * and option-list mocks, then navigate to `/auth/onboarding`.
 */
async function gotoOnboarding(page: Page): Promise<void> {
  await seedMockAuthSession(page, {
    id: '1',
    name: 'Test User',
    onBoarding: false,
    isMentor: false,
  });
  await setupPageMocks(page);
  await page.goto('/auth/onboarding');
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('submit single-page onboarding with empty name → inline validation error shown (#836)', async ({
  page,
}) => {
  await gotoOnboarding(page);

  const nameInput = page.locator('input[name="name"]');
  await expect(nameInput).toHaveValue('Test User');
  await nameInput.fill('');
  await page.getByRole('button', { name: '提交' }).click();

  await expect(page.getByText('請輸入姓名')).toBeVisible();
});

test('complete single-page Mentee onboarding → saves default_1 avatar & single position and redirects to /profile/1 (#836)', async ({
  page,
}) => {
  await gotoOnboarding(page);

  await mockApiRoute(page, /\/v1\/mentors\/[^/]+\/zh_TW\/profile/, {
    body: MOCK_USER_PROFILE,
  });

  let capturedOnboardingPut: Record<string, unknown> | null = null;
  await page.route(/\/v1\/mentors\/[^/]+\/profile$/, (route) => {
    if (route.request().method() === 'PUT') {
      capturedOnboardingPut = route.request().postDataJSON() as Record<
        string,
        unknown
      >;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: '0', msg: 'ok', data: null }),
      });
    }
    return route.fallback();
  });

  await page.fill('input[name="name"]', 'Test User');
  await page.getByText('請選擇您的年資區間').click();
  await page.getByRole('option', { name: '1 年以下' }).click();

  // Select 1 interested position via CompactCategoryPicker
  await page.getByRole('button', { name: '新增職位' }).click();
  const posPopover = page.locator('[data-radix-popper-content-wrapper]');
  await posPopover.locator('.max-h-80 button[type="button"]').first().click();
  await posPopover.locator('[role="checkbox"]').first().click();
  await page.keyboard.press('Escape');
  await expect(page.getByText('已選 1 / 1', { exact: true })).toBeVisible();

  // Select 1 skill
  await page.getByRole('button', { name: '新增技能' }).click();
  const skillPopover = page.locator('[data-radix-popper-content-wrapper]');
  await skillPopover.locator('.max-h-80 button[type="button"]').first().click();
  await skillPopover.locator('[role="checkbox"]').first().click();
  await page.keyboard.press('Escape');

  // Select 1 topic
  await page.getByRole('button', { name: '新增主題' }).click();
  const topicPopover = page.locator('[data-radix-popper-content-wrapper]');
  await topicPopover.locator('.max-h-80 button[type="button"]').first().click();
  await topicPopover.locator('[role="checkbox"]').first().click();
  await page.keyboard.press('Escape');

  await captureEvidence(page, 'onboarding-single-page-mentee', {
    fullPage: true,
  });
  await page.getByRole('button', { name: '提交' }).click();

  await expect(page).toHaveURL('/profile/1', { timeout: 35_000 });
  expect(
    Array.isArray(capturedOnboardingPut?.['want_position']) &&
      (capturedOnboardingPut?.['want_position'] as unknown[]).length === 1
  ).toBe(true);
});

test('switch between Mentee and Mentor role on single-page onboarding → enforces Mentor required fields (#836)', async ({
  page,
}) => {
  await gotoOnboarding(page);

  await page.getByRole('button', { name: '雙軌身分說明' }).click();
  await expect(
    page.getByText(/同一個帳號可同時作為 Mentee 探索職涯/)
  ).toBeVisible();
  await captureEvidence(page, 'onboarding-single-page-popover');
  await page.keyboard.press('Escape');

  await page.getByTestId('onboarding-role-mentor').click();
  await expect(page.getByText('我已閱讀並同意導師規範')).toBeVisible();
  await expect(
    page.getByRole('button', { name: '新增工作經驗' })
  ).toBeVisible();
  await captureEvidence(page, 'onboarding-single-page-mentor', {
    fullPage: true,
  });

  // Also capture 390x844 mobile layout for single-page onboarding
  await page.setViewportSize({ width: 390, height: 844 });
  await captureEvidence(page, 'onboarding-single-page-mentor-mobile');
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.getByRole('button', { name: '提交' }).click();
  await expect(page.getByText('請先閱讀並勾選同意導師規範')).toBeVisible();
  await expect(
    page.getByText('請上傳真人照片，預設頭像僅供預覽')
  ).toBeVisible();
});

test('landing page renders settled A-1 dual-track growth banner between role benefits and testimonials (#836)', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');

  const section = page.getByTestId('homepage-dual-track');
  await section.scrollIntoViewIfNeeded();
  await expect(
    section.getByRole('heading', { name: '一個帳號，雙軌成長' })
  ).toBeVisible();
  await expect(page.getByTestId('homepage-cta-dual-track')).toBeVisible({
    timeout: 15_000,
  });
  await captureEvidence(page, 'landing-dual-track-a1-settled');
});

test('頭像預覽 URL 已含 query string 時以 &cb= 附加快取參數而非重複 ?cb= (#857)', async ({
  page,
}) => {
  const versionedAvatarUrl =
    'https://x-career-multimedia.s3.ap-northeast-1.amazonaws.com/avatars/1/cropped-avatar.png?v=1700000000';

  await seedMockAuthSession(page, {
    id: '1',
    name: 'Test User',
    onBoarding: false,
    isMentor: false,
    avatar: versionedAvatarUrl,
    avatarUpdatedAt: 1700000456,
  });
  await setupPageMocks(page);

  await page.goto('/auth/onboarding');

  const avatarImg = page.getByRole('img', { name: 'Test User 的個人頭像' });
  await expect(avatarImg).toBeVisible();

  const srcAttr = (await avatarImg.getAttribute('src')) ?? '';
  const decodedSrc = decodeURIComponent(srcAttr);
  expect(decodedSrc).toContain(
    'https://x-career-multimedia.s3.ap-northeast-1.amazonaws.com/avatars/1/cropped-avatar.png?v=1700000000&cb=1700000456'
  );
  expect(decodedSrc).not.toContain('?v=1700000000?cb=');
});

test('GET /api/tags/zh_TW/catalog same-origin proxy returns populated want_position for PR preview CORS fallback (#1336)', async ({
  request,
}) => {
  const res = await request.get('/api/tags/zh_TW/catalog');
  expect(res.status()).toBe(200);
  const body = (await res.json()) as {
    want_position?: Array<{ leaves?: Array<{ subject_group?: string }> }>;
  };
  expect(Array.isArray(body.want_position)).toBe(true);
  expect((body.want_position ?? []).length).toBeGreaterThan(0);
});
