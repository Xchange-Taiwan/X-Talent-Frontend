import { fireEvent, render, screen, within } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { Reservation } from '@/types/reservation';

import { MeetingFeedbackHeader } from './MeetingFeedbackHeader';

const sampleReservation = fromPartial<Reservation>({
  id: 'hdr-1',
  name: 'Emily Chen',
  avatar: undefined,
  date: '2026/10/20',
  time: '19:00–19:30',
});

describe('MeetingFeedbackHeader', () => {
  it('renders single Mentee session summary with Clarity masking, initials fallback, and close button', () => {
    const onCloseOrSkipClick = vi.fn();

    render(
      <MeetingFeedbackHeader
        activeReservation={sampleReservation}
        queueItems={[sampleReservation]}
        queueIndex={0}
        isQueueMode={false}
        isMentor={false}
        isSubmitting={false}
        isTransitioningCard={false}
        tooltipDismissSignal={0}
        onSkipTooltipOpenChange={() => {}}
        onCloseOrSkipClick={onCloseOrSkipClick}
      />
    );

    const header = screen.getByTestId('feedback-mentor-header');
    const nameNode = within(header).getByText('Emily Chen');
    expect(nameNode).toHaveAttribute('data-clarity-mask', 'true');
    expect(within(header).getByText('EC')).toBeInTheDocument();
    expect(
      within(header).getByText('2026/10/20 · 19:00–19:30')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('feedback-dialog-title')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '關閉回饋視窗' }));
    expect(onCloseOrSkipClick).toHaveBeenCalledTimes(1);
  });

  it('renders Mentor single-session title row (確認會談) without duplicating close button', () => {
    render(
      <MeetingFeedbackHeader
        activeReservation={sampleReservation}
        queueItems={[sampleReservation]}
        queueIndex={0}
        isQueueMode={false}
        isMentor={true}
        isSubmitting={false}
        isTransitioningCard={false}
        tooltipDismissSignal={0}
        onSkipTooltipOpenChange={() => {}}
        onCloseOrSkipClick={() => {}}
      />
    );

    expect(screen.getByTestId('feedback-dialog-title')).toHaveTextContent(
      '確認會談'
    );
    expect(
      screen.getAllByRole('button', { name: '關閉回饋視窗' })
    ).toHaveLength(1);
  });

  it('renders multi-session queue counter, segmented progress bar states, and skip tooltip button', () => {
    const item2 = fromPartial<Reservation>({
      ...sampleReservation,
      id: 'hdr-2',
      name: 'Alex Wang',
    });
    const item3 = fromPartial<Reservation>({
      ...sampleReservation,
      id: 'hdr-3',
      name: 'Sarah Lin',
    });
    const onCloseOrSkipClick = vi.fn();

    render(
      <MeetingFeedbackHeader
        activeReservation={item2}
        queueItems={[sampleReservation, item2, item3]}
        queueIndex={1}
        isQueueMode={true}
        isMentor={false}
        isSubmitting={false}
        isTransitioningCard={false}
        tooltipDismissSignal={0}
        onSkipTooltipOpenChange={() => {}}
        onCloseOrSkipClick={onCloseOrSkipClick}
      />
    );

    expect(screen.getByTestId('feedback-queue-counter')).toHaveTextContent(
      '第 2／3 場'
    );
    const progressBar = screen.getByTestId('feedback-queue-progressbar');
    expect(progressBar.children[0]).toHaveAttribute('data-state', 'completed');
    expect(progressBar.children[0]).toHaveClass('bg-brand-200');
    expect(progressBar.children[1]).toHaveAttribute('data-state', 'current');
    expect(progressBar.children[1]).toHaveClass('bg-brand-700');
    expect(progressBar.children[2]).toHaveAttribute('data-state', 'upcoming');
    expect(progressBar.children[2]).toHaveClass('bg-background-border');

    const skipBtn = screen.getByRole('button', {
      name: '略過 Alex Wang 這場回饋',
    });
    fireEvent.mouseEnter(skipBtn);
    expect(screen.getByTestId('feedback-skip-tooltip')).toHaveTextContent(
      '略過這場，下次登入再提醒；也可到歷史紀錄填寫。'
    );

    fireEvent.click(skipBtn);
    expect(onCloseOrSkipClick).toHaveBeenCalledTimes(1);
  });
});
