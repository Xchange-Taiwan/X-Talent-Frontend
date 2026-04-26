'use client';

import { Calendar, ChevronLeft, Clock, Hourglass, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import DefaultAvatarImgUrl from '@/assets/default-avatar.png';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  BookingSlot,
  UseMentorScheduleReturn,
} from '@/hooks/useMentorSchedule';
import { UserType } from '@/hooks/user/user-data/useUserData';
import { trackEvent } from '@/lib/analytics';
import { getAvatarThumbUrl } from '@/lib/avatar/getAvatarThumbUrl';
import { captureFlowFailure } from '@/lib/monitoring';
import {
  createReservation,
  CreateReservationPayload,
} from '@/services/reservations';

import { ScheduleCalendar } from './ScheduleCalendar';

export default function MenteeReservationDialog({
  open,
  onOpenChange,
  schedule,
  userData,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: UseMentorScheduleReturn;
  userData: UserType | null;
}) {
  const { selectedDate, setSelectedDate, allowedDates, generateBookingSlots } =
    schedule;
  const router = useRouter();

  const [view, setView] = useState<
    'selection' | 'confirmation' | 'success' | 'conflict'
  >('selection');
  const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);
  const [bookingQuestion, setBookingQuestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      trackEvent({
        name: 'feature_opened',
        feature: 'reservation',
        metadata: { dialog: 'mentee_reservation' },
      });
    } else {
      const id = setTimeout(() => {
        setView('selection');
        setSelectedSlot(null);
        setBookingQuestion('');
        setSubmitError(null);
      }, 200);
      return () => clearTimeout(id);
    }
  }, [open]);

  const handleSave = () => {
    if (selectedDate && selectedSlot) {
      trackEvent({
        name: 'reservation_booking_started',
        feature: 'reservation',
      });
      setView('confirmation');
    }
  };

  const handleBack = () => {
    setView('selection');
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleGoToReservation = () => {
    router.push('/reservation/mentee');
    handleClose();
  };

  const handleFindMentor = () => {
    router.push('/mentor-pool');
    handleClose();
  };

  const handleRebook = () => {
    setView('selection');
    setSubmitError(null);
  };

  const handleConfirm = async () => {
    if (!selectedSlot || !userData) return;

    setIsSubmitting(true);
    try {
      const session = await getSession();
      if (!session?.user?.id) {
        throw new Error('You must be logged in to make a reservation.');
      }
      const menteeId = session.user.id;

      const payload: CreateReservationPayload = {
        my_user_id: menteeId,
        my_status: 'PENDING',
        user_id: userData.user_id,
        schedule_id: selectedSlot.scheduleId,
        dtstart: Math.floor(selectedSlot.start.getTime() / 1000),
        dtend: Math.floor(selectedSlot.end.getTime() / 1000),
        messages: [{ user_id: menteeId, content: bookingQuestion }],
        previous_reserve: {},
      };

      await createReservation({
        userId: menteeId,
        body: payload,
        debug: process.env.NODE_ENV === 'development',
      });

      setSubmitError(null);
      trackEvent({
        name: 'reservation_booking_confirmed',
        feature: 'reservation',
      });
      setView('success');
    } catch (error) {
      console.error('Failed to create reservation:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      captureFlowFailure({
        flow: 'reservation_create',
        step: msg.includes('logged in') ? 'get_session' : 'create_reservation',
        message: msg,
      });
      const isDuplicate =
        msg.includes('409') ||
        msg.toLowerCase().includes('conflict') ||
        msg.toLowerCase().includes('already');
      if (isDuplicate) {
        setView('conflict');
      } else {
        setSubmitError(`預約失敗：${msg}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTimeSlot = (slot: BookingSlot) => {
    const fmt = (d: Date) =>
      d.toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    return `${fmt(slot.start)} – ${fmt(slot.end)}`;
  };

  const formatDate = (date: string | null) => {
    if (!date) return '';
    return new Date(date + 'T00:00:00').toLocaleDateString('zh-TW', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatSelectedDate = (selectedDate: string | null): string => {
    if (!selectedDate) {
      return '';
    }
    return new Intl.DateTimeFormat('zh-TW', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(new Date(selectedDate + 'T00:00:00'));
  };

  const renderSelectionView = () => (
    <>
      <DialogHeader>
        <DialogTitle>預約時段</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-4 py-4">
        <div className="w-full rounded-lg border p-2 shadow-md">
          <div className="px-3 pb-3 pt-1">
            <h2 className="text-2xl font-semibold tracking-tight">
              {formatSelectedDate(selectedDate)}
            </h2>
          </div>
          <ScheduleCalendar
            size="compact"
            selected={
              selectedDate
                ? new Date(selectedDate + 'T00:00:00')
                : allowedDates[0]
                  ? new Date(allowedDates[0] + 'T00:00:00')
                  : new Date()
            }
            onSelect={(d) =>
              setSelectedDate(
                d
                  ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
                      2,
                      '0'
                    )}-${String(d.getDate()).padStart(2, '0')}`
                  : null
              )
            }
            allowedDates={allowedDates}
            showTodayStyle={false}
            disableEmptyDates={true}
          />
        </div>
        <div>
          <p className="font-semibold">可預約時段</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2">
            {(() => {
              const slots = selectedDate
                ? generateBookingSlots(selectedDate)
                : [];

              if (slots.length === 0) {
                return (
                  <div className="col-span-full text-center text-sm text-gray-500">
                    此日期暫無可預約時段
                  </div>
                );
              }

              return slots.map((slot) => (
                <Button
                  key={slot.start.getTime()}
                  variant={
                    selectedSlot?.start.getTime() === slot.start.getTime()
                      ? 'default'
                      : 'outline'
                  }
                  disabled={slot.isBooked}
                  onClick={() => setSelectedSlot(slot)}
                  className={`h-10 w-full text-sm lg:h-11 lg:text-base ${
                    slot.isBooked
                      ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 disabled:opacity-100'
                      : ''
                  }`}
                >
                  {formatTimeSlot(slot)}
                </Button>
              ));
            })()}
          </div>
        </div>
      </div>
      <DialogFooter className="flex flex-col justify-center gap-2 sm:flex-row">
        <Button variant="outline" onClick={handleClose}>
          取消
        </Button>
        <Button onClick={handleSave} disabled={!selectedDate || !selectedSlot}>
          預約時段
        </Button>
      </DialogFooter>
    </>
  );

  const renderConfirmationView = () => (
    <>
      <DialogHeader>
        <div className="relative flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-0"
            onClick={handleBack}
            disabled={isSubmitting}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <DialogTitle>確認預約</DialogTitle>
        </div>
      </DialogHeader>
      <div className="flex flex-col gap-4 py-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 flex-shrink-0 rounded-full">
              <Image
                src={
                  userData?.avatar
                    ? getAvatarThumbUrl(userData.avatar)
                    : DefaultAvatarImgUrl
                }
                alt={userData?.name || 'Mentor Avatar'}
                fill
                className="rounded-full object-cover"
              />
            </div>
            <div>
              <p className="font-semibold">{userData?.name}</p>
              <p className="text-sm text-muted-foreground">
                {userData?.job_title} at {userData?.company}
              </p>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <p>{selectedDate ? formatDate(selectedDate) : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p>{selectedSlot ? formatTimeSlot(selectedSlot) : ''}</p>
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <label htmlFor="booking-question" className="font-semibold">
            你想問導師的問題
          </label>
          <Textarea
            id="booking-question"
            placeholder="請在此輸入你的問題..."
            className="min-h-[179px]"
            value={bookingQuestion}
            onChange={(e) => setBookingQuestion(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
      </div>
      {submitError && (
        <p className="text-red-500 text-center text-sm">{submitError}</p>
      )}
      <DialogFooter className="justify-center">
        <Button
          onClick={handleConfirm}
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          確認
        </Button>
      </DialogFooter>
    </>
  );

  const renderSuccessView = () => (
    <>
      <DialogHeader>
        <DialogTitle className="text-center">預約成功</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col items-center gap-6 py-4">
        <div className="w-full rounded-lg border p-4">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 flex-shrink-0 rounded-full">
              <Image
                src={
                  userData?.avatar
                    ? getAvatarThumbUrl(userData.avatar)
                    : DefaultAvatarImgUrl
                }
                alt={userData?.name || 'Mentor Avatar'}
                fill
                className="rounded-full object-cover"
              />
            </div>
            <div>
              <p className="font-semibold">{userData?.name}</p>
              <p className="text-sm text-muted-foreground">
                {userData?.job_title}
              </p>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <p>{selectedDate ? formatDate(selectedDate) : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              <Hourglass className="h-4 w-4 text-muted-foreground" />
              <p>{selectedSlot ? formatTimeSlot(selectedSlot) : ''}</p>
            </div>
          </div>
        </div>
      </div>
      <DialogFooter className="flex-col gap-3 sm:flex-col sm:space-x-0">
        <Button onClick={handleGoToReservation} className="w-full">
          我的預約
        </Button>
        <Button variant="outline" onClick={handleClose} className="w-full">
          繼續探索導師
        </Button>
      </DialogFooter>
    </>
  );

  const renderConflictView = () => {
    const formattedDate = selectedDate ? formatDate(selectedDate) : '';
    const formattedTime = selectedSlot ? formatTimeSlot(selectedSlot) : '';
    const dateTimeLabel = [formattedDate, formattedTime]
      .filter(Boolean)
      .join(' • ');

    return (
      <>
        <DialogHeader>
          <DialogTitle className="text-center">預約時間重疊</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <p className="text-sm text-muted-foreground">
            該時段您已有其他預約，請重新選擇其他時段，謝謝。
          </p>
          <div className="space-y-2 rounded-xl border border-border p-5">
            <p className="text-sm font-semibold">導師：{userData?.name}</p>
            <p className="text-sm text-muted-foreground">
              時間：{dateTimeLabel}
            </p>
          </div>
        </div>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            variant="outline"
            onClick={handleFindMentor}
            className="w-full sm:w-auto"
          >
            尋找導師
          </Button>
          <Button onClick={handleRebook} className="w-full sm:w-auto">
            重新預約
          </Button>
        </DialogFooter>
      </>
    );
  };

  const renderContent = () => {
    switch (view) {
      case 'selection':
        return renderSelectionView();
      case 'confirmation':
        return renderConfirmationView();
      case 'success':
        return renderSuccessView();
      case 'conflict':
        return renderConflictView();
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] max-w-[335px] overflow-y-auto sm:max-w-[425px] lg:max-w-[560px]">
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
