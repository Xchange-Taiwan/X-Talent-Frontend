import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useEditProfileForm } from './useEditProfileForm';

describe('useEditProfileForm', () => {
  it('initializes form with default values and isMentorRef as false', () => {
    const { result } = renderHook(() => {
      const hookRes = useEditProfileForm();
      void hookRes.form.formState.errors; // subscribe to errors proxy
      return hookRes;
    });

    expect(result.current.form).toBeDefined();
    expect(result.current.form.getValues('is_mentor')).toBe(false);
  });

  it('validates correctly under mentee mode (about and have_topic are optional)', async () => {
    const { result } = renderHook(() => {
      const hookRes = useEditProfileForm();
      void hookRes.form.formState.errors; // subscribe to errors proxy
      return hookRes;
    });

    // By default, mode is non-mentor (mentee)
    result.current.syncMentorStatus(false);

    await act(async () => {
      // name is required, so validating empty name should fail
      const isNameValid = await result.current.form.trigger('name');
      expect(isNameValid).toBe(false);

      // about is optional for mentees, so validating empty about should succeed
      const isAboutValid = await result.current.form.trigger('about');
      expect(isAboutValid).toBe(true);
    });
  });

  it('validates correctly under mentor mode (about is required)', async () => {
    const { result } = renderHook(() => {
      const hookRes = useEditProfileForm();
      void hookRes.form.formState.errors; // subscribe to errors proxy
      return hookRes;
    });

    // Sync mentor mode
    result.current.syncMentorStatus(true);

    await act(async () => {
      // about is required for mentors, so validating empty about should fail
      const isAboutValid = await result.current.form.trigger('about');
      expect(isAboutValid).toBe(false);
    });

    await waitFor(() => {
      expect(result.current.form.formState.errors.about?.message).toBe(
        '請填寫關於我'
      );
    });
  });
});
