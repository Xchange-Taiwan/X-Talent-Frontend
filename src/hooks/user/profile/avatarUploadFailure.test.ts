import { describe, expect, it, vi } from 'vitest';

import { LoggedError } from '@/lib/profile/saveProfile';

import {
  AVATAR_UPLOAD_FAILED_MESSAGE,
  isAvatarUploadFailure,
  reportAvatarUploadFailure,
} from './avatarUploadFailure';

describe('avatarUploadFailure (#981)', () => {
  it('recognises only LoggedError with step "avatar_upload"', () => {
    expect(
      isAvatarUploadFailure(new LoggedError('x', { step: 'avatar_upload' }))
    ).toBe(true);
    expect(
      isAvatarUploadFailure(new LoggedError('x', { step: 'profile_write' }))
    ).toBe(false);
    expect(isAvatarUploadFailure(new LoggedError('x'))).toBe(false);
    expect(isAvatarUploadFailure(new Error('avatar_upload'))).toBe(false);
    expect(isAvatarUploadFailure(undefined)).toBe(false);
  });

  it('sets the avatarFile field error and scrolls to #avatarFile', () => {
    const setError = vi.fn();
    const scrollToField = vi.fn();

    reportAvatarUploadFailure({ setError }, scrollToField);

    expect(setError).toHaveBeenCalledWith('avatarFile', {
      type: 'custom',
      message: AVATAR_UPLOAD_FAILED_MESSAGE,
    });
    expect(scrollToField).toHaveBeenCalledWith('avatarFile');
  });
});
