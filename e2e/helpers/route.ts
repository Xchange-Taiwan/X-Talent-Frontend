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
  await page.route(pattern, (route) =>
    route.fulfill({
      status: options.status ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(options.body),
    })
  );
}
