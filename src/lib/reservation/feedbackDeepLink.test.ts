import { describe, expect, it, vi } from 'vitest';

import {
  emitFeedbackDeepLink,
  subscribeFeedbackDeepLink,
} from './feedbackDeepLink';

describe('feedbackDeepLink', () => {
  it('notifies subscribers with trimmed reservationId and stops after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeFeedbackDeepLink(listener);

    emitFeedbackDeepLink('  401  ');
    emitFeedbackDeepLink(502);
    emitFeedbackDeepLink('   ');
    emitFeedbackDeepLink(null);
    emitFeedbackDeepLink(undefined);

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, '401');
    expect(listener).toHaveBeenNthCalledWith(2, '502');

    unsubscribe();
    emitFeedbackDeepLink('401');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
