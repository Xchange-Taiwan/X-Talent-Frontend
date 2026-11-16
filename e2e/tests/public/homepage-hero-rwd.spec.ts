import { expect, type Page, test } from '@playwright/test';

import { captureEvidence } from '../../helpers/evidence';
import { mockApiRoute } from '../../helpers/route';
import { seedMockAuthSession } from '../../helpers/session';

interface BoxRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

interface HeroLayoutMetrics {
  viewportWidth: number;
  viewportHeight: number;
  scrollWidth: number;
  clientWidth: number;
  heroRect: BoxRect;
  headingRect: BoxRect;
  subtitleRect: BoxRect;
  ctaRect: BoxRect;
  headingFontSize: string;
  subtitleFontSize: string;
  leftClipRect: BoxRect | null;
  rightClipRect: BoxRect | null;
  artworkLeftRect: BoxRect | null;
  artworkRightRect: BoxRect | null;
}

function boxesOverlap(a: BoxRect, b: BoxRect): boolean {
  return (
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  );
}

async function waitForHeroArtworkLoaded(
  page: Page,
  expectedAsset: string
): Promise<void> {
  await page.waitForFunction((asset: string) => {
    const selectors = [
      '[data-testid="homepage-hero-artwork-left"]',
      '[data-testid="homepage-hero-artwork-right"]',
    ];
    return selectors.every((selector) => {
      const el = document.querySelector(selector);
      if (!(el instanceof HTMLImageElement)) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      if (!el.complete || el.naturalWidth <= 0) return false;
      const resolvedSrc = decodeURIComponent(el.currentSrc || el.src);
      return resolvedSrc.includes(asset);
    });
  }, expectedAsset);
}

async function collectHeroMetrics(page: Page): Promise<HeroLayoutMetrics> {
  return page.evaluate(() => {
    const toRect = (el: Element | null): BoxRect | null => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return null;
      return {
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      };
    };

    const heroEl = document.querySelector('[data-testid="homepage-hero"]');
    const headingEl = heroEl?.querySelector('h1') ?? null;
    const subtitleEl = heroEl?.querySelector('p') ?? null;
    const ctaEl = document.querySelector('[data-testid="homepage-cta-hero"]');

    if (!heroEl || !headingEl || !subtitleEl || !ctaEl) {
      throw new Error('Missing expected homepage hero elements');
    }

    const heroRect = toRect(heroEl);
    const headingRect = toRect(headingEl);
    const subtitleRect = toRect(subtitleEl);
    const ctaRect = toRect(ctaEl);

    if (!heroRect || !headingRect || !subtitleRect || !ctaRect) {
      throw new Error('Homepage hero elements have zero bounding rect');
    }

    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      heroRect,
      headingRect,
      subtitleRect,
      ctaRect,
      headingFontSize: window.getComputedStyle(headingEl).fontSize,
      subtitleFontSize: window.getComputedStyle(subtitleEl).fontSize,
      leftClipRect: toRect(
        document.querySelector('[data-testid="homepage-hero-clip-left"]')
      ),
      rightClipRect: toRect(
        document.querySelector('[data-testid="homepage-hero-clip-right"]')
      ),
      artworkLeftRect: toRect(
        document.querySelector('[data-testid="homepage-hero-artwork-left"]')
      ),
      artworkRightRect: toRect(
        document.querySelector('[data-testid="homepage-hero-artwork-right"]')
      ),
    };
  });
}

