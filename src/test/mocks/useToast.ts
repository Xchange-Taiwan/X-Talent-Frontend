import { vi } from 'vitest';

export const mockToast = vi.fn();

export const useToastMockFactory = () => ({
  useToast: () => ({
    toast: mockToast,
    dismiss: vi.fn(),
    toasts: [],
  }),
});
