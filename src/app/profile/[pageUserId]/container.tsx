'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { getSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { useMentorSchedule } from '@/hooks/useMentorSchedule';
import useUserData from '@/hooks/user/user-data/useUserData';

const ProfilePageUI = dynamic(() => import('./ui'));

interface Props {
  pageUserId: string;
}

export default function ProfilePageContainer({ pageUserId }: Props) {
  const router = useRouter();

  const now = new Date();
  const schedule = useMentorSchedule({
    mode: 'backend',
    backend: {
      userId: pageUserId,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    },
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
  const [avatarCacheBust] = useState(() => Date.now());
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

  if (loading || !loaded) return null;

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
      loginUserId={loginUserId}
      isLogging={isLogging}
      avatarCacheBust={avatarCacheBust}
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
