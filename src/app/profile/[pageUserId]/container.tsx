'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import DefaultAvatarImgUrl from '@/assets/default-avatar.png';
import { useMentorSchedule } from '@/hooks/useMentorSchedule';
import useUserData from '@/hooks/user/user-data/useUserData';
import { primeUserProfileDtoCacheIfEmpty } from '@/hooks/user/user-data/useUserProfileDto';
import type { MentorProfileVO } from '@/services/profile/user';

import { ProfilePageSkeleton } from './skeleton';

const ProfilePageUI = dynamic(() => import('./ui'), {
  loading: () => <ProfilePageSkeleton />,
});

interface Props {
  pageUserId: string;
  initialDto: MentorProfileVO;
  initialLoginUserId: string;
}

export default function ProfilePageContainer({
  pageUserId,
  initialDto,
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

  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);

  const handleScheduleMonthChange = (date: Date) => {
    setYear(date.getFullYear());
    setMonth(date.getMonth() + 1);
  };

  const schedule = useMentorSchedule({
    backend: { userId: pageUserId, year, month },
  });
  const { loaded, setSelectedDate, parsedDraft, allowedDates } = schedule;

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

  const [openReservationDialog, setOpenReservationDialog] = useState(false);
  const [openMenteeReservationDialog, setOpenMenteeReservationDialog] =
    useState(false);

  const { userData, isLoading: userLoading } = useUserData(
    pageUserIdNumber,
    'zh_TW'
  );

  // Only attach a versioning param for the logged-in user's own profile; the
  // stable URL for other users lets the Next.js Image Optimizer hit its cache
  // across navigations. While the DTO is still loading on the user's own
  // profile, fall back to the session avatar so the page does not flash blank.
  const isOwnProfile = loginUserId === pageUserId;
  const resolvedAvatar =
    userData?.avatar ?? (isOwnProfile ? session?.user?.avatar : undefined);
  const avatarSrc = resolvedAvatar
    ? isOwnProfile && session?.user?.avatarUpdatedAt
      ? `${resolvedAvatar}?v=${session.user.avatarUpdatedAt}`
      : resolvedAvatar
    : DefaultAvatarImgUrl;

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
    if (userData.is_mentor && pageUserId === loginUserId) {
      setOpenReservationDialog(true);
      return;
    }
    if (userData.is_mentor && pageUserId !== loginUserId) {
      setOpenMenteeReservationDialog(true);
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
      openMenteeReservationDialog={openMenteeReservationDialog}
      setOpenMenteeReservationDialog={setOpenMenteeReservationDialog}
      onReservation={reservationHandler}
      onScheduleMonthChange={handleScheduleMonthChange}
      onEditProfile={() => router.push(`/profile/${pageUserId}/edit`)}
      onBecomeMentor={() =>
        router.push(`/profile/${pageUserId}/edit?onboarding=true`)
      }
    />
  );
}
