import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getAnalyticsClickPayloadFromElement,
  resolveSafePageTitle,
  sanitizeAnalyticsMetadata,
  sanitizeUrlForAnalytics,
  setAnalyticsTag,
  trackButtonClick,
  trackEvent,
  trackPageView,
  trackScrollDepth,
} from './analytics';

describe('analytics', () => {
  let mockGtag: ReturnType<typeof vi.fn<(...args: unknown[]) => void>>;
  let mockClarity: ReturnType<typeof vi.fn<(...args: unknown[]) => void>>;

  beforeEach(() => {
    mockGtag = vi.fn<(...args: unknown[]) => void>();
    mockClarity = vi.fn<(...args: unknown[]) => void>();
    window.gtag = mockGtag;
    window.clarity = mockClarity;
    window.dataLayer = [];
    window.history.replaceState({}, '', '/');
    document.title = 'X-Talent | 站在前輩的肩膀上';
  });

  afterEach(() => {
    delete window.gtag;
    delete window.clarity;
    delete window.dataLayer;
    window.history.replaceState({}, '', '/');
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('trackPageView', () => {
    it('dispatches GA4 page_view event with sanitized path, location, and title via gtag', () => {
      trackPageView('/mentor-pool', { origin: 'https://xtalent.tw' });

      expect(mockGtag).toHaveBeenCalledWith('event', 'page_view', {
        page_path: '/mentor-pool',
        page_location: 'https://xtalent.tw/mentor-pool',
        page_title: 'X-Talent | 站在前輩的肩膀上',
      });
    });

    it('falls back to pushing page_view into window.dataLayer when window.gtag is unavailable', () => {
      delete window.gtag;
      window.dataLayer = [];
      window.history.replaceState({}, '', '/about');

      trackPageView('/about', { title: '關於 X-Talent' });

      expect(window.dataLayer).toEqual([
        {
          event: 'page_view',
          page_path: '/about',
          page_location: `${window.location.origin}/about`,
          page_title: '關於 X-Talent',
        },
      ]);
    });

    it('redacts dynamic user names from page_title on /profile/[id] and /profile/[id]/edit routes', () => {
      document.title = '王小明 - 導師專業背景';
      trackPageView('/profile/7482008160728084', {
        origin: 'https://xtalent.tw',
      });

      expect(mockGtag).toHaveBeenCalledWith('event', 'page_view', {
        page_path: '/profile/7482008160728084',
        page_location: 'https://xtalent.tw/profile/7482008160728084',
        page_title: 'User Profile',
      });

      mockGtag.mockClear();
      trackPageView('/profile/7482008160728084/edit?mentor-onboarding=true', {
        origin: 'https://xtalent.tw',
      });

      expect(mockGtag).toHaveBeenCalledWith('event', 'page_view', {
        page_path: '/profile/7482008160728084/edit?mentor-onboarding=true',
        page_location:
          'https://xtalent.tw/profile/7482008160728084/edit?mentor-onboarding=true',
        page_title: 'Profile Edit',
      });
    });

    it('preserves static /profile/card title without treating "card" as a user ID', () => {
      expect(resolveSafePageTitle('/profile/card', '完成個人名片')).toBe(
        '完成個人名片'
      );
    });
  });

  describe('trackScrollDepth', () => {
    it('dispatches single unified scroll_depth event with percent_scrolled and skips Clarity', () => {
      trackScrollDepth(50, '/mentor-pool');

      expect(mockGtag).toHaveBeenCalledWith('event', 'scroll_depth', {
        feature: 'engagement',
        percent_scrolled: 50,
        page_path: '/mentor-pool',
      });
      expect(mockClarity).not.toHaveBeenCalled();
    });

    it('ignores out-of-range or non-finite scroll percentages', () => {
      trackScrollDepth(0, '/');
      trackScrollDepth(-25, '/');
      trackScrollDepth(120, '/');
      trackScrollDepth(Number.NaN, '/');

      expect(mockGtag).not.toHaveBeenCalled();
    });
  });

  describe('trackButtonClick & declarative click delegation', () => {
    it('dispatches button_click with sanitized button_id, location, destination, and page_path', () => {
      trackButtonClick({
        buttonId: 'header_signin',
        location: 'header',
        destination: '/auth/signin?token=secret-jwt&callbackUrl=%2Fmentor-pool',
        feature: 'auth',
      });

      expect(mockGtag).toHaveBeenCalledWith('event', 'button_click', {
        feature: 'auth',
        button_id: 'header_signin',
        button_location: 'header',
        link_url: '/auth/signin?callbackUrl=%2Fmentor-pool',
        page_path: '/',
      });
      expect(mockClarity).toHaveBeenCalledWith('event', 'button_click');
    });

    it('extracts click payload from nested child inside [data-analytics-click] link and ignores disabled elements', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <a href="/about?email=leak@example.com&ref=nav" data-analytics-click="header_nav_about" data-analytics-location="header" data-analytics-feature="navigation">
          <span id="inner-label">關於 X-Talent</span>
        </a>
        <button id="disabled-btn" disabled data-analytics-click="disabled_action">Disabled</button>
        <a id="aria-disabled-link" href="/mentor-pool" aria-disabled="true" data-analytics-click="disabled_link">Disabled Link</a>
      `;

      const innerSpan = container.querySelector('#inner-label');
      expect(getAnalyticsClickPayloadFromElement(innerSpan)).toEqual({
        buttonId: 'header_nav_about',
        location: 'header',
        destination: '/about?ref=nav',
        feature: 'navigation',
      });

      const disabledBtn = container.querySelector('#disabled-btn');
      expect(getAnalyticsClickPayloadFromElement(disabledBtn)).toBeNull();

      const ariaDisabledLink = container.querySelector('#aria-disabled-link');
      expect(getAnalyticsClickPayloadFromElement(ariaDisabledLink)).toBeNull();
    });
  });

  describe('trackEvent & setAnalyticsTag', () => {
    it('sends standard events to both GA4 and Clarity', () => {
      trackEvent({
        name: 'sign_in_succeeded',
        feature: 'auth',
        metadata: { method: 'google' },
      });

      expect(mockGtag).toHaveBeenCalledWith('event', 'sign_in_succeeded', {
        feature: 'auth',
        method: 'google',
      });
      expect(mockClarity).toHaveBeenCalledWith('event', 'sign_in_succeeded');
    });

    it('bypasses Microsoft Clarity when skipClarity is true', () => {
      trackEvent(
        {
          name: 'performance_lcp_measured',
          feature: 'performance',
          metadata: { raw_value: 2500, rating: 'good' },
        },
        { skipClarity: true }
      );

      expect(mockGtag).toHaveBeenCalledWith(
        'event',
        'performance_lcp_measured',
        {
          feature: 'performance',
          raw_value: 2500,
          rating: 'good',
        }
      );
      expect(mockClarity).not.toHaveBeenCalled();
    });

    it('sets non-PII analytics tags in Clarity and blocks PII tags', () => {
      setAnalyticsTag('onboarding_step', '3');
      setAnalyticsTag('email', 'user@example.com');
      setAnalyticsTag('user_hint', 'contact user@example.com');

      expect(mockClarity).toHaveBeenCalledTimes(1);
      expect(mockClarity).toHaveBeenCalledWith('set', 'onboarding_step', '3');
    });

    it('no-ops safely during SSR when window is undefined', () => {
      vi.stubGlobal('window', undefined);

      expect(() => {
        trackPageView('/');
        trackScrollDepth(50, '/');
        trackButtonClick({ buttonId: 'cta_hero' });
        trackEvent({ name: 'sign_up_started', feature: 'auth' });
        setAnalyticsTag('role', 'mentee');
      }).not.toThrow();
    });
  });

  describe('PII redaction guardrails', () => {
    it('strips email, name, token, password, and sensitive values from metadata', () => {
      const sanitized = sanitizeAnalyticsMetadata({
        step: 2,
        is_mentor: true,
        cta: 'hero',
        email: 'mentee@example.com',
        user_email: 'mentor@example.com',
        name: '陳大文',
        full_name: 'Chen Da Wen',
        access_token: 'secret-access-token',
        idToken: 'secret-id-token',
        password: 'hunter2',
        leaked_email_in_note: 'reach me at leak@example.com',
        leaked_jwt:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
        leaked_bearer: 'Bearer sk_live_1234567890abcdef',
      });

      expect(sanitized).toEqual({
        step: 2,
        is_mentor: true,
        cta: 'hero',
      });
    });

    it('strips sensitive query params and hash fragments from URLs while keeping safe params', () => {
      expect(
        sanitizeUrlForAnalytics(
          'https://xtalent.tw/auth/email-verify?token=abc123&email=user@example.com&source=banner#id_token=xyz'
        )
      ).toBe('https://xtalent.tw/auth/email-verify?source=banner');

      expect(
        sanitizeUrlForAnalytics(
          '/auth/google/callback/redirect?code=4%2F0AX4XfWh&state=csrf123'
        )
      ).toBe('/auth/google/callback/redirect');
    });
  });
});
