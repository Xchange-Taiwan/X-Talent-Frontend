import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { AvatarMutationSession } from '@/lib/profile/saveProfile';

import { usePresetAwareAvatarSession } from './usePresetAwareAvatarSession';

describe('usePresetAwareAvatarSession', () => {
  it('delegates resolve(file) when presetSelectedRef.current is false and short-circuits to undefined when true', async () => {
    const resolve = vi
      .fn<AvatarMutationSession['resolve']>()
      .mockResolvedValue('https://cdn.example.com/u/1/avatar?v=1');
    const markCommitted = vi.fn();
    const abort = vi.fn();
    const rollback = vi.fn().mockResolvedValue(undefined);

    const presetSelectedRef = { current: false };
    const { result } = renderHook(() =>
      usePresetAwareAvatarSession(
        { resolve, markCommitted, abort, rollback },
        presetSelectedRef
      )
    );

    const file = new File(['bytes'], 'avatar.png', { type: 'image/png' });
    await expect(result.current.resolve(file)).resolves.toBe(
      'https://cdn.example.com/u/1/avatar?v=1'
    );
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledWith(file);

    presetSelectedRef.current = true;
    await expect(result.current.resolve(file)).resolves.toBeUndefined();
    expect(resolve).toHaveBeenCalledTimes(1);

    result.current.markCommitted();
    expect(markCommitted).toHaveBeenCalledTimes(1);

    result.current.abort?.();
    expect(abort).toHaveBeenCalledTimes(1);

    await result.current.rollback?.();
    expect(rollback).toHaveBeenCalledTimes(1);
  });
});
