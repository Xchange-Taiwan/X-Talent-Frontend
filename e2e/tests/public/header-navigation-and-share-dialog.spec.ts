import { expect, type Page, test } from '@playwright/test';

import { captureEvidence } from '../../helpers/evidence';
import { blockUnmockedExternalApi, mockApiRoute } from '../../helpers/route';
import { setSignedSessionCookie } from '../../helpers/session';

const MENTOR_ID = '7482008160728084';
const MENTEE_ID = '999999';

function createDeferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = (): void => {};
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

async function setupCommonApiMocks(page: Page): Promise<void> {
  await mockApiRoute(page, /\/v1\/users\/.*\/notifications\/unread-count/, {
    body: { code: '0', msg: 'ok', data: { unread_count: 0 } },
  });
  await mockApiRoute(page, /\/v1\/users\/.*\/notifications(\?|$)/, {
    body: { code: '0', msg: 'ok', data: { notifications: [], next: null } },
  });
}

test.describe('Header 宣告式導覽、hint-only 防護與單一掛載 ShareProfileDialog (#900)', () => {
  test.beforeEach(async ({ page }) => {
    await setupCommonApiMocks(page);
    await blockUnmockedExternalApi(page);
  });

  test('桌機版 1280x720：語意化連結、aria-current="page"、單一 ShareProfileDialog 與零 documentElement overflow 污染', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await setSignedSessionCookie(page, {
      id: MENTOR_ID,
      name: '陳導師',
      onBoarding: true,
      isMentor: true,
      jobTitle: 'Principal Product Manager',
      company: 'XChange',
      personalLinks: [
        { platform: 'linkedin', url: 'https://linkedin.com/in/mentor' },
        { platform: 'github', url: 'https://github.com/mentor' },
      ],
      token: 'mock-mentor-token',
    });

    await page.goto('/about');

    const headerAboutLink = page
      .locator('header nav')
      .getByRole('link', { name: '關於 X-Talent' });
    await expect(headerAboutLink).toBeVisible();
    await expect(headerAboutLink).toHaveAttribute('aria-current', 'page');

    const headerFeedbackLink = page
      .locator('header nav')
      .getByRole('link', { name: '提供回饋（另開新分頁）' });
    await expect(headerFeedbackLink).toBeVisible();

    const desktopRight = page.getByTestId('desktop-header-right');
    await desktopRight.getByRole('button', { name: '開啟用戶選單' }).click();

    const profileHeaderItem = page.getByTestId('profile-header-button');
    await expect(profileHeaderItem).toBeVisible();
    await expect(profileHeaderItem).toHaveAttribute(
      'href',
      `/profile/${MENTOR_ID}`
    );

    const mentorReservationItem = page.getByRole('menuitem', {
      name: '導師管理後台',
    });
    const myReservationItem = page.getByRole('menuitem', { name: '我的預約' });
    const myFavoritesItem = page.getByRole('menuitem', { name: '我的收藏' });

    await expect(mentorReservationItem).toHaveAttribute(
      'href',
      '/reservation/mentor'
    );
    await expect(myReservationItem).toHaveAttribute(
      'href',
      '/reservation/mentee'
    );
    await expect(myFavoritesItem).toHaveAttribute('href', '/favorites');

    await captureEvidence(page, 'header-desktop-user-dropdown-links');

    await page.getByRole('menuitem', { name: '分享個人頁面' }).click();

    const shareDialog = page.getByRole('dialog', { name: '分享個人頁面' });
    await expect(shareDialog).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);

    const inlineHtmlOverflow = await page.evaluate(
      () => document.documentElement.style.overflow
    );
    expect(inlineHtmlOverflow).toBe('');

    await captureEvidence(page, 'share-profile-dialog-desktop-1280x720');
  });

  test('行動版 390x844：語意化連結、外部回饋 aria-label、aria-current="page" 與安全捲動 ShareProfileDialog', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setSignedSessionCookie(page, {
      id: MENTEE_ID,
      name: '林學員',
      onBoarding: true,
      isMentor: false,
      jobTitle: 'Product Designer',
      company: 'X-Talent',
      personalLinks: [
        { platform: 'linkedin', url: 'https://linkedin.com/in/mentee' },
      ],
      token: 'mock-mentee-token',
    });

    await page.goto('/about');

    const mobileRight = page.getByTestId('mobile-header-right');
    await mobileRight.getByRole('button', { name: '開啟用戶選單' }).click();

    const userSheet = page.getByRole('dialog', { name: '用戶選單' });
    await expect(userSheet).toBeVisible();

    const profileHeaderLink = userSheet.getByTestId('profile-header-button');
    await expect(profileHeaderLink).toHaveAttribute(
      'href',
      `/profile/${MENTEE_ID}`
    );

    await expect(
      userSheet.getByRole('link', { name: '成為導師' })
    ).toHaveAttribute(
      'href',
      `/profile/${MENTEE_ID}/edit?mentor-onboarding=true`
    );
    await expect(
      userSheet.getByRole('link', { name: '關於 X-Talent' })
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      userSheet.getByRole('link', { name: '提供回饋（另開新分頁）' })
    ).toBeVisible();

    await captureEvidence(page, 'header-mobile-user-menu-links');

    await userSheet.getByRole('button', { name: '分享個人頁面' }).click();

    await expect(userSheet).toBeHidden();
    const shareDialog = page.getByRole('dialog', { name: '分享個人頁面' });
    await expect(shareDialog).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);

    await captureEvidence(page, 'share-profile-dialog-mobile-390x844');
  });

  test('hint-only 狀態：Session 尚未解析完成前禁用個人頁面與分享按鈕，避免點擊導向首頁', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await setSignedSessionCookie(page, {
      id: MENTEE_ID,
      name: '林學員',
      onBoarding: true,
      isMentor: false,
      token: 'mock-mentee-token',
    });

    const sessionGate = createDeferred();
    await page.route(/\/api\/auth\/session(\?|$)/, async (route) => {
      await sessionGate.promise;
      await route.continue();
    });

    await page.goto('/about');

    const desktopRight = page.getByTestId('desktop-header-right');
    const menuTrigger = desktopRight.getByRole('button', {
      name: '開啟用戶選單',
    });
    await expect(menuTrigger).toBeVisible({ timeout: 15_000 });
    await menuTrigger.click();

    const profileHeaderItem = page.getByTestId('profile-header-button');
    await expect(profileHeaderItem).toBeVisible();
    await expect(profileHeaderItem).toHaveAttribute('aria-disabled', 'true');
    await expect(profileHeaderItem).toHaveAttribute('href', '#');

    const shareItem = page.getByRole('menuitem', { name: '分享個人頁面' });
    await expect(shareItem).toBeDisabled();

    await captureEvidence(page, 'header-hint-only-disabled-guard');
    await expect(page).toHaveURL(/\/about$/);

    sessionGate.resolve();
    await expect(profileHeaderItem).toHaveAttribute(
      'href',
      `/profile/${MENTEE_ID}`,
      { timeout: 15_000 }
    );
  });
});
