'use client';

import * as React from 'react';

import MeetingFeedbackDialog from '@/components/reservation/MeetingFeedbackDialog';
import type { Reservation } from '@/types/reservation';
import type {
  FeedbackViewerRole,
  SubmitReservationFeedbackRequest,
} from '@/types/reservationFeedback';

export { PendingFeedbackQueueLauncher } from './PendingFeedbackQueueLauncher';

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

  // Top-right X in multi-item mode skips the current session and advances to the next;
  // pressing ESC (or closing the final session) skips remaining unaddressed items and invokes onClose (`dismissQueue`).
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

export default PendingFeedbackModal;
