import { expect, test } from '@playwright/test';

import { setSignedSessionCookie } from '../../helpers/session';

// Static, valid user IDs from the dev/staging BFF database so that Next.js
// server-side fetches succeed, preventing 404s and keeping tests fully reliable.
// Following the codebase convention (e.g. mentor-pool.spec.ts), we test against
// the live dev database directly, avoiding cargo-cult browser-only mocks.
const REAL_MENTOR_ID = '7468899508961767'; // Jonas Lo (Mentor)
const REAL_MENTEE_ID = '7462904718734737'; // Visitor (Mentee)

// Helper to construct a flat NextAuth JWT Payload matching e2e/helpers/session.ts's SessionPayload.
// NextAuth stores the flat JWT payload inside the encrypted cookie, which is then decrypted
// and mapped to a nested { user, accessToken, expires } session object client-side.
function makeJWTPayload(userId: string, isMentor: boolean) {
  return {
    id: userId,
    name: 'Test Own User',
    isMentor,
    onBoarding: true,
    jobTitle: 'Software Engineer',
    company: 'Own Company',
    personalLinks: [],
    token: 'mock-access-token',
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('檢視他人的 mentor 個人檔案 → 基本資訊、可預約時段區塊可見', async ({
  page,
}) => {
  const mentorId = REAL_MENTOR_ID;
  await page.goto(`/profile/${mentorId}`);

  // Assert Name & Basic Info region using semantic locator (checking the user-facing text)
  const nameElement = page.getByText('Jonas Lo');
  await expect(nameElement).toBeVisible({ timeout: 15_000 });

  // Assert schedule calendar / booking section is visible
  await expect(page.getByText('可預約日期')).toBeVisible();
});

test('檢視他人的 mentee 個人檔案 → 預約區塊不存在', async ({ page }) => {
  const menteeId = REAL_MENTEE_ID;
  await page.goto(`/profile/${menteeId}`);

  // Assert name is visible using the correct semantic locator
  const nameElement = page.getByText('Visitor');
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

  // Sign in and set signed session cookie matching the pageUserId (own profile)
  await setSignedSessionCookie(page, makeJWTPayload(mentorId, true));

  await page.goto(`/profile/${mentorId}`);

  // Assert booking form button text says "預約設定" (booking settings) instead of "預約時間"
  const bookingButton = page.getByRole('button', { name: '預約設定' });
  await expect(bookingButton).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: '預約時間' })).toHaveCount(0);
});
