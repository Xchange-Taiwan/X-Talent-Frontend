import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ANALYTICS_FEATURES,
  getAnalyticsClickPayloadFromElement,
  initGa4,
  isAllowedAnalyticsUrl,
  isValidGaMeasurementId,
  resolveSafePageTitle,
  sanitizeAnalyticsMetadata,
  sanitizeUrlForAnalytics,
  SCROLL_DEPTH_THRESHOLDS,
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
    vi.unstubAllGlobals();
    mockGtag = vi.fn<(...args: unknown[]) => void>();
    mockClarity = vi.fn<(...args: unknown[]) => void>();
    if (typeof window !== 'undefined') {
      window.gtag = mockGtag;
      window.clarity = mockClarity;
      window.dataLayer = [];
      window.history.replaceState({}, '', '/');
    }
    if (typeof document !== 'undefined') {
      document.title = 'X-Talent | 站在前輩的肩膀上';
    }
  });

  afterEach(() => {
    // Unstub globals BEFORE touching window so SSR tests that stub window=undefined
    // never throw inside afterEach or poison subsequent test cases.
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (typeof window !== 'undefined') {
      delete window.gtag;
      window.clarity = undefined;
      delete window.dataLayer;
      window.history.replaceState({}, '', '/');
    }
  });

  describe('initGa4 & configuration', () => {
    it('aligns SCROLL_DEPTH_THRESHOLDS to [25, 50, 75, 100]', () => {
      expect(SCROLL_DEPTH_THRESHOLDS).toEqual([25, 50, 75, 100]);
    });

    it('initializes window.dataLayer and window.gtag queue without inline scripts when GA ID is valid', () => {
      delete window.gtag;
      delete window.dataLayer;
      window.history.replaceState(
        {},
        '',
        '/mentor-pool?token=secret123&filter_skills=frontend'
      );
      document.title = '尋找導師 | XChange Talent Pool';

      expect(isValidGaMeasurementId('G-TEST123456')).toBe(true);
      expect(isValidGaMeasurementId('invalid"><script>alert(1)</script>')).toBe(
        false
      );

      expect(initGa4('invalid-id')).toBe(false);
      expect(window.gtag).toBeUndefined();

      expect(initGa4('G-TEST123456')).toBe(true);
      expect(typeof window.gtag).toBe('function');
      expect(window.dataLayer).toHaveLength(2);
      expect(Object.prototype.toString.call(window.dataLayer?.[0])).toBe(
        '[object Arguments]'
      );
      expect(Array.from(window.dataLayer?.[0] as unknown as IArguments)).toEqual([
        'js',
        expect.any(Date),
      ]);
      expect(Array.from(window.dataLayer?.[1] as unknown as IArguments)).toEqual([
        'config',
        'G-TEST123456',
        {
          send_page_view: false,
          page_location: `${window.location.origin}/mentor-pool?filter_skills=frontend`,
          page_title: '尋找導師 | XChange Talent Pool',
        },
      ]);

      // Subsequent initGa4 with the same measurement ID is idempotent
      expect(initGa4('G-TEST123456')).toBe(true);
      expect(window.dataLayer).toHaveLength(2);

      // Chaining trackPageView pushes a queued ['event', 'page_view', payload] command
      trackPageView('/mentor-pool?token=secret123&filter_skills=frontend');
      expect(Array.from(window.dataLayer?.[2] as unknown as IArguments)).toEqual([
        'event',
        'page_view',
        {
          page_path: '/mentor-pool?filter_skills=frontend',
          page_location: `${window.location.origin}/mentor-pool?filter_skills=frontend`,
          page_title: '尋找導師 | XChange Talent Pool',
        },
      ]);
    });
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

    it('redacts dynamic user names from page_title on /profile/[id], /profile/[id]/edit, and stale mentor titles', () => {
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

      expect(
        resolveSafePageTitle(
          '/mentor-pool',
          '王小明 - 導師專業背景 | XChange Talent Pool'
        )
      ).toBe('User Profile');
    });

    it('preserves static /profile/card title without treating "card" as a user ID', () => {
      expect(resolveSafePageTitle('/profile/card', '完成個人名片')).toBe(
        '完成個人名片'
      );
    });
  });

  describe('trackScrollDepth', () => {
    it('dispatches single unified scroll_depth event with percent_scrolled and skips Clarity', () => {
      trackScrollDepth(100, '/mentor-pool');

      expect(mockGtag).toHaveBeenCalledWith('event', 'scroll_depth', {
        feature: 'engagement',
        percent_scrolled: 100,
        page_path: '/mentor-pool',
        page_location: `${window.location.origin}/`,
        page_title: 'X-Talent | 站在前輩的肩膀上',
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
        page_location: `${window.location.origin}/`,
        page_title: 'X-Talent | 站在前輩的肩膀上',
      });
      expect(mockClarity).toHaveBeenCalledWith('event', 'button_click');
      expect(mockClarity).toHaveBeenCalledWith('set', 'feature', 'auth');
      expect(mockClarity).toHaveBeenCalledWith(
        'set',
        'button_id',
        'header_signin'
      );
    });

    it('extracts click payload from nested child inside [data-analytics-click] link and ignores both inner and outer disabled ancestors', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <a href="/about?email=leak@example.com&ref=nav" data-analytics-click="header_nav_about" data-analytics-location="header" data-analytics-feature="navigation">
          <span id="inner-label">關於 X-Talent</span>
        </a>
        <button id="disabled-btn" disabled data-analytics-click="disabled_action">Disabled</button>
        <a id="aria-disabled-link" href="/mentor-pool" aria-disabled="true" data-analytics-click="disabled_link">Disabled Link</a>
        <div data-analytics-click="outer_wrapper">
          <button id="nested-disabled-btn" disabled><span id="nested-disabled-span">Inner</span></button>
        </div>
        <fieldset disabled>
          <button id="fieldset-disabled-btn" data-analytics-click="fieldset_action">Fieldset Disabled</button>
        </fieldset>
        <div aria-disabled="true">
          <span id="parent-aria-disabled-item" data-analytics-click="menu_item">Disabled Menu Item</span>
        </div>
      `;

      const innerSpan = container.querySelector('#inner-label');
      expect(getAnalyticsClickPayloadFromElement(innerSpan)).toEqual({
        buttonId: 'header_nav_about',
        location: 'header',
        destination: '/about?ref=nav',
        feature: 'navigation',
      });

      for (const selector of [
        '#disabled-btn',
        '#aria-disabled-link',
        '#nested-disabled-span',
        '#fieldset-disabled-btn',
        '#parent-aria-disabled-item',
      ]) {
        expect(
          getAnalyticsClickPayloadFromElement(container.querySelector(selector))
        ).toBeNull();
      }
    });

    it('supports custom snake_case eventName, safe data-analytics-param-* attributes, and destination omission', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <a
          id="mentor-card-link"
          href="/profile/7482008160728084"
          data-analytics-click="mentor_card"
          data-analytics-event="mentor_card_click"
          data-analytics-feature="mentor_pool"
          data-analytics-location="mentor_pool_list"
          data-analytics-param-mentor-id="7482008160728084"
          data-analytics-param-name="王小明"
          data-analytics-param-email="leak@example.com"
        >Card</a>
        <a
          id="social-link"
          href="https://www.linkedin.com/in/real-person-slug"
          data-analytics-click="profile_social_link"
          data-analytics-event="profile_social_link_click"
          data-analytics-feature="profile"
          data-analytics-omit-destination="true"
          data-analytics-param-platform="linkedin"
          data-analytics-param-mentor-id="7482008160728084"
        >LinkedIn</a>
      `;

      const mentorCardPayload = getAnalyticsClickPayloadFromElement(
        container.querySelector('#mentor-card-link')
      );
      expect(mentorCardPayload).toEqual({
        buttonId: 'mentor_card',
        eventName: 'mentor_card_click',
        location: 'mentor_pool_list',
        destination: '/profile/7482008160728084',
        feature: 'mentor_pool',
        metadata: {
          mentor_id: '7482008160728084',
        },
      });

      trackButtonClick(mentorCardPayload!);
      expect(mockGtag).toHaveBeenCalledWith('event', 'mentor_card_click', {
        feature: 'mentor_pool',
        mentor_id: '7482008160728084',
        button_id: 'mentor_card',
        button_location: 'mentor_pool_list',
        link_url: '/profile/7482008160728084',
        page_path: '/',
        page_location: `${window.location.origin}/`,
        page_title: 'X-Talent | 站在前輩的肩膀上',
      });

      const socialPayload = getAnalyticsClickPayloadFromElement(
        container.querySelector('#social-link')
      );
      expect(socialPayload).toEqual({
        buttonId: 'profile_social_link',
        eventName: 'profile_social_link_click',
        feature: 'profile',
        metadata: {
          platform: 'linkedin',
          mentor_id: '7482008160728084',
        },
      });
      expect(socialPayload?.destination).toBeUndefined();
    });

    it('omits unsafe or contact URI schemes (javascript:, data:, vbscript:, mailto:, tel:) from link destinations', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <a id="mailto-link" href="mailto:mentor@example.com" data-analytics-click="contact_email">Email</a>
        <a id="tel-link" href="tel:+886912345678" data-analytics-click="contact_phone">Phone</a>
        <a id="js-link" href="JavaScript:void(0)" data-analytics-click="noop_js">JS</a>
        <a id="data-link" href="data:text/html,<script>alert(1)</script>" data-analytics-click="noop_data">Data</a>
        <a id="vbs-link" href="vbscript:msgbox(1)" data-analytics-click="noop_vbs">VBS</a>
      `;

      for (const selector of [
        '#mailto-link',
        '#tel-link',
        '#js-link',
        '#data-link',
        '#vbs-link',
      ]) {
        const payload = getAnalyticsClickPayloadFromElement(
          container.querySelector(selector)
        );
        expect(payload?.destination).toBeUndefined();
      }

      expect(isAllowedAnalyticsUrl('mailto:user@example.com')).toBe(false);
      expect(isAllowedAnalyticsUrl('tel:+886912345678')).toBe(false);
      expect(isAllowedAnalyticsUrl('JavaScript:alert(1)')).toBe(false);
      expect(isAllowedAnalyticsUrl('data:text/plain,hello')).toBe(false);
      expect(isAllowedAnalyticsUrl('vbscript:msgbox(1)')).toBe(false);
      expect(isAllowedAnalyticsUrl('//evil.example.com/path')).toBe(false);
      expect(
        isAllowedAnalyticsUrl(`/${String.fromCharCode(92)}evil.example.com`)
      ).toBe(false);
      expect(isAllowedAnalyticsUrl('/mentor-pool')).toBe(true);
      expect(isAllowedAnalyticsUrl('http://localhost:3000/about')).toBe(true);
      expect(
        isAllowedAnalyticsUrl('https://xtalent.xchange.com.tw/about')
      ).toBe(true);
    });
  });

  describe('trackEvent & setAnalyticsTag', () => {
    it('sends standard events to GA4 with sanitized page context and sets scrubbed session tags in Clarity', () => {
      expect(ANALYTICS_FEATURES).toContain('mentor_pool');

      trackEvent({
        name: 'sign_in_succeeded',
        feature: 'auth',
        metadata: { method: 'google', email: 'leak@example.com' },
      });

      expect(mockGtag).toHaveBeenCalledWith('event', 'sign_in_succeeded', {
        feature: 'auth',
        method: 'google',
        page_location: `${window.location.origin}/`,
        page_title: 'X-Talent | 站在前輩的肩膀上',
      });
      expect(mockClarity).toHaveBeenCalledWith('event', 'sign_in_succeeded');
      expect(mockClarity).toHaveBeenCalledWith('set', 'feature', 'auth');
      expect(mockClarity).toHaveBeenCalledWith('set', 'method', 'google');
      expect(mockClarity).not.toHaveBeenCalledWith(
        'set',
        'email',
        expect.anything()
      );
    });

    it('overrides page_location and page_title on non-page_view events so gtag never reads raw URL secrets or profile names', () => {
      window.history.replaceState(
        {},
        '',
        '/profile/7482008160728084?token=secret123&q=%E7%8E%8B%E5%B0%8F%E6%98%8E'
      );
      document.title = '王小明 - 導師專業背景 | XChange Talent Pool';

      trackEvent({
        name: 'profile_tab_click',
        feature: 'profile',
        metadata: { tab_name: 'feedback', mentor_id: '7482008160728084' },
      });

      expect(mockGtag).toHaveBeenCalledWith('event', 'profile_tab_click', {
        feature: 'profile',
        tab_name: 'feedback',
        mentor_id: '7482008160728084',
        page_location: `${window.location.origin}/profile/7482008160728084`,
        page_title: 'User Profile',
      });
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
          page_location: `${window.location.origin}/`,
          page_title: 'X-Talent | 站在前輩的肩膀上',
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
      try {
        expect(() => {
          expect(initGa4('G-TEST123456')).toBe(false);
          trackPageView('/');
          trackScrollDepth(50, '/');
          trackButtonClick({ buttonId: 'cta_hero' });
          trackEvent({ name: 'sign_up_started', feature: 'auth' });
          setAnalyticsTag('role', 'mentee');
        }).not.toThrow();
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  describe('PII redaction guardrails', () => {
    it('strips email, name, token, password, free-text query, and sensitive values from metadata', () => {
      const sanitized = sanitizeAnalyticsMetadata({
        step: 2,
        is_mentor: true,
        cta: 'hero',
        filter_type: 'filter_skills',
        filter_value: 'frontend',
        email: 'mentee@example.com',
        user_email: 'mentor@example.com',
        name: '陳大文',
        full_name: 'Chen Da Wen',
        q: '王小明',
        search_pattern: '陳大文',
        access_token: 'secret-access-token',
        idToken: 'secret-id-token',
        password: 'hunter2',
        leaked_email_in_note: 'reach me at leak@example.com',
        leaked_mailto: 'mailto:leak@example.com',
        leaked_tel: 'tel:+886912345678',
        leaked_data_uri: 'data:text/html,<script>alert(1)</script>',
        leaked_vbscript: 'vbscript:msgbox(1)',
        leaked_jwt:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
        leaked_bearer: 'Bearer sk_live_1234567890abcdef',
      });

      expect(sanitized).toEqual({
        step: 2,
        is_mentor: true,
        cta: 'hero',
        filter_type: 'filter_skills',
        filter_value: 'frontend',
      });
    });

    it('recursively scrubs nested callbackUrl params, strips free-text search queries, and redacts PII path segments', () => {
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

      // Nested callbackUrl carrying token & email must have inner query secrets stripped
      expect(
        sanitizeUrlForAnalytics(
          '/auth/signin?callbackUrl=%2Fauth%2Femail-verify%3Ftoken%3Dsecret123%26email%3Dleak%40example.com%26source%3Dbanner'
        )
      ).toBe(
        '/auth/signin?callbackUrl=%2Fauth%2Femail-verify%3Fsource%3Dbanner'
      );

      // Double-encoded nested callbackUrl is also decoded and scrubbed
      expect(
        sanitizeUrlForAnalytics(
          '/auth/signin?callbackUrl=%252Fauth%252Femail-verify%253Ftoken%253Dsecret123%2526source%253Dbanner'
        )
      ).toBe(
        '/auth/signin?callbackUrl=%2Fauth%2Femail-verify%3Fsource%3Dbanner'
      );

      // Overly deep nested callbackUrl (> 3 levels) fails closed and drops the deepest callbackUrl
      const level4 = encodeURIComponent('/final?token=deepSecret&ok=1');
      const level3 = encodeURIComponent(`/step3?callbackUrl=${level4}`);
      const level2 = encodeURIComponent(`/step2?callbackUrl=${level3}`);
      const level1 = encodeURIComponent(`/step1?callbackUrl=${level2}`);
      const deepSanitized = sanitizeUrlForAnalytics(
        `/auth/signin?callbackUrl=${level1}`
      );
      expect(deepSanitized).not.toContain('deepSecret');

      // Free-text search query ?q= stripped while structured catalog filter codes stay intact
      expect(
        sanitizeUrlForAnalytics(
          '/mentor-pool?q=%E7%8E%8B%E5%B0%8F%E6%98%8E&filter_skills=frontend&filter_industries=tech'
        )
      ).toBe('/mentor-pool?filter_skills=frontend&filter_industries=tech');

      // Path segment containing email or JWT is redacted to root path
      expect(
        sanitizeUrlForAnalytics('/invite/private@example.com/accept')
      ).toBe('/');
      expect(
        sanitizeUrlForAnalytics('https://xtalent.tw/invite/user%40example.com')
      ).toBe('https://xtalent.tw/');

      // Non-HTTP URI schemes return safe fallback '/'
      expect(sanitizeUrlForAnalytics('mailto:user@example.com')).toBe('/');
      expect(sanitizeUrlForAnalytics('tel:+886912345678')).toBe('/');
      expect(sanitizeUrlForAnalytics('javascript:alert(1)')).toBe('/');
      expect(
        sanitizeUrlForAnalytics('data:text/html,<script>alert(1)</script>')
      ).toBe('/');
      expect(sanitizeUrlForAnalytics('vbscript:msgbox(1)')).toBe('/');
    });
  });
});
