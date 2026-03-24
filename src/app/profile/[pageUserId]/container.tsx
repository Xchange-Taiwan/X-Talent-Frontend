'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';

import { useMentorSchedule } from '@/hooks/useMentorSchedule';
import useUserData from '@/hooks/user/user-data/useUserData';

import { ProfilePageSkeleton } from './skeleton';

const ProfilePageUI = dynamic(() => import('./ui'));

interface Props {
  pageUserId: string;
}

export default function ProfilePageContainer({ pageUserId }: Props) {
  const router = useRouter();

  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);

  const handleScheduleMonthChange = (date: Date) => {
    setYear(date.getFullYear());
    setMonth(date.getMonth() + 1);
  };

  const schedule = useMentorSchedule({
    mode: 'backend',
    backend: { userId: pageUserId, year, month },
  });
  const { loaded, setSelectedDate, parsedDraft } = schedule;

  // Auto-select the first available date once schedule is loaded
  useEffect(() => {
    if (!loaded) return;
    const firstSlot = parsedDraft.find((s) => s.type === 'ALLOW');
    if (firstSlot) setSelectedDate(firstSlot.dateKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // Stable per-session fallback for other users' profiles — allows browser
  // caching across navigations. Resets only on full page refresh.
  const stableCacheBust = useRef(Date.now()).current;

  const { data: session } = useSession();
  const isLogging = Boolean(session?.user?.id);
  const loginUserId = session?.user?.id ? String(session.user.id) : '';

  // For the logged-in user's own profile, use the session's avatarUpdatedAt so
  // the latest avatar appears immediately after a profile update without a full
  // page reload. For other users' profiles the stable fallback is sufficient.
  const avatarCacheBust =
    loginUserId === pageUserId
      ? (session?.user?.avatarUpdatedAt ?? stableCacheBust)
      : stableCacheBust;

  const [openReservationDialog, setOpenReservationDialog] = useState(false);
  const [openMenteeReservationDialog, setOpenMenteeReservationDialog] =
    useState(false);

  const pageUserIdNumber = Number(pageUserId);
  const { userData, isLoading: loading } = useUserData(
    pageUserIdNumber,
    'zh_TW'
  );

  // Show skeleton only while user profile data loads.
  // Schedule data (calendar) renders progressively once the profile appears.
  if (loading) return <ProfilePageSkeleton />;

  if (!userData) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-gray-500">
        沒有該位使用者
      </div>
    );
  }

  const allowedDates = parsedDraft
    .filter((slot) => slot.type === 'ALLOW')
    .map((slot) => slot.dateKey);

  const reservationHandler = () => {
    if (!loginUserId) {
      router.push('/auth/signin');
      return;
    }
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
      pageUserId={pageUserId}
      schedule={schedule}
      scheduleLoaded={loaded}
      loginUserId={loginUserId}
      isLogging={isLogging}
      avatarCacheBust={avatarCacheBust}
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
