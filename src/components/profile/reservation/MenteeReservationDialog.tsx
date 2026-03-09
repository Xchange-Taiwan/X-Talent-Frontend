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
  ParsedMentorTimeslot,
  UseMentorScheduleReturn,
} from '@/hooks/useMentorSchedule';
import { UserType } from '@/hooks/user/user-data/useUserData';
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
  const { selectedDate, setSelectedDate, draftForSelectedDate, parsedDraft } =
    schedule;
  const router = useRouter();

  const [view, setView] = useState<'selection' | 'confirmation' | 'success'>(
    'selection'
  );
  const [selectedSlot, setSelectedSlot] = useState<ParsedMentorTimeslot | null>(
    null
  );
  const [bookingQuestion, setBookingQuestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setView('selection');
        setSelectedSlot(null);
        setBookingQuestion('');
      }, 200);
    }
  }, [open]);

  const handleSave = () => {
    if (selectedDate && selectedSlot) {
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
    router.push('/reservation');
    handleClose();
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
        schedule_id: selectedSlot.id,
        dtstart: Math.floor(new Date(selectedSlot.start).getTime() / 1000),
        dtend: Math.floor(new Date(selectedSlot.end).getTime() / 1000),
        messages: [{ user_id: menteeId, msg: bookingQuestion }],
        previous_reserve: {},
      };

      await createReservation({
        userId: menteeId,
        body: payload,
        accessToken: session.accessToken,
        debug: process.env.NODE_ENV === 'development',
      });

      setView('success');
    } catch (error) {
      console.error('Failed to create reservation:', error);
      alert(
        `Failed to create reservation: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatStartTimeSlot = (slot: ParsedMentorTimeslot) => {
    const date = new Date(slot.start);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (date: string | null) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
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
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Taipei',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(new Date(selectedDate));
  };

  const allowedDates = parsedDraft
    .filter((slot) => slot.type === 'ALLOW')
    .map((slot) => slot.dateKey);

  const renderSelectionView = () => (
    <>
      <DialogHeader>
        <DialogTitle>Book a Session</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-4 py-4">
        <div className="inline-block w-auto rounded-lg border p-2 shadow-md">
          <div className="px-3 pb-3 pt-1">
            <h2 className="text-2xl font-semibold tracking-tight">
              {formatSelectedDate(selectedDate)}
            </h2>
          </div>
          <ScheduleCalendar
            selected={selectedDate ? new Date(selectedDate) : new Date()}
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
          <p className="font-semibold">Available time slots</p>
          <div className="mt-4 flex flex-row flex-wrap gap-4">
            {draftForSelectedDate.map((slot) => (
              <Button
                key={slot.id}
                variant={selectedSlot?.id === slot.id ? 'default' : 'outline'}
                onClick={() => setSelectedSlot(slot)}
                className="h-[40px] w-[96px]"
              >
                {formatStartTimeSlot(slot)}
              </Button>
            ))}
            {draftForSelectedDate.length === 0 && (
              <div className="text-center text-sm text-gray-500">
                No available slots for this date.
              </div>
            )}
          </div>
        </div>
      </div>
      <DialogFooter className="flex flex-col justify-center gap-2 sm:flex-row">
        <Button variant="outline" onClick={handleClose}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!selectedDate || !selectedSlot}>
          Book a Session
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
          <DialogTitle>Confirm Your Reservation</DialogTitle>
        </div>
      </DialogHeader>
      <div className="flex flex-col gap-4 py-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 flex-shrink-0 rounded-full">
              <Image
                src={userData?.avatar || DefaultAvatarImgUrl}
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
              <p>{selectedSlot ? formatStartTimeSlot(selectedSlot) : ''}</p>
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <label htmlFor="booking-question" className="font-semibold">
            Your question about this booking
          </label>
          <Textarea
            id="booking-question"
            placeholder="Type your question here..."
            className="min-h-[179px]"
            value={bookingQuestion}
            onChange={(e) => setBookingQuestion(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
      </div>
      <DialogFooter className="justify-center">
        <Button
          onClick={handleConfirm}
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Confirm
        </Button>
      </DialogFooter>
    </>
  );

  const renderSuccessView = () => (
    <>
      <DialogHeader>
        <DialogTitle className="text-center">Booked Successfully</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col items-center gap-6 py-4">
        <div className="w-full rounded-lg border p-4">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 flex-shrink-0 rounded-full">
              <Image
                src={userData?.avatar || DefaultAvatarImgUrl}
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
              <p>{selectedSlot ? formatStartTimeSlot(selectedSlot) : ''}</p>
            </div>
          </div>
        </div>
      </div>
      <DialogFooter className="flex-col gap-3 sm:flex-col sm:space-x-0">
        <Button onClick={handleGoToReservation} className="w-full">
          My Reservation
        </Button>
        <Button variant="outline" onClick={handleClose} className="w-full">
          Explore Mentors
        </Button>
      </DialogFooter>
    </>
  );

  const renderContent = () => {
    switch (view) {
      case 'selection':
        return renderSelectionView();
      case 'confirmation':
        return renderConfirmationView();
      case 'success':
        return renderSuccessView();
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[335px] sm:max-w-[425px]">
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
