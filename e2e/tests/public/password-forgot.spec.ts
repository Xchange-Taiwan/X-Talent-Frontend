import { expect, test } from '@playwright/test';

import { mockApiRoute } from '../../helpers/route';

test('enter email on /auth/password-forgot and submit → redirects to /auth/password-forgot-success and renders AuthMessageCard', async ({
  page,
}) => {
  await page.goto('/auth/password-forgot');

  await mockApiRoute(page, /\/v1\/auth\/password\/reset\/email/, {
    body: { code: '0', msg: 'ok', data: { ttl_secs: 300 } },
  });

  await page.fill('input[name="email"]', 'user@example.com');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/auth/password-forgot-success', {
    timeout: 10_000,
  });

  await expect(
    page.getByRole('heading', { level: 1, name: '郵件已送出' })
  ).toBeVisible();
  await expect(
    page.getByText(
      '系統將自動寄送郵件給您，請查看您的信箱並點擊連結以重設密碼。'
    )
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '重新寄送' })).toBeVisible();
  await expect(page.getByRole('button', { name: '更換信箱' })).toBeVisible();
});

test('visit /auth/password-reset?token=<valid>, enter matching passwords and submit → redirects to /auth/password-reset-success, renders AuthMessageCard, and navigates to /auth/signin (#805)', async ({
  page,
}) => {
  await page.goto('/auth/password-reset?token=test-valid-token');

  await mockApiRoute(page, /\/v1\/auth\/password\/reset/, {
    body: { code: '0', msg: 'ok', data: null },
  });

  await page.fill('input[name="password"]', 'NewPassword1234');
  await page.fill('input[name="confirm_password"]', 'NewPassword1234');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/auth/password-reset-success', {
    timeout: 10_000,
  });

  await expect(
    page.getByRole('heading', { level: 1, name: '密碼重設成功' })
  ).toBeVisible();
  await expect(page.getByText('您現在可以使用新密碼登入。')).toBeVisible();

  const signInButton = page.getByRole('button', { name: '前往登入' });
  await expect(signInButton).toBeVisible();
  await signInButton.click();

  await expect(page).toHaveURL('/auth/signin', { timeout: 10_000 });
});

test('visit /auth/password-reset without a token → toast shows 缺少驗證 Token', async ({
  page,
}) => {
  await page.goto('/auth/password-reset');

  await page.fill('input[name="password"]', 'NewPassword1234');
  await page.fill('input[name="confirm_password"]', 'NewPassword1234');
  await page.click('button[type="submit"]');

  await expect(
    page.getByText('缺少驗證 Token，請重新申請密碼重設。', { exact: true })
  ).toBeVisible();
});
