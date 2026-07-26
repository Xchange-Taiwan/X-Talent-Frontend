import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useEditProfileForm } from './useEditProfileForm';

describe('useEditProfileForm', () => {
  it('initializes form with default values and uses the correct resolver schema based on isMentor parameter', async () => {
    const { result } = renderHook(() => {
      const hookRes = useEditProfileForm(false);
      void hookRes.form.formState.errors; // subscribe to errors proxy
      return hookRes;
    });

    expect(result.current.form).toBeDefined();

    await act(async () => {
      // about is optional for mentees, so validating empty about should succeed
      const isAboutValid = await result.current.form.trigger('about');
      expect(isAboutValid).toBe(true);
    });
  });

  it('validates correctly under mentor mode (about is required)', async () => {
    const { result } = renderHook(() => {
      const hookRes = useEditProfileForm(true);
      void hookRes.form.formState.errors; // subscribe to errors proxy
      return hookRes;
    });

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
