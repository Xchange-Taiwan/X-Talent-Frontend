import { vi } from 'vitest';

export const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

export const mockSearchParams = {
  get: vi.fn().mockReturnValue(null),
  getAll: vi.fn().mockReturnValue([]),
  has: vi.fn().mockReturnValue(false),
  toString: vi.fn().mockReturnValue(''),
};

export const navigationMockFactory = () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
  usePathname: vi.fn().mockReturnValue('/'),
});
