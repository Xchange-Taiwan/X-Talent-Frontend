import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseResolvedIdentity = vi.fn();
vi.mock('@/hooks/user/auth/useResolvedIdentity', () => ({
  useResolvedIdentity: () => mockUseResolvedIdentity(),
}));

import {
  authenticatedIdentity,
  GUEST_IDENTITY,
  UNKNOWN_IDENTITY,
} from '@/test/mocks/identity';

import { DualTrackSection } from './DualTrackSection';

describe('DualTrackSection (#836 A-1 & #970 release gate)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_ENABLE_DUAL_TRACK_V2', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders nothing when NEXT_PUBLIC_ENABLE_DUAL_TRACK_V2 is disabled by default (#970)', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_DUAL_TRACK_V2', '');
    mockUseResolvedIdentity.mockReturnValue(GUEST_IDENTITY);
    const { container } = render(<DualTrackSection />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('一個帳號，雙軌成長')).not.toBeInTheDocument();
  });

  it('renders skeleton instead of guest CTA while identity is unknown (preventing role flash)', () => {
    mockUseResolvedIdentity.mockReturnValue(UNKNOWN_IDENTITY);
    render(<DualTrackSection />);

    expect(
      screen.getByTestId('homepage-cta-dual-track-skeleton')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('homepage-cta-dual-track')
    ).not.toBeInTheDocument();
  });

  it('renders 加入 X-Talent -> /auth/signup for confirmed guests', () => {
    mockUseResolvedIdentity.mockReturnValue(GUEST_IDENTITY);
    render(<DualTrackSection />);

    const cta = screen.getByTestId('homepage-cta-dual-track');
    expect(cta).toHaveTextContent('加入 X-Talent');
    expect(cta).toHaveAttribute('href', '/auth/signup');
  });

  it('renders 成為導師 for confirmed Mentee and 探索導師池 for confirmed Mentor, and disables hint-only Mentee link', () => {
    mockUseResolvedIdentity.mockReturnValue(
      authenticatedIdentity('42', { isMentor: false })
    );
    const { rerender } = render(<DualTrackSection />);

    expect(screen.getByTestId('homepage-cta-dual-track')).toHaveTextContent(
      '成為導師'
    );
    expect(screen.getByTestId('homepage-cta-dual-track')).toHaveAttribute(
      'href',
      '/profile/42/edit?mentor-onboarding=true'
    );

    mockUseResolvedIdentity.mockReturnValue(
      authenticatedIdentity('88', { isMentor: true })
    );
    rerender(<DualTrackSection />);
    expect(screen.getByTestId('homepage-cta-dual-track')).toHaveTextContent(
      '探索導師池'
    );
    expect(screen.getByTestId('homepage-cta-dual-track')).toHaveAttribute(
      'href',
      '/mentor-pool'
    );

    mockUseResolvedIdentity.mockReturnValue({
      state: 'hint-only',
      userId: undefined,
      isMentor: false,
      avatar: undefined,
    });
    rerender(<DualTrackSection />);
    expect(screen.getByTestId('homepage-cta-dual-track')).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });
});
