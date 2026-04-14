import { expect, test } from '@playwright/test';

import { mockApiRoute } from '../../helpers/route';

test('enter email on /auth/password-forgot and submit → redirects to /auth/password-forgot-success', async ({
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
});

test('visit /auth/password-reset?token=<valid>, enter matching passwords and submit → redirects to /auth/password-reset-success', async ({
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
