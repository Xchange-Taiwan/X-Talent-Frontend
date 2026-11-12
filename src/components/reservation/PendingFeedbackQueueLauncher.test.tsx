import { act, fireEvent, render, screen } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUsePathname = vi.fn<() => string | null>(() => '/mentor-pool');
const mockUseSearchParams = vi.fn(() => new URLSearchParams());
const { mockToast } = vi.hoisted(() => ({
  mockToast: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useSearchParams: () => mockUseSearchParams(),
}));

vi.mock('next/dynamic', () => ({
  default: () => {
    const DynamicModalShim = (
      props: React.ComponentProps<typeof PendingFeedbackModal>
    ) => <PendingFeedbackModal {...props} />;
    return DynamicModalShim;
  },
}));

vi.mock('next-auth/react', async () => {
  const { nextAuthMockFactory } = await import('@/test/mocks/nextAuth');
  return nextAuthMockFactory();
});

vi.mock('@/services/reservations', () => ({
  fetchPendingFeedbackReservations: vi.fn(),
  submitReservationFeedback: vi.fn(),
}));

vi.mock('@/hooks/user/user-data/userProfileDtoCache', () => ({
  clearUserProfileDtoCache: vi.fn(),
}));

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast, dismiss: vi.fn() }),
}));

import { submitFeedbackWithEffects } from '@/hooks/user/reservation/submitFeedbackWithEffects';
import {
  QUEUE_PROMOTE_MS,
  QUEUE_SWIPE_OUT_MS,
} from '@/hooks/user/reservation/useFeedbackQueueMotion';
import { getSessionPendingFeedbackState } from '@/lib/reservation/pendingFeedbackGuard';
import {
  fetchPendingFeedbackReservations,
  submitReservationFeedback,
} from '@/services/reservations';
import { mockSession, mockUseSession } from '@/test/mocks/nextAuth';
import type { Reservation } from '@/types/reservation';

import { PendingFeedbackModal } from './PendingFeedbackModal';
import { PendingFeedbackQueueLauncher } from './PendingFeedbackQueueLauncher';

const mockFetchPending = vi.mocked(fetchPendingFeedbackReservations);
const mockSubmitFeedback = vi.mocked(submitReservationFeedback);

function makeQueueReservation(
  id: string,
  name: string,
  dtstart: number,
  viewerRole: 'MENTOR' | 'MENTEE'
): Reservation {
  return fromPartial<Reservation>({
    id,
    name,
    date: '2026/10/12',
    time: '19:00–19:30',
    dtstart,
    dtend: dtstart + 1800,
    senderUserId: viewerRole === 'MENTOR' ? 202 : 1,
    participantUserId: viewerRole === 'MENTOR' ? 1 : 303,
    viewerRole,
  });
}

