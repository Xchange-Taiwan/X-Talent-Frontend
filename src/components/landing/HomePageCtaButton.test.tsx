import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseResolvedIdentity = vi.fn();
vi.mock('@/hooks/user/auth/useResolvedIdentity', () => ({
  useResolvedIdentity: () => mockUseResolvedIdentity(),
}));

const mockTrackEvent = vi.fn();
vi.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

import {
  authenticatedIdentity,
  buildResolvedIdentity,
  GUEST_IDENTITY,
  UNKNOWN_IDENTITY,
} from '@/test/mocks/identity';

import {
  HOMEPAGE_CTA_CLICK_EVENT,
  HomePageCtaButton,
  resolveHomePageCta,
} from './HomePageCtaButton';

function renderAllVariants() {
  return render(
    <div>
      <HomePageCtaButton variant="hero" />
      <HomePageCtaButton variant="role" />
      <HomePageCtaButton variant="closing" />
    </div>
  );
}

describe('HomePageCtaButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseResolvedIdentity.mockReturnValue(GUEST_IDENTITY);
  });

  it.each([
    [
      'visitor',
      GUEST_IDENTITY,
      [
        ['homepage-cta-hero', 'hero', 'hero', '加入 X-Talent', '/auth/signup'],
        [
          'homepage-cta-role',
          'role',
          'shared',
          '成為 Mentor/Mentee',
          '/auth/signup',
        ],
        [
          'homepage-cta-closing',
          'closing',
          'closing',
          '加入 X-Talent',
          '/auth/signup',
        ],
      ],
    ],
    [
      'mentee',
      authenticatedIdentity('mentee-10', { isMentor: false }),
      [
        ['homepage-cta-hero', 'hero', 'hero', '尋找導師', '/mentor-pool'],
        [
          'homepage-cta-role',
          'role',
          'shared',
          '成為 Mentor',
          '/profile/mentee-10/edit?mentor-onboarding=true',
        ],
        [
          'homepage-cta-closing',
          'closing',
          'closing',
          '尋找導師',
          '/mentor-pool',
        ],
      ],
    ],
    [
      'mentor',
      authenticatedIdentity('mentor-77', { isMentor: true }),
      [
        ['homepage-cta-hero', 'hero', 'hero', '尋找導師', '/mentor-pool'],
        [
          'homepage-cta-role',
          'role',
          'shared',
          '開放預約時段',
          '/profile/mentor-77?open-schedule=true',
        ],
        [
          'homepage-cta-closing',
          'closing',
          'closing',
          '尋找導師',
          '/mentor-pool',
        ],
      ],
    ],
  ] as const)(
    'resolves and renders %s CTAs with data-cta attributes and fires GA4 trackEvent on click',
    (_role, identity, cases) => {
      mockUseResolvedIdentity.mockReturnValue(identity);
      renderAllVariants();

      for (const [testId, variant, cta, label, href] of cases) {
        expect(resolveHomePageCta(variant, identity)).toEqual({
          label,
          href,
          disabled: false,
        });
        const link = screen.getByTestId(testId);
        expect(link).toHaveTextContent(label);
        expect(link).toHaveAttribute('href', href);
        expect(link).toHaveAttribute('data-cta', cta);

        fireEvent.click(link);
        expect(mockTrackEvent).toHaveBeenLastCalledWith({
          name: HOMEPAGE_CTA_CLICK_EVENT,
          metadata: { cta, variant, label },
        });
      }
    }
  );

  it('disables role CTA in hint-only state and prevents GA4 event on disabled click', () => {
    mockUseResolvedIdentity.mockReturnValue(
      buildResolvedIdentity({ state: 'hint-only', isMentor: true })
    );
    renderAllVariants();

    const heroLink = screen.getByTestId('homepage-cta-hero');
    const roleLink = screen.getByTestId('homepage-cta-role');

    expect(heroLink).toHaveAttribute('href', '/mentor-pool');
    expect(heroLink).toHaveAttribute('aria-disabled', 'false');
    expect(roleLink).toHaveTextContent('開放預約時段');
    expect(roleLink).toHaveAttribute('href', '#');
    expect(roleLink).toHaveAttribute('aria-disabled', 'true');

    expect(fireEvent.click(roleLink)).toBe(false);
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it('renders CSS-gated links when identity state is unknown to prevent role flash', () => {
    mockUseResolvedIdentity.mockReturnValue(UNKNOWN_IDENTITY);
    render(
      <div>
        <HomePageCtaButton variant="hero" />
        <HomePageCtaButton variant="role" />
      </div>
    );

    for (const [name, gate] of [
      ['加入 X-Talent', 'group-data-[auth-state=guest]/auth-state:inline-flex'],
      ['尋找導師', 'group-data-[auth-state=mentee]/auth-state:inline-flex'],
      [
        '成為 Mentor/Mentee',
        'group-data-[auth-state=guest]/auth-state:inline-flex',
      ],
      ['成為 Mentor', 'group-data-[auth-state=mentee]/auth-state:inline-flex'],
      ['開放預約時段', 'group-data-[auth-state=mentor]/auth-state:inline-flex'],
    ] as const) {
      expect(screen.getByRole('link', { name })).toHaveClass('hidden', gate);
    }
  });
});
