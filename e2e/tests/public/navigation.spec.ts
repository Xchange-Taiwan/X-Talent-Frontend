import { expect, test } from '@playwright/test';

import { mockApiRoute } from '../../helpers/route';
import { setSignedSessionCookie } from '../../helpers/session';

const REAL_MENTOR_ID = '7482008160728084';
const MENTEE_ID = '999991';

test('home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL('/');
  await expect(page.locator('body')).toBeVisible();
});

test.describe('首頁 CTA 按鈕依訪客 / Mentee / Mentor 身分顯示與導向 (#709)', () => {
  test('訪客造訪首頁 → Hero 與 Footer 前 CTA 顯示「加入 X-Talent」、段落 CTA 顯示「成為 Mentor/Mentee」且皆導向 /auth/signup', async ({
    page,
  }) => {
    await page.goto('/');

    const heroCta = page.getByTestId('homepage-cta-hero');
    const roleCta = page.getByTestId('homepage-cta-role');
    const closingCta = page.getByTestId('homepage-cta-closing');

    await expect(heroCta).toBeVisible();
    await expect(heroCta).toHaveText('加入 X-Talent');
    await expect(heroCta).toHaveAttribute('href', '/auth/signup');

    await expect(roleCta).toBeVisible();
    await expect(roleCta).toHaveText('成為 Mentor/Mentee');
    await expect(roleCta).toHaveAttribute('href', '/auth/signup');

    await expect(closingCta).toBeVisible();
    await expect(closingCta).toHaveText('加入 X-Talent');
    await expect(closingCta).toHaveAttribute('href', '/auth/signup');

    await heroCta.click();
    await expect(page).toHaveURL(/\/auth\/signup$/);
  });

  test('Mentee 造訪首頁 → Hero 與 Footer 前 CTA 顯示「尋找導師」導向 /mentor-pool，段落 CTA 顯示「成為 Mentor」導向 Mentor 註冊頁', async ({
    page,
  }) => {
    await mockApiRoute(page, /\/v1\/users\/.*\/notifications\/unread-count/, {
      body: { code: '0', msg: 'ok', data: { unread_count: 0 } },
    });

    await setSignedSessionCookie(page, {
      id: MENTEE_ID,
      name: 'Test Mentee',
      onBoarding: true,
      isMentor: false,
      jobTitle: 'Junior Developer',
      company: 'XChange',
      personalLinks: [],
      token: 'mock-mentee-token',
    });

    await page.goto('/');

    const heroCta = page.getByTestId('homepage-cta-hero');
    const roleCta = page.getByTestId('homepage-cta-role');
    const closingCta = page.getByTestId('homepage-cta-closing');

    await expect(heroCta).toBeVisible();
    await expect(heroCta).toHaveText('尋找導師');
    await expect(heroCta).toHaveAttribute('href', '/mentor-pool');

    await expect(roleCta).toBeVisible();
    await expect(roleCta).toHaveText('成為 Mentor');
    await expect(roleCta).toHaveAttribute(
      'href',
      `/profile/${MENTEE_ID}/edit?mentor-onboarding=true`
    );

    await expect(closingCta).toBeVisible();
    await expect(closingCta).toHaveText('尋找導師');
    await expect(closingCta).toHaveAttribute('href', '/mentor-pool');

    await closingCta.click();
    await expect(page).toHaveURL(/\/mentor-pool$/);
  });

  test('Mentor 造訪首頁 → Hero 與 Footer 前 CTA 顯示「尋找導師」，段落 CTA 顯示「開放預約時段」點擊後導向自己的導師頁面並自動開啟時段管理彈窗', async ({
    page,
  }) => {
    await mockApiRoute(page, /\/v1\/users\/.*\/notifications\/unread-count/, {
      body: { code: '0', msg: 'ok', data: { unread_count: 0 } },
    });
    await mockApiRoute(
      page,
      new RegExp(`/v1/(?:mentors|users)/${REAL_MENTOR_ID}/zh_TW/profile`),
      {
        body: {
          code: '0',
          msg: 'ok',
          data: {
            user_id: Number(REAL_MENTOR_ID),
            name: 'Test Mentor',
            avatar: '',
            onboarding: true,
            is_mentor: true,
            job_title: 'Senior Engineer',
            company: 'XChange',
            years_of_experience: 'THREE_TO_FIVE',
            location: 'TWN',
            personal_statement: 'Mentor bio',
            about: 'Mentor about',
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
          },
        },
      }
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
      new RegExp(`/v1/mentors/${REAL_MENTOR_ID}/schedule/y/\\d+/m/\\d+`),
      {
        body: {
          code: '0',
          msg: 'ok',
          data: { segments: [] },
        },
      }
    );
    await mockApiRoute(
      page,
      new RegExp(`/v1/users/${REAL_MENTOR_ID}/reservations`),
      {
        body: {
          code: '0',
          msg: 'ok',
          data: { reservations: [], next_cursor: null },
        },
      }
    );

    await setSignedSessionCookie(page, {
      id: REAL_MENTOR_ID,
      name: 'Test Mentor',
      onBoarding: true,
      isMentor: true,
      jobTitle: 'Senior Engineer',
      company: 'XChange',
      personalLinks: [],
      token: 'mock-mentor-token',
    });

    await page.goto('/');

    const heroCta = page.getByTestId('homepage-cta-hero');
    const roleCta = page.getByTestId('homepage-cta-role');
    const closingCta = page.getByTestId('homepage-cta-closing');

    await expect(heroCta).toBeVisible();
    await expect(heroCta).toHaveText('尋找導師');
    await expect(heroCta).toHaveAttribute('href', '/mentor-pool');

    await expect(closingCta).toBeVisible();
    await expect(closingCta).toHaveText('尋找導師');
    await expect(closingCta).toHaveAttribute('href', '/mentor-pool');

    await expect(roleCta).toBeVisible();
    await expect(roleCta).toHaveText('開放預約時段');
    await expect(roleCta).toHaveAttribute(
      'href',
      `/profile/${REAL_MENTOR_ID}?open-schedule=true`
    );

    await roleCta.click();

    await expect(page).toHaveURL(new RegExp(`/profile/${REAL_MENTOR_ID}`));
    const scheduleDialog = page.getByRole('dialog', { name: '設定可預約時段' });
    await expect(scheduleDialog).toBeVisible({ timeout: 15_000 });
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
