import { expect, test } from '@playwright/test';

import { captureEvidence } from '../../helpers/evidence';

test.describe('Design Token CSS Variables & Tailwind Theme Integration (#903)', () => {
  test('resolves canonical :root color tokens, semantic aliases, and Tailwind utilities in the browser', async ({
    page,
  }) => {
    await page.goto('/auth/signin');

    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();

    const tokenSnapshot = await page.evaluate(() => {
      const rootStyle = window.getComputedStyle(document.documentElement);
      return {
        brand500: rootStyle.getPropertyValue('--color-brand-500').trim(),
        backgroundWhite: rootStyle
          .getPropertyValue('--color-background-white')
          .trim(),
        textPrimary: rootStyle.getPropertyValue('--color-text-primary').trim(),
        semanticBackground: rootStyle.getPropertyValue('--background').trim(),
        semanticPrimary: rootStyle.getPropertyValue('--primary').trim(),
        authCardGradient: rootStyle.getPropertyValue('--bg-auth-card').trim(),
      };
    });

    expect(tokenSnapshot.brand500).toBe('180 64% 48%');
    expect(tokenSnapshot.backgroundWhite).toBe('0 0% 100%');
    expect(tokenSnapshot.textPrimary).toBe('225 12% 13%');
    expect(tokenSnapshot.semanticBackground).toBe('0 0% 100%');
    expect(tokenSnapshot.semanticPrimary).toBe('180 64% 48%');
    expect(tokenSnapshot.authCardGradient).toContain('linear-gradient');

    await captureEvidence(page, 'design-tokens-signin-theme');
  });
});
