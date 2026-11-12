import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MEETING_FEEDBACK_FORM_VALUES,
  useMeetingFeedbackForm,
} from './useMeetingFeedbackForm';

describe('useMeetingFeedbackForm', () => {
  it('initializes with null attendance, default rating 10, empty content, and null reason', () => {
    const { result } = renderHook(() => useMeetingFeedbackForm());

    expect(result.current.getValues()).toEqual(
      DEFAULT_MEETING_FEEDBACK_FORM_VALUES
    );
    expect(result.current.getValues('rating')).toBe(10);
  });

  it('updates values cleanly via setValue', async () => {
    const { result } = renderHook(() => useMeetingFeedbackForm());

    await act(async () => {
      result.current.setValue('meetingHappened', true, {
        shouldValidate: true,
      });
      result.current.setValue('rating', 8, { shouldValidate: true });
      result.current.setValue('content', '收穫滿滿', { shouldValidate: true });
    });

    expect(result.current.getValues()).toEqual({
      meetingHappened: true,
      rating: 8,
      content: '收穫滿滿',
      notHappenedReason: null,
    });
  });
});
