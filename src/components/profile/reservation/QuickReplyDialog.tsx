'use client';

import { Loader2, MessageSquarePlus } from 'lucide-react';
import * as React from 'react';

import RejectReservationDialog from '@/components/reservation/RejectReservationDialog';
import { ReservationIdentity } from '@/components/reservation/ReservationIdentity';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useQuickReplyAccept } from '@/hooks/user/reservation/useQuickReplyAccept';
import { useQuickReplyForm } from '@/hooks/user/reservation/useQuickReplyForm';
import { useReservationActions } from '@/hooks/user/reservation/useReservationActions';
import { trackEvent } from '@/lib/analytics';
import { resolveCounterpartyId } from '@/lib/reservation/resolveCounterparty';
import type { QuickReplyFormValues } from '@/schemas/quickReplySchema';
import type { Reservation } from '@/types/reservation';

interface QuickReplyDialogProps {
  reservation: Reservation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  myUserId?: string;
  onMutationSuccess?: () => void | Promise<void>;
}

export function QuickReplyDialog({
  reservation,
  open,
  onOpenChange,
  myUserId,
  onMutationSuccess,
}: QuickReplyDialogProps) {
  const { accept, rejectOrCancel, isMutating } = useReservationActions({
    myUserId,
    variant: 'pending-mentor',
    // This dialog only ever renders on the mentor's own calendar
    // (MentorScheduleConfig, reachable only via a mentor viewing their own
    // profile) - myRole is always 'mentor' here, by the platform's own
    // access rules (only a mentor can accept/reject a pending request), not
    // something worth re-deriving defensively.
    myRole: 'mentor',
    onMutationSuccess: async () => {
      // Await the reload before closing so the underlying page's calendar
      // and reservation list have already settled to the new state by the
      // time this dialog disappears, instead of exposing a stale PENDING
      // slot for one frame.
      await onMutationSuccess?.();
      onOpenChange(false);
    },
  });
  const [replyOpen, setReplyOpen] = React.useState(false);
  const {
    register,
    handleSubmit,
    reset: resetReplyForm,
    formState: { errors: replyErrors, isDirty: isReplyDirty },
  } = useQuickReplyForm();
  // Resolves the error message via the service layer itself (including the
  // shared version-conflict copy) so this component never imports from
  // src/services directly. No pending state of its own - `isMutating` below
  // already tracks this same `accept` call in flight.
  const { execute: executeAccept } = useQuickReplyAccept();

  // Read via a ref (not a dependency) inside the reset effect below: isDirty
  // flips true on the user's very first keystroke, and if it were a
  // dependency, that flip alone would re-run the effect mid-typing and
  // collapse/clear the field the user is actively filling in. The effect
  // must only fire on open/reservation changes, checking whatever isDirty
  // happens to be *at that moment*.
  const isReplyDirtyRef = React.useRef(isReplyDirty);
  React.useEffect(() => {
    isReplyDirtyRef.current = isReplyDirty;
  });

  // This dialog instance is shared/re-used across reservations (see the
  // handleOpenChange comment below), so the reply draft must reset whenever
  // it opens for a (possibly different) reservation - otherwise a leftover
  // draft from the previous one would carry over. Only call the RHF reset
  // when there is actually a dirty draft to clear: unlike useState,
  // react-hook-form's reset() always forces a re-render of formState
  // subscribers even when resetting to identical values, so calling it
  // unconditionally on every mount/reopen would re-render for no reason.
  React.useEffect(() => {
    if (!open) return;
    setReplyOpen(false);
    if (isReplyDirtyRef.current) {
      resetReplyForm();
    }
  }, [open, reservation?.id, resetReplyForm]);

  if (!reservation) return null;

  // No <form> wrapper: the footer also holds RejectReservationDialog's
  // trigger button, which has no explicit `type` and would default to
  // "submit" (firing this accept flow) if nested inside one. handleSubmit
  // is invoked directly from the accept button's onClick instead.
  const handleAccept = handleSubmit((data: QuickReplyFormValues) => {
    executeAccept(async () => {
      await accept(reservation, (data.reply ?? '').trim());
      trackEvent({
        name: 'reservation_accepted',
        feature: 'reservation',
        metadata: { has_reply: Boolean(data.reply?.trim()) },
      });
    });
  });

  const menteeId = resolveCounterpartyId(reservation, myUserId || '');
  const profileHref = menteeId ? `/profile/${menteeId}` : undefined;

  const handleProfileLinkClick = (e: React.MouseEvent) => {
    if (isMutating) {
      e.preventDefault();
      return;
    }
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)
      return;
    onOpenChange(false);
  };

  // Block outside-click/Esc dismissal while a mutation is in flight: this
  // dialog is a single shared instance re-used across reservations, so an
  // early close followed by reopening a different slot would let the
  // in-flight request's completion handler close that unrelated dialog out
  // from under the user once it resolves.
  const handleOpenChange = (next: boolean) => {
    if (isMutating) return;
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[90vw] max-w-[420px] p-0 sm:max-w-lg">
        <div className="p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-center sm:text-left">
              待您回復的預約申請
            </DialogTitle>
          </DialogHeader>

          <ReservationIdentity
            reservation={reservation}
            profileHref={profileHref}
            onProfileLinkClick={handleProfileLinkClick}
            disabled={isMutating}
          />

          <div className="mt-6">
            {replyOpen ? (
              <div>
                <div className="mb-2 text-sm font-medium">
                  給學員的回覆（選填）
                </div>
                <div className="rounded-2xl border p-2">
                  <Textarea
                    placeholder="例如：屆時於 Google Meet 見,請先準備一份履歷。"
                    className="min-h-[96px] resize-y border-0 shadow-none focus-visible:ring-0"
                    disabled={isMutating}
                    {...register('reply')}
                  />
                </div>
                {replyErrors.reply ? (
                  <p className="mt-1 text-sm text-status-error-default">
                    {replyErrors.reply.message}
                  </p>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setReplyOpen(true)}
                className="flex items-center gap-1.5 text-sm text-text-tertiary hover:text-text-primary"
                disabled={isMutating}
              >
                <MessageSquarePlus className="size-4" aria-hidden />
                附上回覆訊息（選填）
              </button>
            )}
          </div>

          {/* Footer action buttons */}
          <DialogFooter className="mt-6 flex-row justify-end gap-2 sm:gap-2">
            <div className="flex w-full gap-2 sm:w-auto">
              <RejectReservationDialog
                reservation={reservation}
                disabled={isMutating}
                size="default"
                className="w-full sm:w-auto"
                onReject={async ({ reason }) =>
                  rejectOrCancel(reservation, reason, 'reject')
                }
              />
              <Button
                type="button"
                size="default"
                className="w-full sm:w-auto"
                onClick={handleAccept}
                disabled={isMutating || Object.keys(replyErrors).length > 0}
              >
                {isMutating && <Loader2 className="mr-2 size-4 animate-spin" />}
                接受
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
