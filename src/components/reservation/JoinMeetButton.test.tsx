import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { getAnalyticsClickPayloadFromElement } from '@/lib/analytics';

import { JoinMeetButton } from './JoinMeetButton';

describe('JoinMeetButton', () => {
  it('outputs default reservation_card analytics attributes and omits source_role when sourceRole is undefined', () => {
    render(<JoinMeetButton onClick={vi.fn()} isPending={false} />);

    const btn = screen.getByRole('button', { name: '加入 Google Meet' });
    expect(btn).toHaveAttribute(
      'data-analytics-click',
      'reservation_join_meet'
    );
    expect(btn).toHaveAttribute(
      'data-analytics-event',
      'reservation_join_meet_click'
    );
    expect(btn).toHaveAttribute('data-analytics-feature', 'reservation');
    expect(btn).toHaveAttribute('data-analytics-location', 'reservation_card');
    expect(btn).not.toHaveAttribute('data-analytics-param-source-role');

    expect(getAnalyticsClickPayloadFromElement(btn)).toEqual({
      buttonId: 'reservation_join_meet',
      eventName: 'reservation_join_meet_click',
      feature: 'reservation',
      location: 'reservation_card',
    });
  });

  it('outputs source_role and custom analyticsLocation when provided', () => {
    render(
      <JoinMeetButton
        onClick={vi.fn()}
        isPending={false}
        sourceRole="mentor"
        analyticsLocation="confirmed_reservation_dialog"
      />
    );

    const btn = screen.getByRole('button', { name: '加入 Google Meet' });
    expect(btn).toHaveAttribute(
      'data-analytics-location',
      'confirmed_reservation_dialog'
    );
    expect(btn).toHaveAttribute('data-analytics-param-source-role', 'mentor');

    expect(getAnalyticsClickPayloadFromElement(btn)).toEqual({
      buttonId: 'reservation_join_meet',
      eventName: 'reservation_join_meet_click',
      feature: 'reservation',
      location: 'confirmed_reservation_dialog',
      metadata: {
        source_role: 'mentor',
      },
    });
  });

  it('disables button and suppresses declarative analytics payload while pending or disabled', () => {
    const { rerender } = render(
      <JoinMeetButton onClick={vi.fn()} isPending={true} sourceRole="mentee" />
    );

    const pendingBtn = screen.getByRole('button', { name: '加入 Google Meet' });
    expect(pendingBtn).toBeDisabled();
    expect(pendingBtn).toHaveTextContent('載入中...');
    expect(getAnalyticsClickPayloadFromElement(pendingBtn)).toBeNull();

    rerender(
      <JoinMeetButton
        onClick={vi.fn()}
        isPending={false}
        disabled={true}
        sourceRole="mentee"
      />
    );
    const disabledBtn = screen.getByRole('button', {
      name: '加入 Google Meet',
    });
    expect(disabledBtn).toBeDisabled();
    expect(getAnalyticsClickPayloadFromElement(disabledBtn)).toBeNull();
  });
});
