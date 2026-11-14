import { vi } from 'vitest';

export const mockToast = vi.fn();

export const useToastMockFactory = () => ({
  toast: mockToast,
  useToast: () => ({
    toast: mockToast,
    dismiss: vi.fn(),
    toasts: [],
  }),
});
