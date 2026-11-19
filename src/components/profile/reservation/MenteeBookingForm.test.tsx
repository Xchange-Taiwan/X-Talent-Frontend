import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { trackEvent } from '@/lib/analytics';

import { MenteeBookingForm } from './MenteeBookingForm';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

const baseProps = {
  mentorId: 7488864558908473,
  myUserId: '7482008160728087',
  slots: [],
  monthLoaded: true,
  selectedSlot: null,
  setSelectedSlot: vi.fn(),
  selectedDate: '2026-11-20',
};

describe('MenteeBookingForm analytics & Clarity masking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fires deduplicated auth_gate_triggered impression for guests and click_cta on sign-in click', () => {
    const { rerender } = render(
      <MenteeBookingForm {...baseProps} isAuthenticated={false} />
    );

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith({
      name: 'auth_gate_triggered',
      feature: 'reservation',
      metadata: {
        gate_feature: 'reservation',
        trigger_type: 'impression',
        mentor_id: 7488864558908473,
      },
    });

    // Rerender with same mentorId does not re-fire impression
    rerender(<MenteeBookingForm {...baseProps} isAuthenticated={false} />);
    expect(trackEvent).toHaveBeenCalledTimes(1);

    // Clicking "前往登入" fires both legacy reservation_signin_prompt_click and auth_gate_triggered click_cta
    fireEvent.click(screen.getByRole('link', { name: '前往登入' }));
    expect(trackEvent).toHaveBeenCalledWith({
      name: 'auth_gate_triggered',
      feature: 'reservation',
      metadata: {
        gate_feature: 'reservation',
        trigger_type: 'click_cta',
        mentor_id: 7488864558908473,
      },
    });
  });

  it('does not fire auth_gate_triggered when authenticated and masks the booking question textarea', () => {
    const slot = {
      occurrenceId: 'slot-1',
      scheduleId: 10,
      start: new Date('2026-11-20T10:00:00Z'),
      end: new Date('2026-11-20T10:30:00Z'),
      isBooked: false,
      status: null,
    };

    render(
      <MenteeBookingForm
        {...baseProps}
        slots={[slot]}
        selectedSlot={slot}
        isAuthenticated={true}
      />
    );

    expect(trackEvent).not.toHaveBeenCalled();
    const textarea = screen.getByRole('textbox');
    expect(textarea.closest('[data-clarity-mask="true"]')).not.toBeNull();
  });

  it('waits until isIdentityResolved is true before firing guest auth_gate_triggered impression', () => {
    const { rerender } = render(
      <MenteeBookingForm
        {...baseProps}
        isAuthenticated={false}
        isIdentityResolved={false}
      />
    );
    expect(trackEvent).not.toHaveBeenCalled();

    rerender(
      <MenteeBookingForm
        {...baseProps}
        isAuthenticated={false}
        isIdentityResolved={true}
      />
    );
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });
});
