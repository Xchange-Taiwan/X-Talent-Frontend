import { expect, type Page, test } from '@playwright/test';

import { captureEvidence } from '../../helpers/evidence';
import { blockUnmockedExternalApi, mockApiRoute } from '../../helpers/route';
import { setSignedSessionCookie } from '../../helpers/session';

const MENTEE_ID = '999991';
const MENTOR_ID = '999992';

async function loginAs(page: Page, id: string, isMentor: boolean) {
  await setSignedSessionCookie(page, {
    id,
    name: isMentor ? '陳導師' : '林學員',
    onBoarding: true,
    isMentor,
    jobTitle: isMentor ? 'Staff Engineer' : 'Product Designer',
    company: 'XChange',
    personalLinks: [],
    token: 'mock-access-token',
  });
}

test.describe('帳號選單「我的收藏」入口 E2E (#754)', () => {
  test.beforeEach(async ({ page }) => {
    await blockUnmockedExternalApi(page);
    await mockApiRoute(page, /\/v1\/users\/.*\/notifications\/unread-count/, {
      body: { code: '0', msg: 'ok', data: { unread_count: 0 } },
    });
  });

  test('已登入 Mentee 於桌面頭像下拉選單顯示「我的收藏」（置於「我的預約」下方、「登出」上方），支援鍵盤操作並導向 /favorites', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await loginAs(page, MENTEE_ID, false);

    await page.goto('/about');

    const desktopHeaderRight = page.getByTestId('desktop-header-right');
    const menuTrigger = desktopHeaderRight.getByRole('button', {
      name: '開啟用戶選單',
    });
    await expect(menuTrigger).toBeVisible({ timeout: 15_000 });

    const myReservationItem = page.getByRole('menuitem', { name: '我的預約' });
    const myFavoritesItem = page.getByRole('menuitem', { name: '我的收藏' });
    const logoutItem = page.getByRole('menuitem', { name: '登出' });

    // 驗證鍵盤開啟與關閉選單
    await menuTrigger.focus();
    await page.keyboard.press('Enter');
    await expect(myFavoritesItem).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(myFavoritesItem).toBeHidden();

    // 重新展開選單，驗證位置、文字（無數量 Badge）、GA4 屬性並擷取桌面證據截圖
    await menuTrigger.click();

    await expect(myReservationItem).toBeVisible();
    await expect(myFavoritesItem).toBeVisible();
    await expect(logoutItem).toBeVisible();

    await expect(myFavoritesItem).toHaveText('我的收藏');
    await expect(myFavoritesItem).toHaveAttribute(
      'data-analytics-click',
      'user_menu_my_favorites'
    );
    await expect(myFavoritesItem).toHaveAttribute(
      'data-analytics-location',
      'user_dropdown'
    );
    await expect(myFavoritesItem).toHaveAttribute(
      'data-analytics-feature',
      'navigation'
    );

    const reservationBox = await myReservationItem.boundingBox();
    const favoritesBox = await myFavoritesItem.boundingBox();
    const logoutBox = await logoutItem.boundingBox();
    expect(reservationBox).not.toBeNull();
    expect(favoritesBox).not.toBeNull();
    expect(logoutBox).not.toBeNull();
    expect(favoritesBox!.y).toBeGreaterThan(reservationBox!.y);
    expect(logoutBox!.y).toBeGreaterThan(favoritesBox!.y);

    await captureEvidence(page, 'account-menu-favorites');

    await myFavoritesItem.click();
    await expect(myFavoritesItem).toBeHidden();
    await expect(page).toHaveURL(/\/favorites$/, { timeout: 15_000 });
  });

  test('已登入 Mentee 於手機側邊帳號選單顯示「我的收藏」（置於「我的預約」下方）並點擊導向 /favorites', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, MENTEE_ID, false);

    await page.goto('/about');

    const mobileHeaderRight = page.getByTestId('mobile-header-right');
    const menuTrigger = mobileHeaderRight.getByRole('button', {
      name: '開啟用戶選單',
    });
    await expect(menuTrigger).toBeVisible({ timeout: 15_000 });
    await menuTrigger.click();

    const userSheet = page.getByRole('dialog', { name: '用戶選單' });
    await expect(userSheet).toBeVisible();

    const myReservationBtn = userSheet.getByRole('button', {
      name: '我的預約',
    });
    const myFavoritesBtn = userSheet.getByRole('button', { name: '我的收藏' });
    const findMentorLink = userSheet.getByRole('link', { name: '尋找導師' });

    await expect(myReservationBtn).toBeVisible();
    await expect(myFavoritesBtn).toBeVisible();
    await expect(findMentorLink).toBeVisible();

    await expect(myFavoritesBtn).toHaveText('我的收藏');
    await expect(myFavoritesBtn).toHaveAttribute(
      'data-analytics-click',
      'mobile_user_menu_my_favorites'
    );
    await expect(myFavoritesBtn).toHaveAttribute(
      'data-analytics-location',
      'mobile_user_menu'
    );
    await expect(myFavoritesBtn).toHaveAttribute(
      'data-analytics-feature',
      'navigation'
    );

    const reservationBox = await myReservationBtn.boundingBox();
    const favoritesBox = await myFavoritesBtn.boundingBox();
    const findMentorBox = await findMentorLink.boundingBox();
    expect(reservationBox).not.toBeNull();
    expect(favoritesBox).not.toBeNull();
    expect(findMentorBox).not.toBeNull();
    expect(favoritesBox!.y).toBeGreaterThan(reservationBox!.y);
    expect(findMentorBox!.y).toBeGreaterThan(favoritesBox!.y);

    await captureEvidence(page, 'account-menu-favorites');

    await myFavoritesBtn.click();
    await expect(userSheet).toBeHidden();
    await expect(page).toHaveURL(/\/favorites$/, { timeout: 15_000 });
  });

  test('已登入 Mentor 於桌面與手機帳號選單亦顯示「我的收藏」入口', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await loginAs(page, MENTOR_ID, true);

    await page.goto('/about');

    const desktopRight = page.getByTestId('desktop-header-right');
    const desktopTrigger = desktopRight.getByRole('button', {
      name: '開啟用戶選單',
    });
    await expect(desktopTrigger).toBeVisible({ timeout: 15_000 });
    await desktopTrigger.click();

    const mentorResItem = page.getByRole('menuitem', { name: '導師預約管理' });
    const myFavoritesItem = page.getByRole('menuitem', { name: '我的收藏' });
    await expect(mentorResItem).toBeVisible();
    await expect(myFavoritesItem).toBeVisible();
    await page.keyboard.press('Escape');

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileRight = page.getByTestId('mobile-header-right');
    const mobileTrigger = mobileRight.getByRole('button', {
      name: '開啟用戶選單',
    });
    await expect(mobileTrigger).toBeVisible({ timeout: 15_000 });
    await mobileTrigger.click();

    const userSheet = page.getByRole('dialog', { name: '用戶選單' });
    const mentorResBtn = userSheet.getByRole('button', {
      name: '導師預約管理',
    });
    const mobileFavBtn = userSheet.getByRole('button', { name: '我的收藏' });
    await expect(mentorResBtn).toBeVisible();
    await expect(mobileFavBtn).toBeVisible();
  });

  test('未登入訪客於桌面與手機皆不顯示帳號選單與「我的收藏」入口', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/about');

    const desktopRight = page.getByTestId('desktop-header-right');
    const signInLink = desktopRight.getByRole('link', { name: '登入' });
    const userMenuTrigger = page.getByRole('button', { name: '開啟用戶選單' });

    await expect(signInLink).toBeVisible({ timeout: 15_000 });
    await expect(userMenuTrigger).toBeHidden();
    await expect(page.getByText('我的收藏')).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(userMenuTrigger).toBeHidden();

    const hamburgerBtn = page.getByRole('button', { name: '開啟導航選單' });
    await expect(hamburgerBtn).toBeVisible();
    await hamburgerBtn.click();

    const guestNavSheet = page.getByRole('dialog', { name: '導航選單' });
    const findMentorLink = guestNavSheet.getByRole('link', {
      name: '尋找導師',
    });
    await expect(findMentorLink).toBeVisible();
    await expect(page.getByText('我的收藏')).toHaveCount(0);
  });
});
