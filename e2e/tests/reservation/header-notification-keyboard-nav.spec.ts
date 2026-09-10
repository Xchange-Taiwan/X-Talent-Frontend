import { expect, Locator, Page, test } from '@playwright/test';

import { mockApiRoute } from '../../helpers/route';
import { setSignedSessionCookie } from '../../helpers/session';

// Static, valid mentee ID from the dev/staging BFF database
const REAL_MENTEE_ID = '7482008160728085'; // testing_visitor (Mentee)

/**
 * Sign in and mock next-auth session endpoints for a mentee so the Header
 * renders NotificationBell instead of the guest sign-in buttons.
 */
async function setupMenteeSession(page: Page): Promise<void> {
  await setSignedSessionCookie(page, {
    id: REAL_MENTEE_ID,
    name: 'Test Own User',
    isMentor: false,
    onBoarding: true,
    jobTitle: 'Software Engineer',
    company: 'Own Company',
    personalLinks: [],
    token: 'mock-access-token',
  });

  await page.route(/\/api\/auth\/session/, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: REAL_MENTEE_ID,
            name: 'Test Own User',
            isMentor: false,
            onBoarding: true,
            jobTitle: 'Software Engineer',
            company: 'Own Company',
            personalLinks: [],
          },
          accessToken: 'mock-access-token',
          expires: '2099-01-01T00:00:00.000Z',
        }),
      });
    }
    return route.continue();
  });
}

/**
 * Repeatedly presses Tab until the given locator receives focus, bounded so
 * a broken tab order fails the test instead of hanging.
 */
async function tabUntilFocused(
  page: Page,
  locator: Locator,
  maxPresses: number
): Promise<void> {
  for (let i = 0; i < maxPresses; i++) {
    await page.keyboard.press('Tab');
    const isFocused = await locator.evaluate(
      (el) => el === document.activeElement
    );
    if (isFocused) return;
  }
}

test.describe('Header NotificationBell 鍵盤導覽', () => {
  test('Tab 聚焦鈴鐺按鈕 → Enter 展開選單 → Tab 遍歷至「全部標為已讀」按鈕並顯示焦點環 → Escape 關閉並還原焦點', async ({
    page,
  }) => {
    await setupMenteeSession(page);

    await mockApiRoute(
      page,
      new RegExp(`/v1/users/${REAL_MENTEE_ID}/notifications/unread-count`),
      { body: { code: '0', msg: 'ok', data: { unread_count: 1 } } }
    );
    await mockApiRoute(
      page,
      new RegExp(`/v1/users/${REAL_MENTEE_ID}/notifications(?!/)`),
      {
        body: {
          code: '0',
          msg: 'ok',
          data: {
            notifications: [
              {
                id: 'n1',
                type: 'reservation_requested',
                created_at: Math.floor(Date.now() / 1000),
                read_at: null,
                metadata: { role: 'mentor', counterparty_name: '林導師' },
              },
            ],
            next_cursor: null,
          },
        },
      }
    );

    await page.goto('/mentor-pool');

    const bellButton = page.getByRole('button', { name: '開啟通知選單' });
    await expect(bellButton).toBeVisible({ timeout: 15_000 });

    // Tab from the top of the page until the bell trigger receives focus
    await tabUntilFocused(page, bellButton, 40);
    await expect(bellButton).toBeFocused();

    // Enter opens the popover (native button click behavior)
    await page.keyboard.press('Enter');
    await expect(page.getByText('您有新的預約')).toBeVisible();

    const markAllButton = page.getByRole('button', {
      name: 'Mark all as read',
    });

    // Continue tabbing from the trigger into the popover content
    await tabUntilFocused(page, markAllButton, 15);
    await expect(markAllButton).toBeFocused();

    // Assert the focus ring is visibly rendered (FOCUS_RING_CLASSES) instead
    // of the old `focus:outline-none`, which suppressed any visible
    // indicator entirely.
    const boxShadow = await markAllButton.evaluate(
      (el) => getComputedStyle(el).boxShadow
    );
    expect(boxShadow).not.toBe('none');

    // Escape closes the popover and returns focus to the trigger button
    await page.keyboard.press('Escape');
    await expect(page.getByText('您有新的預約')).not.toBeVisible();
    await expect(bellButton).toBeFocused();
  });
});
