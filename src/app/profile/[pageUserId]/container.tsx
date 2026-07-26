'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import DefaultAvatarImgUrl from '@/assets/default-avatar.png';
import { useToast } from '@/components/ui/use-toast';
import { BookingSlot, useMentorSchedule } from '@/hooks/useMentorSchedule';
import { useCurrentAvatar } from '@/hooks/user/profile/useCurrentAvatar';
import { primeTagCatalogCacheIfEmpty } from '@/hooks/user/tags/useTagCatalog';
import useUserData from '@/hooks/user/user-data/useUserData';
import { primeUserProfileDtoCacheIfEmpty } from '@/hooks/user/user-data/useUserProfileDto';
import { trackEvent } from '@/lib/analytics';
import { captureFlowFailure } from '@/lib/monitoring';
import type { TagCatalogsByBucket } from '@/services/profile/tagCatalog';
import type { MentorProfileVO } from '@/services/profile/user';
import { createReservation } from '@/services/reservations';

import { ProfilePageSkeleton } from './skeleton';

const ProfilePageUI = dynamic(() => import('./ui'), {
  loading: () => <ProfilePageSkeleton />,
});

interface Props {
  pageUserId: string;
  initialDto: MentorProfileVO;
  initialCatalogs: TagCatalogsByBucket;
  initialLoginUserId: string;
}

