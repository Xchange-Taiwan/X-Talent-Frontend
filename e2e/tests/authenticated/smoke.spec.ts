import { expect, test } from '@playwright/test';

// Validates that the storageState produced by auth.setup.ts results in an
// actually logged-in session: the Header should render the user menu instead
// of the signed-out 登入 / 註冊 buttons.

test('logged-in user sees the user menu on the homepage', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('button', { name: /open user menu/i })
  ).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole('link', { name: /^登入$/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /^註冊$/ })).toHaveCount(0);
});

test('logged-in user can open the mentor pool without redirect', async ({
  page,
}) => {
  await page.goto('/mentor-pool');

  await expect(page).toHaveURL(/\/mentor-pool/);
  await expect(
    page.getByRole('button', { name: /open user menu/i })
  ).toBeVisible({
    timeout: 15_000,
  });
});
