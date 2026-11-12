import { act, fireEvent, render, screen } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockUsePendingFeedbackQueue = vi.fn();

vi.mock('next/dynamic', () => ({
  default: () => {
    const DynamicModalShim = (
      props: React.ComponentProps<typeof PendingFeedbackModal>
    ) => <PendingFeedbackModal {...props} />;
    return DynamicModalShim;
  },
}));

vi.mock('@/hooks/user/reservation/usePendingFeedbackQueue', () => ({
  usePendingFeedbackQueue: () => mockUsePendingFeedbackQueue(),
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import {
  QUEUE_PROMOTE_MS,
  QUEUE_SWIPE_OUT_MS,
} from '@/hooks/user/reservation/useFeedbackQueueMotion';
import type { Reservation } from '@/types/reservation';

import {
  PendingFeedbackModal,
  PendingFeedbackQueueLauncher,
} from './PendingFeedbackModal';

afterEach(() => {
  vi.useRealTimers();
});

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

  it('opens MeetingFeedbackDialog without stray trigger button and wires skip/close callbacks for a single item', () => {
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

  it('skips only the current session on top-right X in a multi-item queue without calling onClose until the final session is skipped', () => {
    vi.useFakeTimers();
    const onSkip = vi.fn();
    const onClose = vi.fn();
    const item1 = fromPartial<Reservation>({
      id: 'pending-multi-1',
      name: 'Emily Chen',
      date: '2026/10/12',
      time: '19:00–19:30',
      viewerRole: 'MENTOR',
    });
    const item2 = fromPartial<Reservation>({
      id: 'pending-multi-2',
      name: 'Alex Wang',
      date: '2026/10/18',
      time: '20:00–20:30',
      viewerRole: 'MENTEE',
    });

    render(
      <PendingFeedbackModal
        queueItems={[item1, item2]}
        onSubmitFeedback={vi.fn()}
        onSkipReservation={onSkip}
        onClose={onClose}
      />
    );

    expect(screen.getByTestId('feedback-queue-counter')).toHaveTextContent(
      '第 1／2 場'
    );
    expect(screen.getByRole('button', { name: '確定送出' })).toBeDisabled();

    // First X click: skips item1 and advances to item2 WITHOUT prematurely dismissing the session queue
    fireEvent.click(
      screen.getByRole('button', { name: '略過 Emily Chen 這場回饋' })
    );
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onSkip).toHaveBeenCalledWith(item1);
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(QUEUE_SWIPE_OUT_MS + QUEUE_PROMOTE_MS);
    });

    expect(screen.getByTestId('feedback-queue-counter')).toHaveTextContent(
      '第 2／2 場'
    );
    expect(screen.getByTestId('feedback-mentor-header')).toHaveTextContent(
      'Alex Wang'
    );
    // Role also switched from MENTOR ('確定送出') to MENTEE ('下一步')!
    expect(screen.getByRole('button', { name: '下一步' })).toBeDisabled();

    // Final X click on item2: skips item2 AND closes/dismisses the queue
    fireEvent.click(
      screen.getByRole('button', { name: '略過 Alex Wang 這場回饋' })
    );
    expect(onSkip).toHaveBeenCalledTimes(2);
    expect(onSkip).toHaveBeenLastCalledWith(item2);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('mounts PendingFeedbackQueueLauncher without rendering modal when queue is empty and opens modal when items exist', () => {
    mockUsePendingFeedbackQueue.mockReturnValueOnce({
      queueItems: null,
      submitFeedbackItem: vi.fn(),
      skipFeedbackItem: vi.fn(),
      dismissQueue: vi.fn(),
    });

    const { container, rerender } = render(<PendingFeedbackQueueLauncher />);
    expect(container).toBeEmptyDOMElement();

    mockUsePendingFeedbackQueue.mockReturnValue({
      queueItems: [
        fromPartial<Reservation>({
          id: 'launcher-1',
          name: 'Zahra Mirzakhani',
          date: '2026/10/25',
          time: '21:00–21:30',
          viewerRole: 'MENTEE',
        }),
      ],
      submitFeedbackItem: vi.fn(),
      skipFeedbackItem: vi.fn(),
      dismissQueue: vi.fn(),
    });

    rerender(<PendingFeedbackQueueLauncher />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('feedback-mentor-header')).toHaveTextContent(
      'Zahra Mirzakhani'
    );
  });
});
