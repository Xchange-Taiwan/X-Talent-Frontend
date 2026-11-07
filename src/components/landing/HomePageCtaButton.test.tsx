import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseResolvedIdentity = vi.fn();
vi.mock('@/hooks/user/auth/useResolvedIdentity', () => ({
  useResolvedIdentity: () => mockUseResolvedIdentity(),
}));

import {
  authenticatedIdentity,
  buildResolvedIdentity,
  GUEST_IDENTITY,
  UNKNOWN_IDENTITY,
} from '@/test/mocks/identity';

import { HomePageCtaButton, resolveHomePageCta } from './HomePageCtaButton';

describe('HomePageCtaButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseResolvedIdentity.mockReturnValue(GUEST_IDENTITY);
  });

  describe('resolveHomePageCta', () => {
    it('resolves visitor CTAs to signup with role-appropriate labels', () => {
      expect(resolveHomePageCta('hero', GUEST_IDENTITY)).toEqual({
        label: '加入 X-Talent',
        href: '/auth/signup',
        disabled: false,
      });
      expect(resolveHomePageCta('role', GUEST_IDENTITY)).toEqual({
        label: '成為 Mentor/Mentee',
        href: '/auth/signup',
        disabled: false,
      });
      expect(resolveHomePageCta('closing', GUEST_IDENTITY)).toEqual({
        label: '加入 X-Talent',
        href: '/auth/signup',
        disabled: false,
      });
    });

    it('resolves mentee CTAs to mentor-pool and mentor-onboarding', () => {
      const menteeIdentity = authenticatedIdentity('user-42', {
        isMentor: false,
      });

      expect(resolveHomePageCta('hero', menteeIdentity)).toEqual({
        label: '尋找導師',
        href: '/mentor-pool',
        disabled: false,
      });
      expect(resolveHomePageCta('role', menteeIdentity)).toEqual({
        label: '成為 Mentor',
        href: '/profile/user-42/edit?mentor-onboarding=true',
        disabled: false,
      });
      expect(resolveHomePageCta('closing', menteeIdentity)).toEqual({
        label: '尋找導師',
        href: '/mentor-pool',
        disabled: false,
      });
    });

    it('resolves mentor CTAs to mentor-pool and profile schedule management', () => {
      const mentorIdentity = authenticatedIdentity('mentor-99', {
        isMentor: true,
      });

      expect(resolveHomePageCta('hero', mentorIdentity)).toEqual({
        label: '尋找導師',
        href: '/mentor-pool',
        disabled: false,
      });
      expect(resolveHomePageCta('role', mentorIdentity)).toEqual({
        label: '開放預約時段',
        href: '/profile/mentor-99?open-schedule=true',
        disabled: false,
      });
      expect(resolveHomePageCta('closing', mentorIdentity)).toEqual({
        label: '尋找導師',
        href: '/mentor-pool',
        disabled: false,
      });
    });
  });

  describe('rendered links per role', () => {
    it('renders visitor CTAs pointing to /auth/signup', () => {
      mockUseResolvedIdentity.mockReturnValue(GUEST_IDENTITY);

      render(
        <div>
          <HomePageCtaButton variant="hero" />
          <HomePageCtaButton variant="role" />
          <HomePageCtaButton variant="closing" />
        </div>
      );

      const heroLink = screen.getByTestId('homepage-cta-hero');
      const roleLink = screen.getByTestId('homepage-cta-role');
      const closingLink = screen.getByTestId('homepage-cta-closing');

      expect(heroLink).toHaveTextContent('加入 X-Talent');
      expect(heroLink).toHaveAttribute('href', '/auth/signup');

      expect(roleLink).toHaveTextContent('成為 Mentor/Mentee');
      expect(roleLink).toHaveAttribute('href', '/auth/signup');

      expect(closingLink).toHaveTextContent('加入 X-Talent');
      expect(closingLink).toHaveAttribute('href', '/auth/signup');
    });

    it('renders mentee CTAs pointing to /mentor-pool and mentor onboarding', () => {
      mockUseResolvedIdentity.mockReturnValue(
        authenticatedIdentity('mentee-10', { isMentor: false })
      );

      render(
        <div>
          <HomePageCtaButton variant="hero" />
          <HomePageCtaButton variant="role" />
          <HomePageCtaButton variant="closing" />
        </div>
      );

      const heroLink = screen.getByTestId('homepage-cta-hero');
      const roleLink = screen.getByTestId('homepage-cta-role');
      const closingLink = screen.getByTestId('homepage-cta-closing');

      expect(heroLink).toHaveTextContent('尋找導師');
      expect(heroLink).toHaveAttribute('href', '/mentor-pool');

      expect(roleLink).toHaveTextContent('成為 Mentor');
      expect(roleLink).toHaveAttribute(
        'href',
        '/profile/mentee-10/edit?mentor-onboarding=true'
      );

      expect(closingLink).toHaveTextContent('尋找導師');
      expect(closingLink).toHaveAttribute('href', '/mentor-pool');
    });

    it('renders mentor CTAs pointing to /mentor-pool and profile schedule management', () => {
      mockUseResolvedIdentity.mockReturnValue(
        authenticatedIdentity('mentor-77', { isMentor: true })
      );

      render(
        <div>
          <HomePageCtaButton variant="hero" />
          <HomePageCtaButton variant="role" />
          <HomePageCtaButton variant="closing" />
        </div>
      );

      const heroLink = screen.getByTestId('homepage-cta-hero');
      const roleLink = screen.getByTestId('homepage-cta-role');
      const closingLink = screen.getByTestId('homepage-cta-closing');

      expect(heroLink).toHaveTextContent('尋找導師');
      expect(heroLink).toHaveAttribute('href', '/mentor-pool');

      expect(roleLink).toHaveTextContent('開放預約時段');
      expect(roleLink).toHaveAttribute(
        'href',
        '/profile/mentor-77?open-schedule=true'
      );

      expect(closingLink).toHaveTextContent('尋找導師');
      expect(closingLink).toHaveAttribute('href', '/mentor-pool');
    });

    it('disables the role CTA while in hint-only state (before userId settles) while keeping hero/closing active', () => {
      mockUseResolvedIdentity.mockReturnValue(
        buildResolvedIdentity({
          state: 'hint-only',
          isMentor: true,
        })
      );

      render(
        <div>
          <HomePageCtaButton variant="hero" />
          <HomePageCtaButton variant="role" />
          <HomePageCtaButton variant="closing" />
        </div>
      );

      const heroLink = screen.getByTestId('homepage-cta-hero');
      const roleLink = screen.getByTestId('homepage-cta-role');
      const closingLink = screen.getByTestId('homepage-cta-closing');

      expect(heroLink).toHaveAttribute('href', '/mentor-pool');
      expect(heroLink).toHaveAttribute('aria-disabled', 'false');

      expect(closingLink).toHaveAttribute('href', '/mentor-pool');
      expect(closingLink).toHaveAttribute('aria-disabled', 'false');

      expect(roleLink).toHaveTextContent('開放預約時段');
      expect(roleLink).toHaveAttribute('href', '#');
      expect(roleLink).toHaveAttribute('aria-disabled', 'true');

      const notPrevented = fireEvent.click(roleLink);
      expect(notPrevented).toBe(false);
    });

    it('renders CSS-gated links when identity state is unknown to prevent role flash', () => {
      mockUseResolvedIdentity.mockReturnValue(UNKNOWN_IDENTITY);

      render(
        <div>
          <HomePageCtaButton variant="hero" />
          <HomePageCtaButton variant="role" />
        </div>
      );

      const guestHero = screen.getByRole('link', { name: '加入 X-Talent' });
      const memberHero = screen.getByRole('link', { name: '尋找導師' });
      expect(guestHero).toHaveClass(
        'hidden',
        'group-data-[auth-state=guest]/auth-state:inline-flex'
      );
      expect(memberHero).toHaveClass(
        'hidden',
        'group-data-[auth-state=mentee]/auth-state:inline-flex',
        'group-data-[auth-state=mentor]/auth-state:inline-flex'
      );

      const guestRole = screen.getByRole('link', {
        name: '成為 Mentor/Mentee',
      });
      const menteeRole = screen.getByRole('link', { name: '成為 Mentor' });
      const mentorRole = screen.getByRole('link', { name: '開放預約時段' });
      expect(guestRole).toHaveClass(
        'hidden',
        'group-data-[auth-state=guest]/auth-state:inline-flex'
      );
      expect(menteeRole).toHaveClass(
        'hidden',
        'group-data-[auth-state=mentee]/auth-state:inline-flex'
      );
      expect(mentorRole).toHaveClass(
        'hidden',
        'group-data-[auth-state=mentor]/auth-state:inline-flex'
      );
    });
  });
});
