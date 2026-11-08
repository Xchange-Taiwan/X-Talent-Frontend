import { expect, test } from '@playwright/test';
import path from 'path';

// Canary tests hit the real backend with real mentee/mentor accounts (see
// e2e/fixtures/auth.setup.ts and the `setup-canary` Playwright project).
// Unlike e2e/tests/reservation|profile|onboarding, which forge a session
// cookie and mock API responses, everything here is a real login against
// the real Auth Lambda.
//
// This is deliberately the minimal proof that both real accounts can log in
// simultaneously — it does not exercise any mentor<->mentee business flow.
// That's the follow-up ticket (X-Tracker #687), which builds on the two
// storageState files this infrastructure produces.

const MENTEE_AUTH_FILE = path.join(__dirname, '../../.auth/mentee.json');
const MENTOR_AUTH_FILE = path.join(__dirname, '../../.auth/mentor.json');

test('mentee and mentor real accounts can both log in simultaneously', async ({
  browser,
}) => {
  const menteeContext = await browser.newContext({
    storageState: MENTEE_AUTH_FILE,
  });
  const mentorContext = await browser.newContext({
    storageState: MENTOR_AUTH_FILE,
  });

  try {
    const menteePage = await menteeContext.newPage();
    const mentorPage = await mentorContext.newPage();

    await Promise.all([menteePage.goto('/'), mentorPage.goto('/')]);

    // Same signal smoke.spec.ts uses: the Header renders the user menu
    // instead of the signed-out 登入 / 註冊 buttons.
    await expect(
      menteePage.getByRole('button', { name: /開啟用戶選單/ })
    ).toBeVisible({ timeout: 15_000 });
    await expect(menteePage.getByRole('link', { name: /^登入$/ })).toHaveCount(
      0
    );

    await expect(
      mentorPage.getByRole('button', { name: /開啟用戶選單/ })
    ).toBeVisible({ timeout: 15_000 });
    await expect(mentorPage.getByRole('link', { name: /^登入$/ })).toHaveCount(
      0
    );
  } finally {
    await menteeContext.close();
    await mentorContext.close();
  }
});
