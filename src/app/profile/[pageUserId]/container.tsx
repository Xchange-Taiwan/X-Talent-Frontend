'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';

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

  const schedule = useMentorSchedule({
    backend: { userId: pageUserId, year, month },
  });
  const { loaded, selectedDate, setSelectedDate, parsedDraft, allowedDates } =
    schedule;

  const [openReservationDialog, setOpenReservationDialog] = useState(false);
  const [openMenteeReservationDialog, setOpenMenteeReservationDialog] =
    useState(false);

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
    if (!openReservationDialog && !openMenteeReservationDialog) {
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

  // Only attach a versioning param for the logged-in user's own profile; the
  // stable URL for other users lets the Next.js Image Optimizer hit its cache
  // across navigations. While the DTO is still loading on the user's own
  // profile, fall back to the session avatar so the page does not flash blank.
  const isOwnProfile = loginUserId === pageUserId;
  const resolvedAvatar =
    userData?.avatar ?? (isOwnProfile ? session?.user?.avatar : undefined);
  // Remember the latest avatar version we saw for this profile. The S3 avatar
  // URL is a stable key (re-uploads overwrite in place), so the `?v=` query is
  // the only cache buster. If we drop it on logout, the bare URL hits a stale
  // browser/Image-Optimizer cache entry from before the upload.
  const lastAvatarVersionRef = useRef<number | undefined>(undefined);
  if (isOwnProfile && session?.user?.avatarUpdatedAt) {
    lastAvatarVersionRef.current = session.user.avatarUpdatedAt;
  }
  const avatarVersion = lastAvatarVersionRef.current;
  const avatarSrc = resolvedAvatar
    ? avatarVersion
      ? `${resolvedAvatar}?v=${avatarVersion}`
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
