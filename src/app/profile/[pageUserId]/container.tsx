'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import DefaultAvatarImgUrl from '@/assets/default-avatar.png';
import { useMentorSchedule } from '@/hooks/useMentorSchedule';
import useUserData from '@/hooks/user/user-data/useUserData';

import { ProfilePageSkeleton } from './skeleton';

const ProfilePageUI = dynamic(() => import('./ui'), {
  loading: () => <ProfilePageSkeleton />,
});

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
  const isLogging = Boolean(session?.user?.id);
  const loginUserId = session?.user?.id ? String(session.user.id) : '';

  const [openReservationDialog, setOpenReservationDialog] = useState(false);
  const [openMenteeReservationDialog, setOpenMenteeReservationDialog] =
    useState(false);

  const pageUserIdNumber = Number(pageUserId);
  const { userData, isLoading: userLoading } = useUserData(
    pageUserIdNumber,
    'zh_TW'
  );

  // Only attach a versioning param for the logged-in user's own profile; the
  // stable URL for other users lets the Next.js Image Optimizer hit its cache
  // across navigations.
  const avatarSrc = userData?.avatar
    ? loginUserId === pageUserId && session?.user?.avatarUpdatedAt
      ? `${userData.avatar}?v=${session.user.avatarUpdatedAt}`
      : userData.avatar
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
