import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('next/dynamic', () => ({
  default: () => (props: Record<string, unknown>) => (
    <div data-testid="profile-card-ui" data-name={String(props.userData)} />
  ),
}));

const mockUseUserData = vi.fn();
vi.mock('@/hooks/user/user-data/useUserData', () => ({
  default: (...args: [number, string, unknown, unknown]) =>
    mockUseUserData(...args),
}));

import type { TagCatalogsByBucket } from '@/types/tagCatalog';
import type { MentorProfileVO } from '@/types/user';

import ProfileCardContainer from './container';

const emptyCatalogs = {} as TagCatalogsByBucket;

describe('ProfileCardContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      emptyCatalogs
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
      undefined
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
      emptyCatalogs
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
});
