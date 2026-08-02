import { fromPartial } from '@total-typescript/shoehorn';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setAnalyticsTag, trackEvent, trackPageView } from './analytics';

describe('analytics', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_GA_ID: 'GA-12345',
      NEXT_PUBLIC_CLARITY_ID: 'CLARITY-12345',
      NODE_ENV: 'test',
    };

    // Setup global window properties as mocks using fromPartial
    global.window = fromPartial({
      gtag: vi.fn(),
      clarity: vi.fn(),
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    delete (global as { window?: unknown }).window;
  });

  it('sends events to both GA4 and Clarity for standard features', () => {
    trackEvent({
      name: 'auth_sign_in_succeeded',
      feature: 'auth',
      metadata: { method: 'google' },
    });

    const mockGtag = vi.mocked(global.window.gtag);
    const mockClarity = vi.mocked(global.window.clarity!);

    expect(mockGtag).toHaveBeenCalledWith('event', 'auth_sign_in_succeeded', {
      feature: 'auth',
      method: 'google',
    });

    expect(mockClarity).toHaveBeenCalledWith('event', 'auth_sign_in_succeeded');
    expect(mockClarity).toHaveBeenCalledWith('set', 'feature', 'auth');
    expect(mockClarity).toHaveBeenCalledWith('set', 'method', 'google');
  });

  it('bypasses Microsoft Clarity when skipClarity is true but sends to GA4', () => {
    trackEvent({
      name: 'performance_lcp_measured',
      feature: 'performance',
      metadata: { raw_value: 2500, rating: 'needs-improvement' },
      skipClarity: true,
    });

    const mockGtag = vi.mocked(global.window.gtag);
    const mockClarity = vi.mocked(global.window.clarity!);

    expect(mockGtag).toHaveBeenCalledWith('event', 'performance_lcp_measured', {
      feature: 'performance',
      raw_value: 2500,
      rating: 'needs-improvement',
    });

    expect(mockClarity).not.toHaveBeenCalled();
  });

  it('tracks page views correctly', () => {
    trackPageView('/test-path');

    const mockGtag = vi.mocked(global.window.gtag);
    expect(mockGtag).toHaveBeenCalledWith('config', 'GA-12345', {
      page_path: '/test-path',
    });
  });

  it('sets analytics tags in Clarity', () => {
    setAnalyticsTag('test_key', 'test_value');

    const mockClarity = vi.mocked(global.window.clarity!);
    expect(mockClarity).toHaveBeenCalledWith('set', 'test_key', 'test_value');
  });
});
