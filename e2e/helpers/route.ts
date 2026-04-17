import { Page } from '@playwright/test';

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
