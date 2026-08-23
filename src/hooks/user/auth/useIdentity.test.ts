import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseResolvedIdentity = vi.fn();
vi.mock('./useResolvedIdentity', () => ({
  useResolvedIdentity: () => mockUseResolvedIdentity(),
}));

import { authenticatedIdentity } from '@/test/mocks/identity';

import { useIdentity } from './useIdentity';

describe('useIdentity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes through the already-resolved identity from useResolvedIdentity unchanged', () => {
    const resolved = authenticatedIdentity('user-123', {
      isMentor: true,
      avatar: 'https://example.com/session.png',
    });
    mockUseResolvedIdentity.mockReturnValue(resolved);

    const { result } = renderHook(() => useIdentity());

    expect(result.current).toEqual(resolved);
  });
});
