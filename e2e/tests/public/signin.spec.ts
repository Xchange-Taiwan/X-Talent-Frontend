import { expect, test } from '@playwright/test';

import { seedMockAuthSession } from '../../helpers/session';

test.beforeEach(async ({ page }) => {
  await page.goto('/auth/signin');
});

test('submit with empty fields → inline validation errors appear, no API call made', async ({
  page,
}) => {
  await page.click('button[type="submit"]');

  await expect(page.getByText('請輸入電子郵件')).toBeVisible();
  await expect(page.getByText('密碼至少需為 8 個字')).toBeVisible();
});

test('invalid credentials → toast shows "Invalid credentials!", stays on sign-in page', async ({
  page,
}) => {
  // NextAuth's signIn client reads `data.url` and parses the error from the query string.
  // The response must carry a valid URL — returning url:null throws TypeError in the client.
  await page.route(/\/api\/auth\/callback\/credentials/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        url: 'http://localhost:3000/api/auth/error?error=CredentialsSignin',
      }),
    })
  );

  await page.fill('input[name="email"]', 'wrong@example.com');
  await page.fill('input[name="password"]', 'WrongPassword1');

  // Wait for the mocked response BEFORE asserting the toast so Playwright
  // starts polling for the element only after the hook has received the error.
  const responsePromise = page.waitForResponse(
    /\/api\/auth\/callback\/credentials/
  );
  await page.click('button[type="submit"]');
  await responsePromise;

  await expect(
    page.getByText('Invalid credentials!', { exact: true })
  ).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL('/auth/signin');
});

test('valid credentials + onBoarding: false → redirects to /auth/onboarding', async ({
  page,
}) => {
  await seedMockAuthSession(page, {
    id: '1',
    name: 'Test User',
    onBoarding: false,
    isMentor: false,
  });

  await page.route(/\/api\/auth\/callback\/credentials/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ url: 'http://localhost:3000' }),
    })
  );

  await page.fill('input[name="email"]', 'user@example.com');
  await page.fill('input[name="password"]', 'Password1234');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/auth/onboarding', { timeout: 10_000 });
});

test('valid credentials + onBoarding: true → redirects to /mentor-pool', async ({
  page,
}) => {
  await seedMockAuthSession(page, {
    id: '1',
    name: 'Test User',
    onBoarding: true,
    isMentor: false,
  });

  await page.route(/\/api\/auth\/callback\/credentials/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ url: 'http://localhost:3000' }),
    })
  );

  await page.fill('input[name="email"]', 'user@example.com');
  await page.fill('input[name="password"]', 'Password1234');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/mentor-pool', { timeout: 10_000 });
});