export default function ProfilePageContainer({
  pageUserId,
  initialDto,
  initialCatalogs,
  initialLoginUserId,
}: Props) {
  const router = useRouter();

  // Synchronously seed the in-memory dto cache from the SSR-fetched initialDto
  // BEFORE child hooks run. This is intentionally inside render (not useEffect)
  // so the first render of useUserProfileDto's lazy-init `useState` reads the
  // primed entry — first paint shows content with no skeleton flash.
  // `IfEmpty` preserves a more authoritative client-side prime that
  // `useProfileSubmit` may have just written via `firstSyncedFetch`.
  const pageUserIdNumber = Number(pageUserId);
  if (Number.isFinite(pageUserIdNumber)) {
    primeUserProfileDtoCacheIfEmpty(pageUserIdNumber, 'zh_TW', initialDto);
  }
  // Same idea for the tag catalog: SSR already fetched the localized labels,
  // so seed the client cache here so useTagCatalog resolves subject_group
  // codes to Chinese labels on first paint instead of flashing raw codes.
  primeTagCatalogCacheIfEmpty('zh_TW', initialCatalogs);

  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);

  const schedule = useMentorSchedule({
    backend: { userId: pageUserId, year, month },
  });
  const { loaded, selectedDate, setSelectedDate, parsedDraft, allowedDates } =
    schedule;

  const [openReservationDialog, setOpenReservationDialog] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setSelectedSlot(null);
  }, [selectedDate]);

  const handleScheduleMonthChange = (date: Date) => {
    const newYear = date.getFullYear();
    const newMonth = date.getMonth() + 1;
    setYear(newYear);
    setMonth(newMonth);
    // Carry the viewed month into the booking dialogs by anchoring
    // selectedDate to the new month. Skip while a dialog is open so
    // in-dialog month navigation does not clobber the user's day pick.
    // Clamp to today so a past month never anchors to an un-editable
    // past day (which would let the dialog render its slot editor on
    // a date the mentor cannot configure).
    if (!openReservationDialog) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const monthStart = new Date(newYear, newMonth - 1, 1);
      const anchor = monthStart < today ? today : monthStart;
      const pad = (n: number) => String(n).padStart(2, '0');
      setSelectedDate(
        `${anchor.getFullYear()}-${pad(anchor.getMonth() + 1)}-${pad(anchor.getDate())}`
      );
    }
  };

  // Auto-select the first available date once schedule is loaded
  useEffect(() => {
    if (!loaded) return;
    const firstSlot = parsedDraft.find((s) => s.type === 'ALLOW');
    if (firstSlot) setSelectedDate(firstSlot.dateKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const { data: session } = useSession();
  // Prefer the live session id once hydrated; fall back to the SSR-resolved
  // value so own-profile UI (edit button, etc.) renders correctly on first
  // paint without waiting for next-auth's client hydration.
  const loginUserId = session?.user?.id
    ? String(session.user.id)
    : initialLoginUserId;
  const isLogging = Boolean(loginUserId);

  const { userData, isLoading: userLoading } = useUserData(
    pageUserIdNumber,
    'zh_TW'
  );

  // The S3 avatar URL is a stable key (re-uploads overwrite in place), so a
  // `?v=` query is the only way to bust the Image Optimizer / browser cache.
  // updateAvatar bakes the cache buster into the URL it returns at upload
  // time. On own-profile, prefer the just-submitted override (set
  // synchronously by useProfileSubmit) over `userData.avatar`, which can
  // briefly come from a stale ISR initialDto on the post-submit navigation
  // race. The override clears once session.user.avatar catches up.
  const isOwnProfile = loginUserId === pageUserId;
  const currentAvatar = useCurrentAvatar();
  const resolvedAvatar = isOwnProfile
    ? (currentAvatar ?? userData?.avatar)
    : userData?.avatar;
  const avatarSrc = resolvedAvatar || DefaultAvatarImgUrl;

  if (!userLoading && !userData) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-gray-500">
        沒有該位使用者
      </div>
    );
  }

  const reservationHandler = () => {
    if (!loginUserId) {
      router.push('/auth/signin');
      return;
    }
    if (!userData) return;
    // If the user directly clicked a past day on the profile calendar
    // (still possible when that day has saved slots), snap selectedDate
    // forward to today so the dialog never opens on an un-editable past
    // date with its slot editor primed.
    if (selectedDate) {
      const sel = new Date(selectedDate + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (sel < today) {
        const pad = (n: number) => String(n).padStart(2, '0');
        setSelectedDate(
          `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
        );
        const todayYear = today.getFullYear();
        const todayMonth = today.getMonth() + 1;
        if (todayYear !== year || todayMonth !== month) {
          setYear(todayYear);
          setMonth(todayMonth);
        }
      }
    }
    if (userData.is_mentor && pageUserId === loginUserId) {
      setOpenReservationDialog(true);
      return;
    }
  };

  const handleConfirmReservation = async (
    question: string
  ): Promise<boolean> => {
    if (!loginUserId) {
      router.push('/auth/signin');
      return false;
    }
    if (!selectedSlot || !userData) return false;

    setIsSubmitting(true);
    try {
      const menteeId = Number(loginUserId);
      await createReservation({
        userId: menteeId,
        body: {
          my_user_id: menteeId,
          my_status: 'PENDING',
          user_id: userData.user_id,
          schedule_id: selectedSlot.scheduleId,
          dtstart: Math.floor(selectedSlot.start.getTime() / 1000),
          dtend: Math.floor(selectedSlot.end.getTime() / 1000),
          messages: [{ user_id: menteeId, content: question }],
        },
        debug: process.env.NODE_ENV === 'development',
      });

      trackEvent({
        name: 'reservation_booking_confirmed',
        feature: 'reservation',
      });

      toast({
        title: '預約已送出，等待導師回復',
        description: '導師接受後預約才會成立，可至「我的預約」追蹤狀態。',
      });

      setSelectedSlot(null);
      return true;
    } catch (error) {
      console.error('Failed to create reservation:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      const isDuplicate =
        msg.includes('409') ||
        msg.toLowerCase().includes('conflict') ||
        msg.toLowerCase().includes('already');

      captureFlowFailure({
        flow: 'reservation_create',
        step: 'create_reservation',
        message: msg,
        ...(isDuplicate ? { level: 'info' as const } : {}),
      });

      if (isDuplicate) {
        toast({
          title: '預約時間重疊',
          description: '該時段您已有其他預約，請重新選擇其他時段。',
          variant: 'destructive',
        });
      } else {
        toast({
          title: '預約失敗',
          description: msg,
          variant: 'destructive',
        });
      }
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProfilePageUI
      userData={userData}
      userLoading={userLoading}
      pageUserId={pageUserId}
      schedule={schedule}
      scheduleLoaded={loaded}
      loginUserId={loginUserId}
      isLogging={isLogging}
      avatarSrc={avatarSrc}
      allowedDates={allowedDates}
      openReservationDialog={openReservationDialog}
      setOpenReservationDialog={setOpenReservationDialog}
      onReservation={reservationHandler}
      onScheduleMonthChange={handleScheduleMonthChange}
      selectedSlot={selectedSlot}
      setSelectedSlot={setSelectedSlot}
      isSubmitting={isSubmitting}
      onConfirmReservation={handleConfirmReservation}
      onEditProfile={() => router.push(`/profile/${pageUserId}/edit`)}
      onBecomeMentor={() =>
        router.push(`/profile/${pageUserId}/edit?mentor-onboarding=true`)
      }
    />
  );
}
