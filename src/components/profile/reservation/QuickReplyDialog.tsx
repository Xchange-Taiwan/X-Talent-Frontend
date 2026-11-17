'use client';

import { Loader2 } from 'lucide-react';
import * as React from 'react';

import RejectReservationDialog from '@/components/reservation/RejectReservationDialog';
import { ReplyMessageField } from '@/components/reservation/ReplyMessageField';
import { ReservationIdentity } from '@/components/reservation/ReservationIdentity';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useConfirmActionDialog } from '@/hooks/reservation/useConfirmActionDialog';
import { useProfileLinkClick } from '@/hooks/reservation/useProfileLinkClick';
import { useReservationActions } from '@/hooks/user/reservation/useReservationActions';
import { resolveReservationViewer } from '@/lib/reservation/reservationViewerModel';
import { quickReplyFormSchema } from '@/schemas/quickReplySchema';
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
  // Pure data derivation - safe to call before the early-return guard below,
  // since every field comes back undefined when `reservation` is null.
  const { viewerRole, profileHref } = resolveReservationViewer({
    reservation,
    myUserId,
  });

  const { accept, rejectOrCancel, isMutating } = useReservationActions({
    myUserId,
    variant: 'pending-mentor',
    myRole: viewerRole ?? 'mentor',
    onMutationSuccess: async () => {
      await onMutationSuccess?.();
      onOpenChange(false);
    },
  });

  const { execute: executeAccept } = useConfirmActionDialog({
    errorMessage: '接受預約失敗,請稍後再試',
    open,
    onOpenChange,
    closeOnSuccess: false,
  });

  const [replyOpen, setReplyOpen] = React.useState(false);
  const [reply, setReply] = React.useState('');

  const parsedReply = quickReplyFormSchema.safeParse({ reply });
  const replyError = parsedReply.success
    ? undefined
    : parsedReply.error.issues[0]?.message;

  React.useEffect(() => {
    if (!open) return;
    setReplyOpen(false);
    setReply('');
  }, [open, reservation?.id]);

  const handleProfileLinkClick = useProfileLinkClick({
    disabled: isMutating,
    onNavigate: () => onOpenChange(false),
  });

  if (!reservation) return null;

  const handleAccept = () => {
    const validated = quickReplyFormSchema.safeParse({ reply });
    if (!validated.success) return;
    const trimmedReply = (validated.data.reply ?? '').trim();

    void executeAccept(async () => {
      await accept(reservation, trimmedReply);
    });
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
            sourceRole="mentor"
          />

          <div data-clarity-mask="true" className="mt-6">
            <ReplyMessageField
              open={replyOpen}
              onOpen={() => setReplyOpen(true)}
              disabled={isMutating}
              error={replyError}
              textareaProps={{
                value: reply,
                onChange: (e) => setReply(e.target.value),
              }}
            />
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
                disabled={isMutating || Boolean(replyError)}
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
