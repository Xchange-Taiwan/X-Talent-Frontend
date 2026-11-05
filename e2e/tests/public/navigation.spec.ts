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
