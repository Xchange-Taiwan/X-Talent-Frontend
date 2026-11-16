import { expect, test } from '@playwright/test';

import { captureEvidence } from '../../helpers/evidence';
import { mockApiRoute } from '../../helpers/route';

test.describe('Email Verification Flow', () => {
  test('visit /auth/email-verified with a valid token → calls confirmSignUp, clears pending email PII, and displays success status (#904)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.evaluate(() => {
      sessionStorage.setItem('email', 'pending-verify@example.com');
    });

    await mockApiRoute(page, /\/v1\/auth\/signup\/confirm/, {
      body: { code: '0', msg: 'ok', data: null },
    });

    await page.goto('/auth/email-verified?token=test-valid-token');

    await expect(page.getByRole('heading', { name: '驗證成功' })).toBeVisible();
    await expect(
      page.getByText(
        '你的帳號已完成註冊。現在可以開始建立你的個人頁面和尋找 Mentors 了！'
      )
    ).toBeVisible();

    const storedEmailAfterVerify = await page.evaluate(() =>
      sessionStorage.getItem('email')
    );
    expect(storedEmailAfterVerify).toBeNull();

    const setupProfileBtn = page.getByRole('button', { name: '設定個人資訊' });
    await expect(setupProfileBtn).toBeVisible();
    await captureEvidence(page, '904-email-verified-success-clears-pii');

    await setupProfileBtn.click();
    await expect(page).toHaveURL('/auth/signin', { timeout: 10_000 });
  });

  test('visit /auth/email-verified without a token → displays error state (does not call API)', async ({
    page,
  }) => {
    await page.goto('/auth/email-verified');

    await expect(
      page.getByText('缺少驗證 Token，請重新申請驗證信。', { exact: true })
    ).toBeVisible();

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
    await mockApiRoute(page, /\/v1\/auth\/signup\/confirm/, {
      status: 400,
      body: { code: '400', msg: '驗證連結已失效' },
    });

    await page.goto('/auth/email-verified?token=expired-token');

    await expect(
      page.getByText('驗證連結已失效', { exact: true })
    ).toBeVisible();

    await expect(page.getByRole('heading', { name: '驗證失敗' })).toBeVisible();
    await expect(
      page.getByText('您的驗證連結已失效，請重新輸入Email再次驗證')
    ).toBeVisible();

    const retryBtn = page.getByRole('button', { name: '返回重試' });
    await expect(retryBtn).toBeVisible();

    await retryBtn.click();
    await expect(page).toHaveURL('/auth/signup', { timeout: 10_000 });
  });

  test('visit /auth/email-verify page and click resend → disables duplicate clicks while pending and shows success toast (#904)', async ({
    page,
  }) => {
    await page.goto('/');

    await page.evaluate(() => {
      sessionStorage.setItem('email', 'test@example.com');
    });

    let releaseResend!: () => void;
    const resendGate = new Promise<void>((resolve) => {
      releaseResend = resolve;
    });

    await page.route(/\/v1\/auth\/email\/resend/, async (route) => {
      await resendGate;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: '0', msg: 'ok', data: null }),
      });
    });

    await page.goto('/auth/email-verify');

    await expect(page.getByRole('heading', { name: '驗證信箱' })).toBeVisible();
    await captureEvidence(page, '904-email-verify-pending-email-loaded');

    await page.getByRole('button', { name: '點此重新寄送' }).click();

    await expect(
      page.getByRole('button', { name: '重新寄送中...' })
    ).toBeDisabled();

    releaseResend();

    await expect(
      page.getByText('驗證信已重新寄送！', { exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: '點此重新寄送' })
    ).toBeEnabled();
  });
});
