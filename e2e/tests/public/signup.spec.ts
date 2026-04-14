import { expect, test } from '@playwright/test';

import { mockApiRoute } from '../../helpers/route';

test.beforeEach(async ({ page }) => {
  await page.goto('/auth/signup');
});

test('valid signup redirects to /auth/email-verify', async ({ page }) => {
  await mockApiRoute(page, /\/v1\/auth\/signup/, { body: { code: '0' } });

  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'Password1234');
  await page.fill('input[name="confirm_password"]', 'Password1234');
  await page.getByRole('checkbox').click();
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/auth/email-verify', { timeout: 10_000 });
});

test('invalid email format shows inline error', async ({ page }) => {
  await page.fill('input[name="email"]', 'not-an-email');
  await page.fill('input[name="password"]', 'Password1234');
  await page.fill('input[name="confirm_password"]', 'Password1234');
  await page.getByRole('checkbox').click();
  await page.click('button[type="submit"]');

  await expect(page.getByText('請輸入電子郵件')).toBeVisible();
});

test('mismatched passwords shows inline error', async ({ page }) => {
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'Password1234');
  await page.fill('input[name="confirm_password"]', 'DifferentPass1234');
  await page.getByRole('checkbox').click();
  await page.click('button[type="submit"]');

  await expect(page.getByText('密碼與確認密碼不符')).toBeVisible();
});

test('unchecked terms of service shows inline error', async ({ page }) => {
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'Password1234');
  await page.fill('input[name="confirm_password"]', 'Password1234');
  await page.click('button[type="submit"]');

  await expect(page.getByText('請確認並同意服務條款')).toBeVisible();
});

test('Google sign-up button triggers OAuth redirect', async ({ page }) => {
  await mockApiRoute(page, /\/v2\/oauth\/google\/authorize\/signup/, {
    body: {
      data: {
        authorization_url: 'https://accounts.google.com/o/oauth2/auth?mock=1',
      },
    },
  });

  await page.route(/accounts\.google\.com/, (route) => route.abort());

  const navigationPromise = page.waitForRequest(/accounts\.google\.com/);
  await page.getByRole('button', { name: /google/i }).click();
  const request = await navigationPromise;

  expect(request.url()).toContain('accounts.google.com');
});
