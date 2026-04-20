import { Page } from '@playwright/test';

const EXTERNAL_API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

/**
 * Intercept any external API call that was NOT explicitly mocked by the test.
 *
 * Register this **after** all your `page.route(...)` mocks so it sits at the
 * bottom of Playwright's LIFO stack and only catches unhandled requests.
 * Unhandled calls are aborted immediately instead of waiting for the real AWS
 * endpoint to time out.
 *
 * @example
 * test.beforeEach(async ({ page }) => {
 *   await page.route(/\/v1\/mentors/, handler);        // explicit mock
 *   await blockUnmockedExternalApi(page);              // catch-all — register last
 * });
 */
export async function blockUnmockedExternalApi(page: Page): Promise<void> {
  if (!EXTERNAL_API_URL) return;

  await page.route(EXTERNAL_API_URL + '**', (route) => {
    console.warn(
      `[E2E] Unmocked external API call aborted: ${route.request().url()}`
    );
    return route.abort('failed');
  });
}

interface MockRouteOptions {
  status?: number;
  body: unknown;
}

/**
 * Mock an API endpoint for a single test. Call inside `test()` before
 * navigating to the page under test.
 *
 * @example
 * await mockApiRoute(page, /\/v1\/users\/me/, { body: { data: mockUser } });
 */
export async function mockApiRoute(
  page: Page,
  pattern: string | RegExp,
  options: MockRouteOptions
): Promise<void> {
  await page.route(pattern, (route) => {
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods':
            'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    return route.fulfill({
      status: options.status ?? 200,
      contentType: 'application/json',
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(options.body),
    });
  });
}
