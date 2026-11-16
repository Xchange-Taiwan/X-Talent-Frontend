'use client';

import dynamic from 'next/dynamic';
import * as React from 'react';
import { Suspense } from 'react';

import { usePendingFeedbackQueue } from '@/hooks/user/reservation/usePendingFeedbackQueue';

const DynamicMeetingFeedbackDialog = dynamic(
  () => import('@/components/reservation/MeetingFeedbackDialog'),
  {
    ssr: false,
  }
);

function PendingFeedbackQueueWatcher(): JSX.Element | null {
  const { queueItems, submitFeedbackItem, skipFeedbackItem, dismissQueue } =
    usePendingFeedbackQueue();

  if (!queueItems || queueItems.length === 0) {
    return null;
  }

  return (
    <DynamicMeetingFeedbackDialog
      defaultOpen
      hideTrigger
      reservation={queueItems[0]}
      queue={queueItems}
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

export default PendingFeedbackQueueLauncher;
