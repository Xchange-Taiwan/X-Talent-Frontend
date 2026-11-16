import { expect, test } from '@playwright/test';

import { mockApiRoute } from '../../helpers/route';
import { seedMockAuthSession } from '../../helpers/session';

const REAL_MENTOR_ID = '7482008160728084';
const MENTEE_ID = '999991';
const ok = (data: unknown) => ({ body: { code: '0', msg: 'ok', data } });

test('home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL('/');
  await expect(page.locator('body')).toBeVisible();
});

test('locks light mode rendering via darkreader-lock meta and color-scheme: light under OS dark mode (#861)', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');

  await expect(page.locator('head meta[name="darkreader-lock"]')).toHaveCount(
    1
  );
  await expect(page.locator('head meta[name="color-scheme"]')).toHaveAttribute(
    'content',
    'light'
  );

  const computedStyles = await page.evaluate(() => {
    const htmlStyle = window.getComputedStyle(document.documentElement);
    const bodyStyle = window.getComputedStyle(document.body);
    return {
      htmlColorScheme: htmlStyle.colorScheme,
      bodyBackgroundColor: bodyStyle.backgroundColor,
    };
  });

  expect(computedStyles.htmlColorScheme).toBe('light');
  expect(computedStyles.bodyBackgroundColor).toBe('rgb(255, 255, 255)');
});

test.describe('首頁 CTA 按鈕依身分顯示與導向 (#709)', () => {
  test('訪客造訪首頁 → 3 顆 CTA 導向 /auth/signup', async ({ page }) => {
    await page.goto('/');

    for (const [id, text] of [
      ['homepage-cta-hero', '加入 X-Talent'],
      ['homepage-cta-role', '成為 Mentor/Mentee'],
      ['homepage-cta-closing', '加入 X-Talent'],
    ] as const) {
      const cta = page.getByTestId(id);
      await expect(cta).toHaveText(text);
      await expect(cta).toHaveAttribute('href', '/auth/signup');
    }

    await page.getByTestId('homepage-cta-hero').click();
    await expect(page).toHaveURL(/\/auth\/signup$/);
  });

  test('Mentee 造訪首頁 → Hero/Footer 導向 /mentor-pool，段落 CTA 導向 Mentor 註冊頁', async ({
    page,
  }) => {
    await mockApiRoute(
      page,
      /\/v1\/users\/.*\/notifications\/unread-count/,
      ok({ unread_count: 0 })
    );
    await seedMockAuthSession(page, {
      id: MENTEE_ID,
      name: 'Test User',
      isMentor: false,
      jobTitle: 'Engineer',
      company: 'XChange',
    });
    await page.goto('/');

    await expect(page.getByTestId('homepage-cta-hero')).toHaveAttribute(
      'href',
      '/mentor-pool'
    );
    await expect(page.getByTestId('homepage-cta-role')).toHaveAttribute(
      'href',
      `/profile/${MENTEE_ID}/edit?mentor-onboarding=true`
    );
    const closingCta = page.getByTestId('homepage-cta-closing');
    await expect(closingCta).toHaveText('尋找導師');
    await closingCta.click();
    await expect(page).toHaveURL(/\/mentor-pool$/);
  });

  test('Mentor 造訪首頁 → 點擊開放預約時段導向個人頁並自動開啟時段管理彈窗', async ({
    page,
  }) => {
    const empty = { groups: [] };
    await mockApiRoute(
      page,
      /\/v1\/users\/.*\/notifications\/unread-count/,
      ok({ unread_count: 0 })
    );
    await seedMockAuthSession(page, {
      id: REAL_MENTOR_ID,
      name: 'Test User',
      isMentor: true,
      jobTitle: 'Engineer',
      company: 'XChange',
    });
    await mockApiRoute(
      page,
      new RegExp(`/v1/(?:mentors|users)/${REAL_MENTOR_ID}/zh_TW/profile`),
      ok({
        user_id: Number(REAL_MENTOR_ID),
        name: 'Test Mentor',
        avatar: '',
        onboarding: true,
        is_mentor: true,
        job_title: 'Senior Engineer',
        company: 'XChange',
        years_of_experience: 'THREE_TO_FIVE',
        location: 'TWN',
        personal_statement: 'Bio',
        about: 'About',
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
        expertises: { professions: [], language: 'zh_TW' },
        experiences: [],
      })
    );
    await mockApiRoute(
      page,
      /\/v1\/users\/zh_TW\/tags\/catalog/,
      ok({
        catalogs: {
          skill: empty,
          topic: empty,
          position: empty,
          industry: empty,
        },
      })
    );
    await mockApiRoute(
      page,
      new RegExp(`/v1/mentors/${REAL_MENTOR_ID}/schedule/y/\\d+/m/\\d+`),
      ok({ segments: [] })
    );
    await mockApiRoute(
      page,
      new RegExp(`/v1/users/${REAL_MENTOR_ID}/reservations`),
      ok({ reservations: [], next_cursor: null })
    );

    await page.goto('/');

    const roleCta = page.getByTestId('homepage-cta-role');
    await expect(roleCta).toHaveText('開放預約時段');
    await expect(roleCta).toHaveAttribute(
      'href',
      `/profile/${REAL_MENTOR_ID}?open-schedule=true`
    );

    await roleCta.click();
    await expect(page).toHaveURL(new RegExp(`/profile/${REAL_MENTOR_ID}`));
    await expect(
      page.getByRole('dialog', { name: '設定可預約時段' })
    ).toBeVisible({ timeout: 15_000 });
  });
});

test('mentor pool page is accessible without authentication', async ({
  page,
}) => {
  await page.goto('/mentor-pool');
  await expect(page).toHaveURL('/mentor-pool');
  await expect(page.locator('body')).toBeVisible();
});

test('about page is accessible without authentication and renders main content (#711)', async ({
  page,
}) => {
  await page.goto('/about');
  await expect(page).toHaveURL('/about');

  await expect(
    page.getByRole('heading', { level: 1, name: /關於\s*X-Talent/ })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'X-Talent 的起心動念' })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'X-Talent 的核心價值' })
  ).toBeVisible();
  await expect(
    page.getByText(/站在前輩的肩膀上，運用最少的時間，獲取最多的經驗/)
  ).toBeVisible();
});

test('privacy policy page is accessible without authentication and renders main content', async ({
  page,
}) => {
  await page.goto('/privacy');
  await expect(page).toHaveURL('/privacy');

  await expect(page.locator('#main-content')).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Privacy Policy' })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: '1. Information We Collect' })
  ).toBeVisible();
});

test('terms of service page is accessible without authentication and renders main content', async ({
  page,
}) => {
  await page.goto('/terms');
  await expect(page).toHaveURL('/terms');

  await expect(page.locator('#main-content')).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Terms of Service' })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: '1. Use of the Platform' })
  ).toBeVisible();
});