describe('PendingFeedbackQueueLauncher + usePendingFeedbackQueue real integration (#740)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    if (typeof globalThis.ResizeObserver === 'undefined') {
      globalThis.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }
    mockUsePathname.mockReturnValue('/mentor-pool');
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
    mockUseSession.mockReturnValue({
      data: {
        ...mockSession,
        user: {
          ...mockSession.user,
          id: '1',
          onBoarding: true,
          isMentor: true,
        },
      },
      status: 'authenticated',
      update: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('advances sequentially across a 3-item queue without skipping middle sessions on X or submit, and finishes final submit with toast before cleanly unmounting', async () => {
    const itemA = makeQueueReservation(
      'int-701',
      'Emily Chen',
      1760000000,
      'MENTOR'
    );
    const itemB = makeQueueReservation(
      'int-702',
      'Alex Wang',
      1761000000,
      'MENTEE'
    );
    const itemC = makeQueueReservation(
      'int-703',
      'Zahra Mirzakhani',
      1762000000,
      'MENTOR'
    );

    mockFetchPending.mockResolvedValueOnce([itemA, itemB, itemC]);
    mockSubmitFeedback.mockResolvedValue(undefined);

    render(<PendingFeedbackQueueLauncher />);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('feedback-queue-counter')).toHaveTextContent(
      '第 1／3 場'
    );
    expect(screen.getByTestId('feedback-mentor-header')).toHaveTextContent(
      'Emily Chen'
    );

    vi.useFakeTimers();

    // 1. Click top-right X on Session 1 (itemA) -> must land on Session 2 (itemB, Alex Wang), NOT skip to itemC!
    fireEvent.click(
      screen.getByRole('button', { name: '略過 Emily Chen 這場回饋' })
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(QUEUE_SWIPE_OUT_MS + QUEUE_PROMOTE_MS);
    });

    expect(screen.getByTestId('feedback-queue-counter')).toHaveTextContent(
      '第 2／3 場'
    );
    expect(
      screen.getByTestId('feedback-queue-progressbar').children
    ).toHaveLength(3);
    expect(screen.getByTestId('feedback-mentor-header')).toHaveTextContent(
      'Alex Wang'
    );

    // 2. Submit Session 2 (itemB, Mentee 2-step rating) -> must advance to Session 3 (itemC, Zahra Mirzakhani)
    fireEvent.click(screen.getByRole('radio', { name: '有進行' }));
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    fireEvent.click(screen.getByRole('radio', { name: '9 分' }));
    fireEvent.change(screen.getByLabelText(/文字回饋/), {
      target: { value: '非常實用的職涯建議' },
    });

    fireEvent.click(screen.getByRole('button', { name: '送出並填下一場' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(QUEUE_SWIPE_OUT_MS + QUEUE_PROMOTE_MS);
    });

    expect(mockSubmitFeedback).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        reservation: expect.objectContaining({ id: 'int-702' }),
        myRole: 'mentee',
        payload: {
          meeting_happened: true,
          feedback: { rating: 9, content: '非常實用的職涯建議' },
        },
      })
    );
    expect(screen.getByTestId('feedback-queue-counter')).toHaveTextContent(
      '第 3／3 場'
    );
    expect(screen.getByTestId('feedback-mentor-header')).toHaveTextContent(
      'Zahra Mirzakhani'
    );

    // 3. Submit final Session 3 (itemC, Mentor Step 1 direct confirm) -> fires toast and unmounts cleanly via onClose
    mockToast.mockClear();
    fireEvent.click(screen.getByRole('radio', { name: '有進行' }));
    fireEvent.click(screen.getByRole('button', { name: '確定送出' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(mockSubmitFeedback).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        reservation: expect.objectContaining({ id: 'int-703' }),
        myRole: 'mentor',
        payload: { meeting_happened: true },
      })
    );
    expect(mockToast).toHaveBeenCalledWith({
      title: '已送出',
      description: 'X-Talent 已收到您的回饋，謝謝您！',
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    expect(getSessionPendingFeedbackState('1')).toEqual({
      checked: true,
      dismissed: true,
      queueEmpty: false,
      submittedIds: ['int-702', 'int-703'],
      skippedIds: ['int-701'],
    });
  });

  it('preserves 第 2／2 場 progress bar in a 2-item queue after submitting Session 1 and closes cleanly with dismissed=false when both sessions are submitted', async () => {
    const itemA = makeQueueReservation(
      'two-801',
      'Emily Chen',
      1760000000,
      'MENTOR'
    );
    const itemB = makeQueueReservation(
      'two-802',
      'Alex Wang',
      1761000000,
      'MENTOR'
    );

    mockFetchPending.mockResolvedValueOnce([itemA, itemB]);
    mockSubmitFeedback.mockResolvedValue(undefined);

    render(<PendingFeedbackQueueLauncher />);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('feedback-queue-counter')).toHaveTextContent(
      '第 1／2 場'
    );

    vi.useFakeTimers();

    // Submit Session 1 -> Session 2 MUST still display '第 2／2 場' and 2-segment progressbar!
    fireEvent.click(screen.getByRole('radio', { name: '有進行' }));
    fireEvent.click(screen.getByRole('button', { name: '確定送出' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(QUEUE_SWIPE_OUT_MS + QUEUE_PROMOTE_MS);
    });

    expect(screen.getByTestId('feedback-queue-counter')).toHaveTextContent(
      '第 2／2 場'
    );
    expect(
      screen.getByTestId('feedback-queue-progressbar').children
    ).toHaveLength(2);
    expect(screen.getByTestId('feedback-mentor-header')).toHaveTextContent(
      'Alex Wang'
    );

    // Submit final Session 2 -> fires toast, runs onClose -> dismissQueue(), unmounts dialog with dismissed=false
    mockToast.mockClear();
    fireEvent.click(screen.getByRole('radio', { name: '有進行' }));
    fireEvent.click(screen.getByRole('button', { name: '確定送出' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: '已送出',
      description: 'X-Talent 已收到您的回饋，謝謝您！',
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(getSessionPendingFeedbackState('1')).toEqual({
      checked: true,
      dismissed: false,
      queueEmpty: true,
      submittedIds: ['two-801', 'two-802'],
      skippedIds: [],
    });
  });

  it('prunes completed and skipped sessions when yielding mid-queue to a suppressed route and returning to an eligible route', async () => {
    const itemA = makeQueueReservation(
      'yield-901',
      'Emily Chen',
      1760000000,
      'MENTOR'
    );
    const itemB = makeQueueReservation(
      'yield-902',
      'Alex Wang',
      1761000000,
      'MENTOR'
    );

    mockFetchPending.mockResolvedValueOnce([itemA, itemB]);
    mockSubmitFeedback.mockResolvedValue(undefined);

    const { rerender } = render(<PendingFeedbackQueueLauncher />);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    vi.useFakeTimers();

    fireEvent.click(screen.getByRole('radio', { name: '有進行' }));
    fireEvent.click(screen.getByRole('button', { name: '確定送出' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(QUEUE_SWIPE_OUT_MS + QUEUE_PROMOTE_MS);
    });

    // Yield mid-queue to suppressed reservation page -> modal unmounts and prunes itemA
    mockUsePathname.mockReturnValue('/reservation/mentor');
    rerender(<PendingFeedbackQueueLauncher />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Return to eligible page -> surfaces ONLY remaining itemB as single-item dialog
    mockUsePathname.mockReturnValue('/mentor-pool');
    rerender(<PendingFeedbackQueueLauncher />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.queryByTestId('feedback-queue-counter')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('feedback-mentor-header')).toHaveTextContent(
      'Alex Wang'
    );

    // Yield again and submit itemB from reservation history page -> returning keeps modal closed & queueEmpty=true
    mockUsePathname.mockReturnValue('/reservation/mentor');
    rerender(<PendingFeedbackQueueLauncher />);
    await act(async () => {
      await submitFeedbackWithEffects({
        reservation: itemB,
        myUserId: '1',
        myRole: 'mentor',
        payload: { meeting_happened: true },
      });
    });

    mockUsePathname.mockReturnValue('/mentor-pool');
    rerender(<PendingFeedbackQueueLauncher />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(getSessionPendingFeedbackState('1')).toEqual({
      checked: true,
      dismissed: false,
      queueEmpty: true,
      submittedIds: ['yield-901', 'yield-902'],
      skippedIds: [],
    });
  });
});
