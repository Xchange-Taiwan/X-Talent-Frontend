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

const mockPrimeUserProfileDtoCacheIfEmpty = vi.fn();
vi.mock('@/hooks/user/user-data/useUserProfileDto', () => ({
  primeUserProfileDtoCacheIfEmpty: (...args: [number, string, unknown]) =>
    mockPrimeUserProfileDtoCacheIfEmpty(...args),
}));

const mockPrimeTagCatalogCacheIfEmpty = vi.fn();
vi.mock('@/hooks/user/tags/useTagCatalog', () => ({
  primeTagCatalogCacheIfEmpty: (...args: [string, unknown]) =>
    mockPrimeTagCatalogCacheIfEmpty(...args),
}));

const mockUseUserData = vi.fn();
vi.mock('@/hooks/user/user-data/useUserData', () => ({
  default: (...args: [number, string]) => mockUseUserData(...args),
}));

import type { TagCatalogsByBucket } from '@/types/tagCatalog';
import type { MentorProfileVO } from '@/types/user';

import ProfileCardContainer from './container';

const emptyCatalogs = {} as TagCatalogsByBucket;

describe('ProfileCardContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('primes the profile-dto and tag-catalog caches with the SSR-fetched data on first render', () => {
    mockUseUserData.mockReturnValue({ userData: null, isLoading: true });
    const initialDto = { user_id: 42 } as MentorProfileVO;

    render(
      <ProfileCardContainer
        loginUserId={42}
        initialDto={initialDto}
        initialCatalogs={emptyCatalogs}
      />
    );

    expect(mockPrimeUserProfileDtoCacheIfEmpty).toHaveBeenCalledWith(
      42,
      'zh_TW',
      initialDto
    );
    expect(mockPrimeTagCatalogCacheIfEmpty).toHaveBeenCalledWith(
      'zh_TW',
      emptyCatalogs
    );
  });

  it('does not prime the profile-dto cache when the SSR fetch failed (initialDto is null)', () => {
    mockUseUserData.mockReturnValue({ userData: null, isLoading: true });

    render(
      <ProfileCardContainer
        loginUserId={42}
        initialDto={null}
        initialCatalogs={emptyCatalogs}
      />
    );

    expect(mockPrimeUserProfileDtoCacheIfEmpty).not.toHaveBeenCalled();
    expect(mockPrimeTagCatalogCacheIfEmpty).toHaveBeenCalledWith(
      'zh_TW',
      emptyCatalogs
    );
  });

  it('does not prime the tag-catalog cache when the SSR fetch failed (initialCatalogs is null), leaving the client-side fallback fetch to recover', () => {
    mockUseUserData.mockReturnValue({ userData: null, isLoading: true });
    const initialDto = { user_id: 42 } as MentorProfileVO;

    render(
      <ProfileCardContainer
        loginUserId={42}
        initialDto={initialDto}
        initialCatalogs={null}
      />
    );

    expect(mockPrimeUserProfileDtoCacheIfEmpty).toHaveBeenCalledWith(
      42,
      'zh_TW',
      initialDto
    );
    expect(mockPrimeTagCatalogCacheIfEmpty).not.toHaveBeenCalled();
  });

  it('renders the card UI immediately (no loading state) when the SSR-primed data resolves the hook synchronously', () => {
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
