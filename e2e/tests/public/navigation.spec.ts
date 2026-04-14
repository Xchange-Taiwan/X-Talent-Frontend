import { expect, test } from '@playwright/test';

test('home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL('/');
  await expect(page.locator('body')).toBeVisible();
});

test('mentor pool page is accessible without authentication', async ({
  page,
}) => {
  await page.goto('/mentor-pool');
  await expect(page).toHaveURL('/mentor-pool');
  await expect(page.locator('body')).toBeVisible();
});
