'use client';

import * as React from 'react';
import { Suspense } from 'react';

import MeetingFeedbackDialog from '@/components/reservation/MeetingFeedbackDialog';
import { usePendingFeedbackQueue } from '@/hooks/user/reservation/usePendingFeedbackQueue';
import type { Reservation } from '@/types/reservation';
import type {
  FeedbackViewerRole,
  SubmitReservationFeedbackRequest,
} from '@/types/reservationFeedback';

export interface PendingFeedbackModalProps {
  queueItems: Reservation[] | null;
  viewerRole?: FeedbackViewerRole;
  onSubmitFeedback: (
    payload: SubmitReservationFeedbackRequest,
    targetReservation: Reservation
  ) => Promise<void>;
  onSkipReservation?: (reservation: Reservation) => void;
  onClose?: () => void;
}

export function PendingFeedbackModal({
  queueItems,
  viewerRole,
  onSubmitFeedback,
  onSkipReservation,
  onClose,
}: PendingFeedbackModalProps) {
  if (!queueItems || queueItems.length === 0) {
    return null;
  }

  return (
    <MeetingFeedbackDialog
      defaultOpen
      hideTrigger
      viewerRole={viewerRole}
      reservation={queueItems[0]}
      queue={queueItems}
      onSubmitFeedback={onSubmitFeedback}
      onSkipReservation={onSkipReservation}
      onClose={onClose}
    />
  );
}

function PendingFeedbackQueueWatcher(): JSX.Element | null {
  const { queueItems, submitFeedbackItem, skipFeedbackItem, dismissQueue } =
    usePendingFeedbackQueue();

  return (
    <PendingFeedbackModal
      queueItems={queueItems}
      onSubmitFeedback={submitFeedbackItem}
      onSkipReservation={skipFeedbackItem}
      onClose={dismissQueue}
    />
  );
}

export function PendingFeedbackQueueLauncher(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <PendingFeedbackQueueWatcher />
    </Suspense>
  );
}

export default PendingFeedbackModal;
