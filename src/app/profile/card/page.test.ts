import { describe, expect, it, vi } from 'vitest';

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/auth.config', () => ({
  default: {},
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('REDIRECT');
  }),
}));

vi.mock('@/services/profile/user.server', () => ({
  fetchUserByIdServer: vi.fn(),
}));
vi.mock('@/services/profile/tagCatalog.server', () => ({
  fetchTagCatalogServer: vi.fn(),
}));

vi.mock('./container', () => ({
  default: vi.fn(() => null),
}));

import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';

import { fetchTagCatalogServer } from '@/services/profile/tagCatalog.server';
import { fetchUserByIdServer } from '@/services/profile/user.server';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';
import type { MentorProfileVO } from '@/types/user';

import Page from './page';

const mockGetServerSession = vi.mocked(getServerSession);
const mockRedirect = vi.mocked(redirect);
const mockFetchUserByIdServer = vi.mocked(fetchUserByIdServer);
const mockFetchTagCatalogServer = vi.mocked(fetchTagCatalogServer);
const emptyCatalogs = {} as TagCatalogsByBucket;

describe('profile/card Page', () => {
  it('redirects to sign-in when there is no session', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);

    await expect(Page()).rejects.toThrow('REDIRECT');

    expect(mockRedirect).toHaveBeenCalledWith('/auth/signin');
    expect(mockFetchUserByIdServer).not.toHaveBeenCalled();
  });

  it('redirects to sign-in when the session user id is not a valid numeric string', async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: '../about' },
    } as never);

    await expect(Page()).rejects.toThrow('REDIRECT');

    expect(mockRedirect).toHaveBeenCalledWith('/auth/signin');
  });

  it('SSR-fetches the caller own profile dto and tag catalog, then renders the container with them', async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: '42' },
    } as never);
    mockFetchUserByIdServer.mockResolvedValueOnce({
      user_id: 42,
    } as MentorProfileVO);
    mockFetchTagCatalogServer.mockResolvedValueOnce(emptyCatalogs);

    const result = await Page();

    expect(mockFetchUserByIdServer).toHaveBeenCalledWith(42, 'zh_TW');
    expect(mockFetchTagCatalogServer).toHaveBeenCalledWith('zh_TW');
    expect(result.props).toEqual({
      loginUserId: 42,
      initialDto: { user_id: 42 },
      initialCatalogs: emptyCatalogs,
    });
  });

  it('renders the container with a null initialDto when the SSR fetch resolves to null, leaving the client-side fallback fetch to recover', async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: '42' },
    } as never);
    mockFetchUserByIdServer.mockResolvedValueOnce(null);
    mockFetchTagCatalogServer.mockResolvedValueOnce(emptyCatalogs);

    const result = await Page();

    expect(result.props).toEqual({
      loginUserId: 42,
      initialDto: null,
      initialCatalogs: emptyCatalogs,
    });
  });

  it('renders the container with a null initialDto when fetchUserByIdServer unexpectedly throws, instead of failing the whole SSR render', async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: '42' },
    } as never);
    mockFetchUserByIdServer.mockRejectedValueOnce(new Error('network error'));
    mockFetchTagCatalogServer.mockResolvedValueOnce(emptyCatalogs);

    const result = await Page();

    expect(result.props).toEqual({
      loginUserId: 42,
      initialDto: null,
      initialCatalogs: emptyCatalogs,
    });
  });

  it('renders the container with a null initialCatalogs when fetchTagCatalogServer unexpectedly throws, instead of failing the whole SSR render', async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: '42' },
    } as never);
    mockFetchUserByIdServer.mockResolvedValueOnce({
      user_id: 42,
    } as MentorProfileVO);
    mockFetchTagCatalogServer.mockRejectedValueOnce(new Error('network error'));

    const result = await Page();

    expect(result.props).toEqual({
      loginUserId: 42,
      initialDto: { user_id: 42 },
      initialCatalogs: null,
    });
  });
});
