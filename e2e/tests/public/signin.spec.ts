import { expect, test } from '@playwright/test';

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
  await page.click('button[type="submit"]');

  await expect(
    page.getByText('Invalid credentials!', { exact: true })
  ).toBeVisible();
  await expect(page).toHaveURL('/auth/signin');
});

test('valid credentials + onBoarding: false → redirects to /auth/onboarding', async ({
  page,
}) => {
  // /auth/onboarding is a protected route. The middleware checks for the
  // next-auth.session-token cookie (existence only, no JWT verification).
  // Set a fake cookie so the middleware lets the navigation through.
  await page.context().addCookies([
    {
      name: 'next-auth.session-token',
      value: 'fake-session-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
    },
  ]);

  await page.route(/\/api\/auth\/callback\/credentials/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ url: 'http://localhost:3000' }),
    })
  );

  await page.route(/\/api\/auth\/session/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: '1',
          name: 'Test User',
          onBoarding: false,
          isMentor: false,
          jobTitle: '',
          company: '',
          personalLinks: [],
        },
        accessToken: 'mock-token',
        expires: '2099-01-01T00:00:00.000Z',
      }),
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
  await page.route(/\/api\/auth\/callback\/credentials/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ url: 'http://localhost:3000' }),
    })
  );

  await page.route(/\/api\/auth\/session/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: '1',
          name: 'Test User',
          onBoarding: true,
          isMentor: false,
          jobTitle: '',
          company: '',
          personalLinks: [],
        },
        accessToken: 'mock-token',
        expires: '2099-01-01T00:00:00.000Z',
      }),
    })
  );

  await page.fill('input[name="email"]', 'user@example.com');
  await page.fill('input[name="password"]', 'Password1234');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/mentor-pool', { timeout: 10_000 });
});
