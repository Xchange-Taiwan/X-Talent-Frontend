import { expect, Page, test } from '@playwright/test';

import {
  setSignedMaintenanceCookie,
  setSignedSessionCookie,
} from '../../helpers/session';

const USER_ID = '999997';
const BYPASS_TOKEN = 'e2e-qa-bypass-token-2026';

function getCookieDomain(): string {
  const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';
  return new URL(baseUrl).hostname;
}

async function seedStaleSessionHint(page: Page): Promise<void> {
  await page.context().addCookies([
    {
      name: 'session-hint',
      value: encodeURIComponent(`1|${USER_ID}`),
      domain: getCookieDomain(),
      path: '/',
      httpOnly: false,
      sameSite: 'Lax',
    },
  ]);
}

test.describe('Middleware (RefreshTokenError & Maintenance Mode) & AnnouncementBanner E2E (#792)', () => {
  test('RefreshTokenError 造訪受保護路由 → Middleware 重導向至 /auth/signin 並清除 next-auth.session-token 與 session-hint cookie', async ({
    page,
  }) => {
    await seedStaleSessionHint(page);
    await setSignedSessionCookie(page, {
      id: USER_ID,
      name: 'Expired Token User',
      onBoarding: true,
      isMentor: true,
      token: 'expired-access-token',
      error: 'RefreshTokenError',
    });

    await page.goto('/reservation/mentee');

    await expect(page).toHaveURL(/\/auth\/signin/, { timeout: 15_000 });

    const cookies = await page.context().cookies();
    const cookieNames = cookies.map((c) => c.name);
    expect(cookieNames).not.toContain('next-auth.session-token');
    expect(cookieNames).not.toContain('__Secure-next-auth.session-token');
    expect(cookieNames).not.toContain('session-hint');
  });

  test('RefreshTokenError 造訪公開路由 → Middleware 清除過期 session-hint 且 SessionErrorWatcher 自動觸發 signOut 導向 /auth/signin', async ({
    page,
  }) => {
    await seedStaleSessionHint(page);
    await setSignedSessionCookie(page, {
      id: USER_ID,
      name: 'Expired Public User',
      onBoarding: true,
      isMentor: true,
      token: 'expired-access-token',
      error: 'RefreshTokenError',
    });

    await page.goto('/about');

    await expect(page).toHaveURL(/\/auth\/signin/, { timeout: 15_000 });

    const cookies = await page.context().cookies();
    const cookieNames = cookies.map((c) => c.name);
    expect(cookieNames).not.toContain('next-auth.session-token');
    expect(cookieNames).not.toContain('__Secure-next-auth.session-token');
    expect(cookieNames).not.toContain('session-hint');
  });

  test('非維護模式下直接造訪 /maintenance → 自動重導向回首頁 /', async ({
    page,
  }) => {
    await page.goto('/maintenance');

    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
    await expect(
      page.getByRole('heading', { name: '系統維護中' })
    ).toBeHidden();
  });

  test('維護模式啟用時 → 一般路由重導向至 /maintenance 渲染維護頁面，且 /api/* 回傳 503 與 X-Maintenance-Mode 標頭', async ({
    page,
  }) => {
    await setSignedMaintenanceCookie(page, {
      maintenanceMode: true,
      bypassToken: BYPASS_TOKEN,
    });

    await page.goto('/about');

    await expect(page).toHaveURL(/\/maintenance$/, { timeout: 15_000 });
    await expect(
      page.getByRole('heading', { name: '系統維護中' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: '重新整理試試' })
    ).toBeVisible();

    const apiResponse = await page.evaluate(async () => {
      const res = await fetch('/api/announcement');
      const body = (await res.json()) as { error?: string };
      return {
        status: res.status,
        maintenanceHeader: res.headers.get('x-maintenance-mode'),
        error: body.error,
      };
    });

    expect(apiResponse.status).toBe(503);
    expect(apiResponse.maintenanceHeader).toBe('1');
    expect(apiResponse.error).toContain('Service Unavailable');
  });

  test('維護模式啟用時帶入正確 ?bypass=<token> → 寫入 maintenance_bypass cookie、清除網址參數並正常放行頁面與後續路由', async ({
    page,
  }) => {
    await setSignedMaintenanceCookie(page, {
      maintenanceMode: true,
      bypassToken: BYPASS_TOKEN,
    });

    await page.goto(`/about?bypass=${BYPASS_TOKEN}`);

    await expect(page).toHaveURL(/\/about$/, { timeout: 15_000 });
    expect(page.url()).not.toContain('bypass=');
    await expect(
      page.getByRole('heading', { name: '系統維護中' })
    ).toBeHidden();

    const cookies = await page.context().cookies();
    const bypassCookie = cookies.find((c) => c.name === 'maintenance_bypass');
    expect(bypassCookie?.value).toBe(BYPASS_TOKEN);

    // Subsequent navigation without ?bypass= should remain allowed via the cookie
    await page.goto('/terms');
    await expect(page).toHaveURL(/\/terms$/, { timeout: 15_000 });
    await expect(
      page.getByRole('heading', { name: '系統維護中' })
    ).toBeHidden();
  });

  test('AnnouncementBanner 啟用且未過期 → 顯示全站公告並動態更新 --banner-height，點擊關閉後隱藏並寫入 sessionStorage', async ({
    page,
  }) => {
    const futureTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const announcementText =
      '系統將於今晚 23:00 進行例行性維護，預計暫停服務 30 分鐘。';

    await page.route(/\/api\/announcement/, async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            enabled: true,
            message: announcementText,
            maintenanceTime: futureTime,
          }),
        });
      }
      return route.continue();
    });

    await page.goto('/about');

    const banner = page.locator(
      '[role="alert"]:not(#__next-route-announcer__)'
    );
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toContainText(announcementText);

    await expect
      .poll(async () => {
        const raw = await page.evaluate(() =>
          document.documentElement.style.getPropertyValue('--banner-height')
        );
        return parseFloat(raw || '0');
      })
      .toBeGreaterThan(0);

    await page.getByRole('button', { name: '關閉公告' }).click();

    await expect(banner).toBeHidden();

    const dismissedState = await page.evaluate(() => ({
      storage: sessionStorage.getItem('announcement-dismissed'),
      bannerHeight:
        document.documentElement.style.getPropertyValue('--banner-height'),
    }));
    expect(dismissedState.storage).toBe('true');
    expect(dismissedState.bannerHeight).toBe('0px');

    // Reloading in the same session should keep the announcement hidden
    await page.reload();
    await expect(banner).toBeHidden();
  });

  test('AnnouncementBanner maintenanceTime 已過期 → 不顯示公告橫幅', async ({
    page,
  }) => {
    const pastTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    await page.route(/\/api\/announcement/, async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            enabled: true,
            message: '這是一則已經過期的維護公告',
            maintenanceTime: pastTime,
          }),
        });
      }
      return route.continue();
    });

    await page.goto('/about');

    // Wait for page content to settle and confirm alert never renders
    await expect(page.getByTestId('desktop-header-right')).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.locator('[role="alert"]:not(#__next-route-announcer__)')
    ).toBeHidden();
  });
});
