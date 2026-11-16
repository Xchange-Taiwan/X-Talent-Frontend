import { render, screen } from '@testing-library/react';
import { redirect } from 'next/navigation';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FIND_MENTOR_HREF } from '@/lib/routes';

import FavoritesPage from './page';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('./container', () => ({
  default: () => <div data-testid="favorites-page-container">Favorites</div>,
}));

describe('FavoritesPage server guard (#913)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('redirects to FIND_MENTOR_HREF without mounting FavoritesPageContainer when favorites flag is disabled', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_FAVORITES', 'false');

    expect(() => FavoritesPage()).toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith(FIND_MENTOR_HREF);
  });

  it('renders FavoritesPageContainer when favorites flag is enabled', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_FAVORITES', 'true');

    render(<FavoritesPage />);
    expect(screen.getByTestId('favorites-page-container')).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });
});
