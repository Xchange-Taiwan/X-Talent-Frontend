'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { getSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';

import { useMentorSchedule } from '@/hooks/useMentorSchedule';
import useUserData from '@/hooks/user/user-data/useUserData';

import { ProfilePageSkeleton } from './skeleton';

const ProfilePageUI = dynamic(() => import('./ui'));

// Stable within a browser session — lets the browser cache profile avatars
// across navigations. Resets on full page refresh, ensuring a fresh fetch.
const AVATAR_CACHE_BUST = Date.now();

interface Props {
  pageUserId: string;
}

export default function ProfilePageContainer({ pageUserId }: Props) {
  const router = useRouter();

  const year = useMemo(() => new Date().getFullYear(), []);
  const month = useMemo(() => new Date().getMonth() + 1, []);

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

  const [isLogging, setIsLogging] = useState(false);
  const [loginUserId, setLoginUserId] = useState('');
  const [openReservationDialog, setOpenReservationDialog] = useState(false);
  const [openMenteeReservationDialog, setOpenMenteeReservationDialog] =
    useState(false);

  useEffect(() => {
    const fetchSession = async () => {
      const session = await getSession();
      const user = session?.user;
      setIsLogging(!!user?.id);
      setLoginUserId(!!user?.id ? String(user?.id) : '');
    };

    fetchSession();
  }, []);

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
      avatarCacheBust={AVATAR_CACHE_BUST}
      allowedDates={allowedDates}
      openReservationDialog={openReservationDialog}
      setOpenReservationDialog={setOpenReservationDialog}
      openMenteeReservationDialog={openMenteeReservationDialog}
      setOpenMenteeReservationDialog={setOpenMenteeReservationDialog}
      onReservation={reservationHandler}
      onEditProfile={() => router.push(`/profile/${pageUserId}/edit`)}
      onBecomeMentor={() =>
        router.push(`/profile/${pageUserId}/edit?onboarding=true`)
      }
    />
  );
}
