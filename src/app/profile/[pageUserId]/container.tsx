'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import DefaultAvatarImgUrl from '@/assets/default-avatar.png';
import { BookingSlot, useMentorSchedule } from '@/hooks/useMentorSchedule';
import { useCurrentAvatar } from '@/hooks/user/profile/useCurrentAvatar';
import { useBookingConfirmation } from '@/hooks/user/reservation/useBookingConfirmation';
import { useReservationDateClamp } from '@/hooks/user/reservation/useReservationDateClamp';
import { primeTagCatalogCacheIfEmpty } from '@/hooks/user/tags/useTagCatalog';
import useUserData from '@/hooks/user/user-data/useUserData';
import { primeUserProfileDtoCacheIfEmpty } from '@/hooks/user/user-data/useUserProfileDto';
import { getMentorOnboardingUrl } from '@/lib/routes';
import type { TagCatalogsByBucket } from '@/services/profile/tagCatalog';
import type { MentorProfileVO } from '@/services/profile/user';

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

  useEffect(() => {
    setSelectedSlot(null);
  }, [selectedDate]);

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

  const { handleScheduleMonthChange, clampSelectedDateToToday } =
    useReservationDateClamp({
      selectedDate,
      setSelectedDate,
      year,
      setYear,
      month,
      setMonth,
      openReservationDialog,
    });

  const { isSubmitting, handleConfirmReservation } = useBookingConfirmation({
    loginUserId,
    userData,
    selectedSlot,
    setSelectedSlot,
  });

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
    clampSelectedDateToToday();
    if (userData.is_mentor && pageUserId === loginUserId) {
      setOpenReservationDialog(true);
      return;
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
      onBecomeMentor={() => router.push(getMentorOnboardingUrl(pageUserId))}
    />
  );
}
