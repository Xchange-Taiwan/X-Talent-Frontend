import { describe, expect, it, vi } from 'vitest';

const mockRedirect = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

import ReservationIndexPage from './page';

describe('ReservationIndexPage (/reservation)', () => {
  it('redirects /reservation to /reservation/mentee (#860)', () => {
    ReservationIndexPage();
    expect(mockRedirect).toHaveBeenCalledWith('/reservation/mentee');
  });
});
