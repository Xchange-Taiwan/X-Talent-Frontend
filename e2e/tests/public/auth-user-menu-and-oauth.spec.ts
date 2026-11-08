import { expect, Page, test } from '@playwright/test';

import { mockApiRoute } from '../../helpers/route';
import { setSignedSessionCookie } from '../../helpers/session';

const USER_ID = '999998';

async function setupLoggedInUser(page: Page): Promise<void> {
  await setSignedSessionCookie(page, {
    id: USER_ID,
    name: 'Alice Chen',
    onBoarding: true,
    isMentor: true,
    jobTitle: 'Staff Engineer',
    company: 'XChange',
    personalLinks: [
      {
        platform: 'linkedin',
        url: 'https://www.linkedin.com/in/alicechen',
      },
    ],
    token: 'mock-access-token',
  });
}

/**
 * Intercept the Next.js Server Action POST (`googleCallback`) on
 * `/auth/google/callback/redirect` by letting Next.js produce its native
 * RSC Flight envelope via `route.fetch()` and swapping the action return
 * payload on row `1:` with `mockPayload`.
 */
async function mockGoogleCallbackServerAction(
  page: Page,
  mockPayload: Record<string, unknown>
): Promise<void> {
  await page.route(/\/auth\/google\/callback\/redirect/, async (route) => {
    const req = route.request();
    if (req.method() === 'POST' && req.headers()['next-action']) {
      const upstream = await route.fetch();
      const bodyText = await upstream.text();
      const patchedLines = bodyText
        .split('\n')
        .map((line) =>
          /^1:(?:E)?\{/.test(line) ? `1:${JSON.stringify(mockPayload)}` : line
        );
      return route.fulfill({
        status: 200,
        headers: upstream.headers(),
        body: patchedLines.join('\n'),
      });
    }
    return route.continue();
  });
}

test.describe('UserDropdown (Share Profile & Logout) & Google OAuth Callback E2E (#791)', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoute(page, /\/v1\/users\/.*\/notifications\/unread-count/, {
      body: { code: '0', msg: 'ok', data: { unread_count: 0 } },
    });
  });

  test('用戶選單點擊「分享個人頁面」→ 開啟 ShareProfileDialog 顯示姓名、職稱、社群連結並可複製個人頁網址', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await setupLoggedInUser(page);

    await page.goto('/about');

    const menuTrigger = page.getByRole('button', { name: '開啟用戶選單' });
    await expect(menuTrigger).toBeVisible({ timeout: 15_000 });
    await menuTrigger.click();

    await expect(page.getByText('Alice Chen')).toBeVisible();
    await expect(page.getByText('Staff Engineer at XChange')).toBeVisible();

    await page.getByRole('menuitem', { name: '分享個人頁面' }).click();

    const shareDialog = page.getByRole('dialog', { name: '分享個人頁面' });
    await expect(shareDialog).toBeVisible();
    await expect(shareDialog.getByText('Alice Chen')).toBeVisible();
    await expect(
      shareDialog.getByText('Staff Engineer at XChange')
    ).toBeVisible();
    await expect(
      shareDialog.locator('a[href="https://www.linkedin.com/in/alicechen"]')
    ).toBeVisible();

    const linkInput = shareDialog.locator('#share-profile-link');
    await expect(linkInput).toHaveValue(new RegExp(`/profile/${USER_ID}$`), {
      timeout: 10_000,
    });

    const copyBtn = shareDialog.getByRole('button', {
      name: '複製',
      exact: true,
    });
    await copyBtn.click();

    await expect(
      shareDialog.getByRole('button', { name: '已複製', exact: true })
    ).toBeVisible();

    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText()
    );
    expect(clipboardText).toMatch(new RegExp(`/profile/${USER_ID}$`));
  });

  test('用戶選單點擊「登出」→ 呼叫 /api/auth/backend-logout、Header 恢復未登入狀態，且造訪受保護路由重導向至 /auth/signin', async ({
    page,
  }) => {
    await setupLoggedInUser(page);

    let backendLogoutCalled = false;
    await page.route(/\/api\/auth\/backend-logout/, async (route) => {
      if (route.request().method() === 'POST') {
        backendLogoutCalled = true;
        return route.fulfill({ status: 204, body: '' });
      }
      return route.continue();
    });

    await page.goto('/about');

    const menuTrigger = page.getByRole('button', { name: '開啟用戶選單' });
    await expect(menuTrigger).toBeVisible({ timeout: 15_000 });
    await menuTrigger.click();

    await page.getByRole('menuitem', { name: '登出' }).click();

    await expect.poll(() => backendLogoutCalled).toBe(true);

    // Header should return to guest state (no user menu button, sign-in link visible)
    await expect(menuTrigger).toBeHidden({ timeout: 15_000 });
    await expect(
      page
        .getByTestId('desktop-header-right')
        .getByRole('link', { name: '登入' })
    ).toBeVisible();

    // Wait for NextAuth signOut() to finish clearing the session cookie before
    // navigating, so page.goto() does not abort the in-flight POST /api/auth/signout.
    await expect
      .poll(
        async () => {
          const cookies = await page.context().cookies();
          return cookies.some(
            (c) =>
              c.name === 'next-auth.session-token' ||
              c.name === '__Secure-next-auth.session-token'
          );
        },
        { timeout: 15_000 }
      )
      .toBe(false);

    // Navigating to a protected route should redirect to /auth/signin
    await page.goto('/reservation/mentee');
    await expect(page).toHaveURL(/\/auth\/signin/, { timeout: 15_000 });
  });

  test('造訪 /auth/google/callback/redirect 缺少 code/state 參數 → 顯示錯誤 Toast 並退回 /auth/signin', async ({
    page,
  }) => {
    await page.goto('/auth/google/callback/redirect');

    await expect(
      page.getByText('Missing Google OAuth parameters', { exact: true })
    ).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL('/auth/signin', { timeout: 15_000 });
  });

  test('造訪 /auth/google/callback/redirect 帶入 SIGNUP 回應 → 寫入 sessionStorage email 並導向 /auth/email-verify', async ({
    page,
  }) => {
    await mockGoogleCallbackServerAction(page, {
      code: '0',
      msg: 'ok',
      data: {
        auth_type: 'SIGNUP',
        auth: {
          email: 'new-oauth-user@example.com',
          user_id: 777,
          token: '',
        },
        user: null,
      },
    });

    await page.goto(
      '/auth/google/callback/redirect?code=mock-signup-code&state=mock-state'
    );

    await expect(page).toHaveURL('/auth/email-verify', { timeout: 15_000 });
    const storedEmail = await page.evaluate(() =>
      sessionStorage.getItem('email')
    );
    expect(storedEmail).toBe('new-oauth-user@example.com');
  });

  test('造訪 /auth/google/callback/redirect 帶入 LOGIN (onboarding=false) → 完成登入並導向 /auth/onboarding', async ({
    page,
  }) => {
    await mockGoogleCallbackServerAction(page, {
      code: '0',
      msg: 'ok',
      data: {
        auth_type: 'LOGIN',
        auth: {
          email: 'mentee-onboarding@example.com',
          user_id: 888,
          token: 'mock-google-jwt-token',
        },
        user: {
          user_id: 888,
          name: 'New Google User',
          avatar: '',
          is_mentor: false,
          onboarding: false,
          job_title: '',
          company: '',
          experiences: [],
        },
      },
    });

    await page.goto(
      '/auth/google/callback/redirect?code=mock-login-new&state=mock-state'
    );

    await expect(page).toHaveURL('/auth/onboarding', { timeout: 15_000 });
  });

  test('造訪 /auth/google/callback/redirect 帶入 LOGIN (onboarding=true) → 完成登入並導向 /mentor-pool', async ({
    page,
  }) => {
    await mockGoogleCallbackServerAction(page, {
      code: '0',
      msg: 'ok',
      data: {
        auth_type: 'LOGIN',
        auth: {
          email: 'existing-google-user@example.com',
          user_id: 889,
          token: 'mock-google-jwt-token-2',
        },
        user: {
          user_id: 889,
          name: 'Existing Google User',
          avatar: '',
          is_mentor: false,
          onboarding: true,
          job_title: 'Product Manager',
          company: 'XChange',
          experiences: [],
        },
      },
    });

    await page.goto(
      '/auth/google/callback/redirect?code=mock-login-existing&state=mock-state'
    );

    await expect(page).toHaveURL('/mentor-pool', { timeout: 15_000 });
  });
});
