'use client';

import { useRef } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { BookingStatus } from '@/lib/profile/bookingAvailability';
import type { Reservation } from '@/types/reservation';

const PROMPT_COPY: Record<
  BookingStatus,
  { title: (name: string) => string; description: (name: string) => string }
> = {
  BOOKED: {
    title: (name) => (name ? `學員 ${name} 已預約此時段` : '此時段已有預約'),
    description: (name) =>
      name
        ? `學員 ${name} 已預約成功，無法編輯或移除。如需調整時間，請新增新時段；如需取消原預約，請至「預約管理」頁面處理。`
        : '此時段已有 mentee 預約成功，無法編輯或移除。如需調整時間，請新增新時段；如需取消原預約，請至「預約管理」頁面處理。',
  },
  PENDING: {
    title: (name) =>
      name ? `學員 ${name} 申請預約此時段` : '此時段有未處理的預約申請',
    description: (name) =>
      name
        ? `學員 ${name} 的預約申請尚未處理。請至「預約管理」頁面接受或拒絕該申請，僅在拒絕後此時段才會重新釋出。若需提供其他時間，請直接新增新時段。`
        : '請至「預約管理」頁面接受或拒絕該申請，僅在拒絕後此時段才會重新釋出。若需提供其他時間，請直接新增新時段。',
  },
};

export interface ReservationBlockPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promptType: BookingStatus;
  matchedReservation?: Reservation;
  onNavigateToReservations: () => void;
}

export function ReservationBlockPromptDialog({
  open,
  onOpenChange,
  promptType,
  matchedReservation,
  onNavigateToReservations,
}: ReservationBlockPromptDialogProps) {
  // Retain the last open snapshot so title and mentee name do not flicker
  // back to fallback copy during the Radix Dialog fade-out transition, while
  // immediately overwriting when a new prompt opens so names never leak.
  const lastOpenSnapshotRef = useRef<{
    promptType: BookingStatus;
    matchedReservation?: Reservation;
  }>({
    promptType,
    matchedReservation,
  });

  if (open) {
    lastOpenSnapshotRef.current = { promptType, matchedReservation };
  }

  const effective = open
    ? { promptType, matchedReservation }
    : lastOpenSnapshotRef.current;

  const menteeName = effective.matchedReservation?.name ?? '';
  const activeCopy = PROMPT_COPY[effective.promptType];
  const dialogTitle = activeCopy.title(menteeName);
  const dialogDescription = activeCopy.description(menteeName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="justify-center">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onNavigateToReservations}>前往預約管理</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
