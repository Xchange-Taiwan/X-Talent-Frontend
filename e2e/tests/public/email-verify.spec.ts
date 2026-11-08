import { expect, test } from '@playwright/test';

import { mockApiRoute } from '../../helpers/route';

test.describe('Email Verification Flow', () => {
  test('visit /auth/email-verified with a valid token → calls confirmRegister successfully and displays success status', async ({
    page,
  }) => {
    // Mock the confirm endpoint to succeed
    await mockApiRoute(page, /\/v1\/auth\/signup\/confirm/, {
      body: { code: '0', msg: 'ok', data: null },
    });

    await page.goto('/auth/email-verified?token=test-valid-token');

    // Page should display success heading
    await expect(page.getByRole('heading', { name: '驗證成功' })).toBeVisible();
    await expect(
      page.getByText(
        '你的帳號已完成註冊。現在可以開始建立你的個人頁面和尋找 Mentors 了！'
      )
    ).toBeVisible();

    // Verify the button text and redirect
    const setupProfileBtn = page.getByRole('button', { name: '設定個人資訊' });
    await expect(setupProfileBtn).toBeVisible();

    await setupProfileBtn.click();
    await expect(page).toHaveURL('/auth/signin', { timeout: 10_000 });
  });

  test('visit /auth/email-verified without a token → displays error state (does not call API)', async ({
    page,
  }) => {
    // Go directly to email-verified page without token query param
    await page.goto('/auth/email-verified');

    // Toast should show "缺少驗證 Token"
    await expect(
      page.getByText('缺少驗證 Token，請重新申請驗證信。', { exact: true })
    ).toBeVisible();

    // The page should transition to failure/error state and show failure heading
    await expect(page.getByRole('heading', { name: '驗證失敗' })).toBeVisible();
    await expect(
      page.getByText('您的驗證連結已失效，請重新輸入Email再次驗證')
    ).toBeVisible();

    const retryBtn = page.getByRole('button', { name: '返回重試' });
    await expect(retryBtn).toBeVisible();

    await retryBtn.click();
    await expect(page).toHaveURL('/auth/signup', { timeout: 10_000 });
  });

  test('visit /auth/email-verified with invalid or expired token → displays error state', async ({
    page,
  }) => {
    // Mock the confirm endpoint to fail
    await mockApiRoute(page, /\/v1\/auth\/signup\/confirm/, {
      status: 400,
      body: { code: '400', msg: '驗證連結已失效' },
    });

    await page.goto('/auth/email-verified?token=expired-token');

    // Toast should show the error message from API
    await expect(
      page.getByText('驗證連結已失效', { exact: true })
    ).toBeVisible();

    // The page should transition to failure/error state and show failure heading
    await expect(page.getByRole('heading', { name: '驗證失敗' })).toBeVisible();
    await expect(
      page.getByText('您的驗證連結已失效，請重新輸入Email再次驗證')
    ).toBeVisible();

    const retryBtn = page.getByRole('button', { name: '返回重試' });
    await expect(retryBtn).toBeVisible();

    await retryBtn.click();
    await expect(page).toHaveURL('/auth/signup', { timeout: 10_000 });
  });

  test('visit /auth/email-verify page and click resend → calls resendVerificationEmail and shows success toast', async ({
    page,
  }) => {
    // 1. Visit homepage to establish origin for sessionStorage
    await page.goto('/');

    // 2. Set the email in sessionStorage as expected by the page
    await page.evaluate(() => {
      sessionStorage.setItem('email', 'test@example.com');
    });

    // 3. Mock the resend API call
    await mockApiRoute(page, /\/v1\/auth\/email\/resend/, {
      body: { code: '0', msg: 'ok', data: null },
    });

    // 4. Navigate to email-verify page
    await page.goto('/auth/email-verify');

    // Verify the email verification heading is shown
    await expect(page.getByRole('heading', { name: '驗證信箱' })).toBeVisible();

    // 5. Click the "點此重新寄送" link
    await page.getByText('點此重新寄送').click();

    // 6. Expect the success toast
    await expect(
      page.getByText('驗證信已重新寄送！', { exact: true })
    ).toBeVisible();
  });
});