function assertDesktopAvatarsUncroppedAndClear(
  metrics: HeroLayoutMetrics
): void {
  const {
    artworkLeftRect: desktopLeftRect,
    artworkRightRect: desktopRightRect,
    heroRect,
    headingRect,
    subtitleRect,
    ctaRect,
  } = metrics;

  expect(desktopLeftRect).not.toBeNull();
  expect(desktopRightRect).not.toBeNull();
  if (!desktopLeftRect || !desktopRightRect) return;

  const topLeftWoman: BoxRect = {
    left: desktopLeftRect.left + 0.118 * desktopLeftRect.width,
    right: desktopLeftRect.left + 0.196 * desktopLeftRect.width,
    top: desktopLeftRect.top + 0.065 * desktopLeftRect.height,
    bottom: desktopLeftRect.top + 0.203 * desktopLeftRect.height,
    width: 0.078 * desktopLeftRect.width,
    height: 0.138 * desktopLeftRect.height,
  };

  const middleLeftWoman: BoxRect = {
    left: desktopLeftRect.left + 0.214 * desktopLeftRect.width,
    right: desktopLeftRect.left + 0.324 * desktopLeftRect.width,
    top: desktopLeftRect.top + 0.33 * desktopLeftRect.height,
    bottom: desktopLeftRect.top + 0.525 * desktopLeftRect.height,
    width: 0.11 * desktopLeftRect.width,
    height: 0.195 * desktopLeftRect.height,
  };

  const topRightMan: BoxRect = {
    left: desktopRightRect.left + 0.706 * desktopRightRect.width,
    right: desktopRightRect.left + 0.818 * desktopRightRect.width,
    top: desktopRightRect.top + 0.155 * desktopRightRect.height,
    bottom: desktopRightRect.top + 0.355 * desktopRightRect.height,
    width: 0.112 * desktopRightRect.width,
    height: 0.2 * desktopRightRect.height,
  };

  const leftClipLimit = heroRect.left + Math.min(heroRect.width / 2, 660);
  const rightClipStart = heroRect.right - Math.min(heroRect.width / 2, 660);

  for (const avatar of [topLeftWoman, middleLeftWoman]) {
    expect(avatar.left).toBeGreaterThanOrEqual(heroRect.left);
    expect(avatar.right).toBeLessThanOrEqual(leftClipLimit);
    expect(avatar.top).toBeGreaterThanOrEqual(heroRect.top);
    expect(avatar.bottom).toBeLessThanOrEqual(heroRect.bottom);
  }

  expect(topRightMan.left).toBeGreaterThanOrEqual(rightClipStart);
  expect(topRightMan.right).toBeLessThanOrEqual(heroRect.right);
  expect(topRightMan.top).toBeGreaterThanOrEqual(heroRect.top);
  expect(topRightMan.bottom).toBeLessThanOrEqual(heroRect.bottom);

  for (const avatar of [topLeftWoman, middleLeftWoman, topRightMan]) {
    expect(boxesOverlap(avatar, headingRect)).toBe(false);
    expect(boxesOverlap(avatar, subtitleRect)).toBe(false);
    expect(boxesOverlap(avatar, ctaRect)).toBe(false);
  }
}

