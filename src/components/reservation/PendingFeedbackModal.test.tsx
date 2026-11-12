import { fireEvent, render, screen } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import type { Reservation } from '@/types/reservation';

import { PendingFeedbackModal } from './PendingFeedbackModal';

describe('PendingFeedbackModal (#740)', () => {
  it('renders nothing when queueItems is null or empty', () => {
    const { container, rerender } = render(
      <PendingFeedbackModal queueItems={null} onSubmitFeedback={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();

    rerender(
      <PendingFeedbackModal queueItems={[]} onSubmitFeedback={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('opens MeetingFeedbackDialog without stray trigger button and wires skip/close callbacks', () => {
    const onSkip = vi.fn();
    const onClose = vi.fn();
    const item = fromPartial<Reservation>({
      id: 'pending-single-1',
      name: 'Emily Chen',
      date: '2026/10/12',
      time: '19:00–19:30',
      viewerRole: 'MENTOR',
    });

    render(
      <PendingFeedbackModal
        queueItems={[item]}
        onSubmitFeedback={vi.fn()}
        onSkipReservation={onSkip}
        onClose={onClose}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '確定送出' })).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: '確認會談' })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '關閉回饋視窗' }));
    expect(onSkip).toHaveBeenCalledWith(item);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
