import { expect, test } from '@playwright/test';

import { captureEvidence } from '../../helpers/evidence';
import { seedMockAuthSession } from '../../helpers/session';

// Static, valid user IDs from the dev/staging BFF database so that Next.js
// server-side fetches succeed, preventing 404s and keeping tests fully reliable.
// Following the codebase convention (e.g. mentor-pool.spec.ts), we test against
// the live dev database directly, avoiding cargo-cult browser-only mocks.
// Both are dedicated seeded test/fixture accounts (see .env.e2e.local's
// E2E_MENTOR_EMAIL/E2E_MENTEE_EMAIL), not real production users.
const REAL_MENTOR_ID = '7482008160728084'; // display name "Mentee", Mentor role (E2E_MENTOR_EMAIL)
const REAL_MENTEE_ID = '7482008160728087'; // testing_visitor (Mentee)

// ─── Tests ───────────────────────────────────────────────────────────────────

test('檢視他人的 mentor 個人檔案 → 基本資訊、可預約時段區塊可見', async ({
  page,
}) => {
  const mentorId = REAL_MENTOR_ID;
  await page.goto(`/profile/${mentorId}`);

  // Assert Name & Basic Info region using semantic locator (checking the user-facing text).
  // Scoped to <main> — the mentor's name is also baked into <title> by
  // generateMetadata, and an unscoped getByText() matches both, tripping
  // Playwright's strict mode.
  const nameElement = page.getByRole('main').getByText('Mentee');
  await expect(nameElement).toBeVisible({ timeout: 15_000 });

  // Assert schedule calendar / booking section is visible
  await expect(page.getByText('可預約日期')).toBeVisible();

  await captureEvidence(page, 'profile-mentor-hydrated-catalog-view');
});

test('檢視他人的 mentee 個人檔案 → 預約區塊不存在', async ({ page }) => {
  const menteeId = REAL_MENTEE_ID;
  await page.goto(`/profile/${menteeId}`);

  // Assert name is visible using the correct semantic locator.
  // Scoped to <main> for the same reason as the mentor case above.
  const nameElement = page
    .getByRole('main')
    .getByText('Visitor', { exact: true });
  await expect(nameElement).toBeVisible({ timeout: 15_000 });

  // Assert the schedule calendar / booking section is collapsed (not visible)
  await expect(page.getByText('可預約日期')).not.toBeVisible();
});

test('檢視不存在的 pageUserId → notFound() (404 頁面)', async ({ page }) => {
  // Navigate to an invalid/non-existent user ID (BFF naturally returns 404, triggering SSR notFound)
  await page.goto('/profile/9999999999');

  // Next.js standard 404 page shows 404 heading, select the first match to comply with strict mode
  await expect(page.getByText('404').first()).toBeVisible({ timeout: 15_000 });
});

test('檢視自己的個人檔案（isOwnMentorProfile 為 true 時）→ 顯示「預約設定」而非「預約時間」', async ({
  page,
}) => {
  const mentorId = REAL_MENTOR_ID;

  // Seed signed session cookie + CSR session matching the pageUserId (own profile)
  await seedMockAuthSession(page, {
    id: mentorId,
    name: 'Test Own User',
    isMentor: true,
    onBoarding: true,
    jobTitle: 'Software Engineer',
    company: 'Own Company',
  });

  await page.goto(`/profile/${mentorId}`);

  // Assert booking form button text says "預約設定" (booking settings) instead of "預約時間"
  const bookingButton = page.getByRole('button', { name: '預約設定' });
  await expect(bookingButton).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: '預約時間' })).toHaveCount(0);
});

test('導師個人頁 RWD 斷點驗證（#803）→ 1280x720 (xl) 左右雙欄並排，小於 1280px 退回單欄堆疊', async ({
  page,
}) => {
  const mentorId = REAL_MENTOR_ID;

  // 1. Standard desktop viewport at xl breakpoint (1280x720)
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/profile/${mentorId}`);

  await expect(page.getByRole('main').getByText('Mentee')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('可預約日期')).toBeVisible({ timeout: 15_000 });

  const leftColumn = page.locator('main .xl\\:w-3\\/5');
  const rightColumn = page.locator('main .xl\\:w-2\\/5');

  await expect(leftColumn).toBeVisible();
  await expect(rightColumn).toBeVisible();

  const xlLeftBox = await leftColumn.boundingBox();
  const xlRightBox = await rightColumn.boundingBox();

  expect(xlLeftBox).not.toBeNull();
  expect(xlRightBox).not.toBeNull();

  // At 1280px (xl), the right reservation panel sits to the right of the left info column
  // and aligns at the top rather than collapsing below into a single-column stack.
  expect(xlRightBox!.x).toBeGreaterThan(xlLeftBox!.x);
  expect(xlRightBox!.x).toBeGreaterThanOrEqual(
    xlLeftBox!.x + xlLeftBox!.width - 1
  );
  expect(Math.abs(xlRightBox!.y - xlLeftBox!.y)).toBeLessThan(5);

  // 2. Viewport below 1280px (e.g. 1024x720 lg breakpoint) falls back to single-column stack
  await page.setViewportSize({ width: 1024, height: 720 });

  await expect
    .poll(async () => {
      const lBox = await leftColumn.boundingBox();
      const rBox = await rightColumn.boundingBox();
      if (!lBox || !rBox) return false;
      return (
        Math.abs(rBox.x - lBox.x) < 5 && rBox.y >= lBox.y + lBox.height - 1
      );
    })
    .toBe(true);

  const belowXlLeftBox = await leftColumn.boundingBox();
  const belowXlRightBox = await rightColumn.boundingBox();

  expect(belowXlLeftBox).not.toBeNull();
  expect(belowXlRightBox).not.toBeNull();
  expect(Math.abs(belowXlRightBox!.x - belowXlLeftBox!.x)).toBeLessThan(5);
  expect(belowXlRightBox!.y).toBeGreaterThanOrEqual(
    belowXlLeftBox!.y + belowXlLeftBox!.height - 1
  );
});