function assertTabletAvatarsUncroppedAndClear(
  metrics: HeroLayoutMetrics
): void {
  const {
    artworkLeftRect: tabletLeftRect,
    artworkRightRect: tabletRightRect,
    heroRect,
    headingRect,
    subtitleRect,
    ctaRect,
  } = metrics;

  expect(tabletLeftRect).not.toBeNull();
  expect(tabletRightRect).not.toBeNull();
  if (!tabletLeftRect || !tabletRightRect) return;

  expect(Math.abs(tabletLeftRect.left - heroRect.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(tabletRightRect.right - heroRect.right)).toBeLessThanOrEqual(
    1
  );
  expect(tabletLeftRect.top).toBeGreaterThanOrEqual(heroRect.top - 1);
  expect(tabletLeftRect.bottom).toBeLessThanOrEqual(heroRect.bottom + 1);
  expect(tabletRightRect.top).toBeGreaterThanOrEqual(heroRect.top - 1);
  expect(tabletRightRect.bottom).toBeLessThanOrEqual(heroRect.bottom + 1);

  const bottomLeftWoman: BoxRect = {
    left: tabletLeftRect.left,
    right: tabletLeftRect.left + (147 / 768) * tabletLeftRect.width,
    top: tabletLeftRect.top + (336 / 532) * tabletLeftRect.height,
    bottom: tabletLeftRect.bottom,
    width: (147 / 768) * tabletLeftRect.width,
    height: ((532 - 336) / 532) * tabletLeftRect.height,
  };

  const rightMan: BoxRect = {
    left: tabletRightRect.right - (136 / 768) * tabletRightRect.width,
    right: tabletRightRect.right,
    top: tabletRightRect.top + (165 / 532) * tabletRightRect.height,
    bottom: tabletRightRect.top + (373 / 532) * tabletRightRect.height,
    width: (136 / 768) * tabletRightRect.width,
    height: ((373 - 165) / 532) * tabletRightRect.height,
  };

  for (const avatar of [bottomLeftWoman, rightMan]) {
    expect(boxesOverlap(avatar, headingRect)).toBe(false);
    expect(boxesOverlap(avatar, subtitleRect)).toBe(false);
    expect(boxesOverlap(avatar, ctaRect)).toBe(false);
  }
}

function assertMobileArtworkAnchoredAndContained(
  metrics: HeroLayoutMetrics
): void {
  const {
    artworkLeftRect: mobileLeftRect,
    artworkRightRect: mobileRightRect,
    leftClipRect,
    rightClipRect,
    heroRect,
    ctaRect,
  } = metrics;

  expect(mobileLeftRect).not.toBeNull();
  expect(mobileRightRect).not.toBeNull();
  expect(leftClipRect).not.toBeNull();
  expect(rightClipRect).not.toBeNull();
  if (!mobileLeftRect || !mobileRightRect || !leftClipRect || !rightClipRect) {
    return;
  }

  expect(Math.abs(mobileLeftRect.left - heroRect.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(mobileRightRect.right - heroRect.right)).toBeLessThanOrEqual(
    1
  );
  expect(mobileLeftRect.top).toBeGreaterThanOrEqual(heroRect.top - 1);
  expect(mobileLeftRect.bottom).toBeLessThanOrEqual(heroRect.bottom + 1);
  expect(mobileRightRect.top).toBeGreaterThanOrEqual(heroRect.top - 1);
  expect(mobileRightRect.bottom).toBeLessThanOrEqual(heroRect.bottom + 1);

  const mobileClipLimit = Math.min(heroRect.width / 2, 180);
  expect(leftClipRect.right).toBeLessThanOrEqual(
    heroRect.left + mobileClipLimit + 1
  );
  expect(rightClipRect.left).toBeGreaterThanOrEqual(
    heroRect.right - mobileClipLimit - 1
  );

  expect(ctaRect.left).toBeGreaterThanOrEqual(heroRect.left + 16);
  expect(ctaRect.right).toBeLessThanOrEqual(heroRect.right - 16);
}

function assertVerticalBalanceAndNoHorizontalScroll(
  metrics: HeroLayoutMetrics,
  options: { requireAboveFoldCta?: boolean } = {}
): void {
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);

  const topGap = metrics.headingRect.top - metrics.heroRect.top;
  const bottomGap = metrics.heroRect.bottom - metrics.ctaRect.bottom;
  expect(topGap).toBeGreaterThanOrEqual(24);
  expect(bottomGap).toBeGreaterThanOrEqual(24);
  expect(Math.abs(topGap - bottomGap)).toBeLessThanOrEqual(12);

  if (options.requireAboveFoldCta) {
    expect(metrics.ctaRect.bottom).toBeLessThanOrEqual(metrics.viewportHeight);
  }
}

test.describe('首頁 Hero 多尺寸 RWD 與瀏覽器縮放等價 Viewport 回歸測試 (#892)', () => {
  test('Desktop 與縮小縮放等價尺寸（1024px–2560px 含極矮視窗）人物頭像完整顯示、字級無跳變且短視窗首屏可見 CTA', async ({
    page,
  }) => {
    const desktopViewports = [
      { width: 1024, height: 550, evidence: null },
      { width: 1024, height: 768, evidence: 'homepage-hero-1024x768-guest' },
      { width: 1280, height: 600, evidence: null },
      { width: 1280, height: 720, evidence: null },
      { width: 1440, height: 900, evidence: 'homepage-hero-1440x900-guest' },
      { width: 1536, height: 864, evidence: null },
      { width: 1920, height: 1080, evidence: 'homepage-hero-1920x1080-guest' },
      { width: 2560, height: 1440, evidence: null },
    ] as const;

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    for (const vp of desktopViewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const cta = page.getByTestId('homepage-cta-hero');
      await expect(cta).toBeVisible();
      await expect(cta).toHaveText('加入 X-Talent');

      await waitForHeroArtworkLoaded(page, 'home-page-hero.webp');
      const metrics = await collectHeroMetrics(page);
      assertVerticalBalanceAndNoHorizontalScroll(metrics, {
        requireAboveFoldCta: true,
      });
      assertDesktopAvatarsUncroppedAndClear(metrics);

      expect(metrics.headingFontSize).toBe('48px');
      expect(metrics.subtitleFontSize).toBe('24px');

      if (vp.evidence) {
        await captureEvidence(page, vp.evidence);
      }
    }
  });

  test('Tablet / Mobile 與高倍放大縮放等價尺寸（320px–1023px、960x600、720x450）背景不切臉、不重疊且短視窗 CTA 位於首屏內', async ({
    page,
  }) => {
    const subDesktopViewports = [
      {
        width: 320,
        height: 568,
        hasTabletSvg: false,
        aboveFold: true,
        evidence: null,
      },
      {
        width: 390,
        height: 844,
        hasTabletSvg: false,
        aboveFold: true,
        evidence: 'homepage-hero-390x844-guest',
      },
      {
        width: 640,
        height: 900,
        hasTabletSvg: true,
        aboveFold: true,
        evidence: 'homepage-hero-640x900-guest',
      },
      {
        width: 720,
        height: 450,
        hasTabletSvg: true,
        aboveFold: true,
        evidence: 'homepage-hero-720x450-zoom200-guest',
      },
      {
        width: 768,
        height: 1024,
        hasTabletSvg: true,
        aboveFold: true,
        evidence: null,
      },
      {
        width: 960,
        height: 600,
        hasTabletSvg: true,
        aboveFold: true,
        evidence: 'homepage-hero-960x600-zoom150-guest',
      },
      {
        width: 1023,
        height: 768,
        hasTabletSvg: true,
        aboveFold: true,
        evidence: null,
      },
    ] as const;

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    for (const vp of subDesktopViewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const cta = page.getByTestId('homepage-cta-hero');
      await expect(cta).toBeVisible();
      await expect(cta).toHaveText('加入 X-Talent');

      await waitForHeroArtworkLoaded(
        page,
        vp.hasTabletSvg ? 'home-page-hero-md.svg' : 'home-page-hero-sm.svg'
      );
      const metrics = await collectHeroMetrics(page);
      assertVerticalBalanceAndNoHorizontalScroll(metrics, {
        requireAboveFoldCta: vp.aboveFold,
      });

      if (vp.hasTabletSvg) {
        assertTabletAvatarsUncroppedAndClear(metrics);
      } else {
        assertMobileArtworkAnchoredAndContained(metrics);
      }

      if (vp.evidence) {
        await captureEvidence(page, vp.evidence);
      }
    }
  });

  test('已登入會員（尋找導師）於各 RWD 與縮放等價尺寸通過相同幾何與首屏可見性檢查', async ({
    page,
  }) => {
    await mockApiRoute(page, /\/v1\/users\/.*\/notifications\/unread-count/, {
      body: { code: '0', msg: 'ok', data: { unread_count: 0 } },
    });
    await seedMockAuthSession(page, {
      id: '999991',
      name: 'Test Member',
      isMentor: false,
      jobTitle: 'Product Designer',
      company: 'XChange',
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    const memberViewports = [
      { width: 1280, height: 600, mode: 'desktop', evidence: null },
      {
        width: 1280,
        height: 720,
        mode: 'desktop',
        evidence: 'homepage-hero-1280x720-member',
      },
      { width: 1920, height: 1080, mode: 'desktop', evidence: null },
      { width: 960, height: 600, mode: 'tablet', evidence: null },
      { width: 720, height: 450, mode: 'tablet', evidence: null },
      { width: 390, height: 844, mode: 'mobile', evidence: null },
    ] as const;

    for (const vp of memberViewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const cta = page.getByTestId('homepage-cta-hero');
      await expect(cta).toBeVisible();
      await expect(cta).toHaveText('尋找導師');
      await expect(cta).toHaveAttribute('href', '/mentor-pool');

      const expectedAsset =
        vp.mode === 'desktop'
          ? 'home-page-hero.webp'
          : vp.mode === 'tablet'
            ? 'home-page-hero-md.svg'
            : 'home-page-hero-sm.svg';
      await waitForHeroArtworkLoaded(page, expectedAsset);

      const metrics = await collectHeroMetrics(page);
      assertVerticalBalanceAndNoHorizontalScroll(metrics, {
        requireAboveFoldCta: true,
      });

      if (vp.mode === 'desktop') {
        assertDesktopAvatarsUncroppedAndClear(metrics);
      } else if (vp.mode === 'tablet') {
        assertTabletAvatarsUncroppedAndClear(metrics);
      } else {
        assertMobileArtworkAnchoredAndContained(metrics);
      }

      if (vp.evidence) {
        await captureEvidence(page, vp.evidence);
      }
    }
  });
});
