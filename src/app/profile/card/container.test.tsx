import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

let capturedCardProps: Record<string, unknown> = {};
vi.mock('next/dynamic', () => ({
  default: () => (props: Record<string, unknown>) => {
    capturedCardProps = props;
    return (
      <div data-testid="profile-card-ui" data-name={String(props.userData)} />
    );
  },
}));

const mockUseUserData = vi.fn();
vi.mock('@/hooks/user/user-data/useUserData', () => ({
  default: (...args: [number, string, unknown, unknown]) =>
    mockUseUserData(...args),
}));

const mockUseResolvedIdentity = vi.fn();
vi.mock('@/hooks/user/auth/useResolvedIdentity', () => ({
  useResolvedIdentity: () => mockUseResolvedIdentity(),
}));

import type { TagCatalogsByBucket } from '@/types/tagCatalog';
import type { MentorProfileVO } from '@/types/user';

import ProfileCardContainer from './container';

const emptyCatalogs = {} as TagCatalogsByBucket;

describe('ProfileCardContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseResolvedIdentity.mockReturnValue({ state: 'confirmed-guest' });
  });

  it('protects the /profile/card completion page with the ProfileReadModel expectedIsMentor guard only for the owner whose session is already a Mentor (#981)', () => {
    mockUseUserData.mockReturnValue({ userData: null, isLoading: true });
    const staleMenteeDto = { user_id: 42, is_mentor: false } as MentorProfileVO;

    mockUseResolvedIdentity.mockReturnValue({
      state: 'confirmed-member',
      userId: '42',
      isMentor: true,
    });
    const { unmount } = render(
      <ProfileCardContainer
        loginUserId={42}
        initialDto={staleMenteeDto}
        initialCatalogs={emptyCatalogs}
      />
    );
    expect(mockUseUserData).toHaveBeenLastCalledWith(
      42,
      'zh_TW',
      staleMenteeDto,
      emptyCatalogs,
      { expectedIsMentor: true }
    );
    unmount();

    // Still a Mentee in session -> no guard.
    mockUseResolvedIdentity.mockReturnValue({
      state: 'confirmed-member',
      userId: '42',
      isMentor: false,
    });
    const { unmount: unmount2 } = render(
      <ProfileCardContainer
        loginUserId={42}
        initialDto={staleMenteeDto}
        initialCatalogs={emptyCatalogs}
      />
    );
    expect(mockUseUserData).toHaveBeenLastCalledWith(
      42,
      'zh_TW',
      staleMenteeDto,
      emptyCatalogs,
      { expectedIsMentor: false }
    );
    unmount2();

    // Mentor identity for a different account never applies.
    mockUseResolvedIdentity.mockReturnValue({
      state: 'confirmed-member',
      userId: '99',
      isMentor: true,
    });
    render(
      <ProfileCardContainer
        loginUserId={42}
        initialDto={staleMenteeDto}
        initialCatalogs={emptyCatalogs}
      />
    );
    expect(mockUseUserData).toHaveBeenLastCalledWith(
      42,
      'zh_TW',
      staleMenteeDto,
      emptyCatalogs,
      { expectedIsMentor: false }
    );
  });

  it('forwards loginUserId/initialDto/initialCatalogs straight through to useUserData', () => {
    mockUseUserData.mockReturnValue({ userData: null, isLoading: true });
    const initialDto = { user_id: 42 } as MentorProfileVO;

    render(
      <ProfileCardContainer
        loginUserId={42}
        initialDto={initialDto}
        initialCatalogs={emptyCatalogs}
      />
    );

    expect(mockUseUserData).toHaveBeenCalledWith(
      42,
      'zh_TW',
      initialDto,
      emptyCatalogs,
      { expectedIsMentor: false }
    );
  });

  it('passes initialCatalogs through as undefined (not null) when the SSR catalog fetch failed', () => {
    mockUseUserData.mockReturnValue({ userData: null, isLoading: true });
    const initialDto = { user_id: 42 } as MentorProfileVO;

    render(
      <ProfileCardContainer
        loginUserId={42}
        initialDto={initialDto}
        initialCatalogs={null}
      />
    );

    expect(mockUseUserData).toHaveBeenCalledWith(
      42,
      'zh_TW',
      initialDto,
      undefined,
      { expectedIsMentor: false }
    );
  });

  it('passes a null initialDto straight through when the SSR fetch failed', () => {
    mockUseUserData.mockReturnValue({ userData: null, isLoading: true });

    render(
      <ProfileCardContainer
        loginUserId={42}
        initialDto={null}
        initialCatalogs={emptyCatalogs}
      />
    );

    expect(mockUseUserData).toHaveBeenCalledWith(
      42,
      'zh_TW',
      null,
      emptyCatalogs,
      { expectedIsMentor: false }
    );
  });

  it('renders the card UI immediately (no loading state) when useUserData resolves synchronously from SSR-seeded data', () => {
    mockUseUserData.mockReturnValue({
      userData: {
        is_mentor: false,
        personalLinks: [],
      },
      isLoading: false,
    });

    render(
      <ProfileCardContainer
        loginUserId={42}
        initialDto={{ user_id: 42 } as MentorProfileVO}
        initialCatalogs={emptyCatalogs}
      />
    );

    expect(screen.getByTestId('profile-card-ui')).toBeInTheDocument();
  });

  it('shows the loading spinner while useUserData has not resolved yet', () => {
    mockUseUserData.mockReturnValue({ userData: null, isLoading: true });

    render(
      <ProfileCardContainer
        loginUserId={42}
        initialDto={null}
        initialCatalogs={emptyCatalogs}
      />
    );

    expect(screen.queryByTestId('profile-card-ui')).not.toBeInTheDocument();
  });

  it('renders nothing once loading settles with no user data', () => {
    mockUseUserData.mockReturnValue({ userData: null, isLoading: false });

    const { container } = render(
      <ProfileCardContainer
        loginUserId={42}
        initialDto={null}
        initialCatalogs={emptyCatalogs}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('wires onSetupSchedule to /profile/:id?open-schedule=true, onBackToProfile to /profile/:id, and onEditProfile to /profile/:id/edit without passing redundant isMentor or personalLinks props (#961 / #945)', () => {
    capturedCardProps = {};
    mockUseUserData.mockReturnValue({
      userData: {
        is_mentor: true,
        personalLinks: [{ platform: 'github', url: 'https://github.com/ada' }],
      },
      isLoading: false,
    });

    render(
      <ProfileCardContainer
        loginUserId={42}
        initialDto={{ user_id: 42 } as MentorProfileVO}
        initialCatalogs={emptyCatalogs}
      />
    );

    expect(capturedCardProps).not.toHaveProperty('isMentor');
    expect(capturedCardProps).not.toHaveProperty('personalLinks');

    const onSetupSchedule = capturedCardProps['onSetupSchedule'] as () => void;
    const onBackToProfile = capturedCardProps['onBackToProfile'] as () => void;
    const onEditProfile = capturedCardProps['onEditProfile'] as () => void;
    onSetupSchedule();
    expect(mockPush).toHaveBeenCalledWith('/profile/42?open-schedule=true');
    onBackToProfile();
    expect(mockPush).toHaveBeenCalledWith('/profile/42');
    onEditProfile();
    expect(mockPush).toHaveBeenCalledWith('/profile/42/edit');
  });
});
