import { renderHook } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useResolvedIdentity } from '@/hooks/user/auth/useResolvedIdentity';
import { useAvatarOverride } from '@/lib/avatar/avatarOverrideStore';
import {
  authenticatedIdentity,
  buildResolvedIdentity,
} from '@/test/mocks/identity';

import { useCurrentAvatar } from './useCurrentAvatar';

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}));

vi.mock('@/hooks/user/auth/useResolvedIdentity', () => ({
  useResolvedIdentity: vi.fn(),
}));

vi.mock('@/lib/avatar/avatarOverrideStore', () => ({
  clearAvatarOverride: vi.fn(),
  useAvatarOverride: vi.fn(),
}));

const mockUseSession = vi.mocked(useSession);
const mockUseResolvedIdentity = vi.mocked(useResolvedIdentity);
const mockUseAvatarOverride = vi.mocked(useAvatarOverride);

describe('useCurrentAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns override url when override matches session userId', () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: 'user-123', avatar: 'session-avatar.png' } },
      status: 'authenticated',
    } as unknown as ReturnType<typeof useSession>);
    mockUseResolvedIdentity.mockReturnValue(
      authenticatedIdentity('user-123', { avatar: 'session-avatar.png' })
    );
    mockUseAvatarOverride.mockReturnValue({
      userId: 'user-123',
      url: 'override-avatar.png',
    });

    const { result } = renderHook(() => useCurrentAvatar());

    expect(result.current).toBe('override-avatar.png');
  });

  it('returns session avatar when session is loaded and override does not match', () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: 'user-123', avatar: 'session-avatar.png' } },
      status: 'authenticated',
    } as unknown as ReturnType<typeof useSession>);
    mockUseResolvedIdentity.mockReturnValue(
      authenticatedIdentity('user-123', { avatar: 'session-avatar.png' })
    );
    mockUseAvatarOverride.mockReturnValue({
      userId: 'different-user',
      url: 'override-avatar.png',
    });

    const { result } = renderHook(() => useCurrentAvatar());

    expect(result.current).toBe('session-avatar.png');
  });

  it('returns hint avatar when session is loading and hint has avatar', () => {
    mockUseSession.mockReturnValue({
      data: undefined,
      status: 'loading',
    } as unknown as ReturnType<typeof useSession>);
    mockUseResolvedIdentity.mockReturnValue(
      buildResolvedIdentity({
        state: 'hint-only',
        isMentor: true,
        avatar: 'hint-avatar.png',
      })
    );
    mockUseAvatarOverride.mockReturnValue(null);

    const { result } = renderHook(() => useCurrentAvatar());

    expect(result.current).toBe('hint-avatar.png');
  });

  it('returns null when session has resolved with null avatar even if hint has one', () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: 'user-123', avatar: null } },
      status: 'authenticated',
    } as unknown as ReturnType<typeof useSession>);
    mockUseResolvedIdentity.mockReturnValue(authenticatedIdentity('user-123'));
    mockUseAvatarOverride.mockReturnValue(null);

    const { result } = renderHook(() => useCurrentAvatar());

    expect(result.current).toBeNull();
  });

  it('returns null when session is unauthenticated, ignoring stale hint', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
    } as unknown as ReturnType<typeof useSession>);
    mockUseResolvedIdentity.mockReturnValue(buildResolvedIdentity());
    mockUseAvatarOverride.mockReturnValue(null);

    const { result } = renderHook(() => useCurrentAvatar());

    expect(result.current).toBeNull();
  });

  it('returns null when no avatar source exists', () => {
    mockUseSession.mockReturnValue({
      data: undefined,
      status: 'loading',
    } as unknown as ReturnType<typeof useSession>);
    mockUseResolvedIdentity.mockReturnValue(buildResolvedIdentity());
    mockUseAvatarOverride.mockReturnValue(null);

    const { result } = renderHook(() => useCurrentAvatar());

    expect(result.current).toBeNull();
  });
});
