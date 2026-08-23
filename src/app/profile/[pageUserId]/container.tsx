'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import DefaultAvatarImgUrl from '@/assets/default-avatar.png';
import MentorScheduleDialog from '@/components/profile/reservation/MentorScheduleDialog';
import { Button } from '@/components/ui/button';
import { useMentorSchedule } from '@/hooks/useMentorSchedule';
import { useIdentity } from '@/hooks/user/auth/useIdentity';
import { useBookingConfirmation } from '@/hooks/user/reservation/useBookingConfirmation';
import { useReservationDateClamp } from '@/hooks/user/reservation/useReservationDateClamp';
import { primeTagCatalogCacheIfEmpty } from '@/hooks/user/tags/useTagCatalog';
import useUserData from '@/hooks/user/user-data/useUserData';
import { BookingSlot } from '@/lib/profile/bookingAvailability';
import { getMentorOnboardingUrl } from '@/lib/routes';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';
import type { MentorProfileVO } from '@/types/user';

import { ProfilePageSkeleton } from './skeleton';

const ProfilePageUI = dynamic(() => import('./ui'), {
  loading: () => <ProfilePageSkeleton />,
});

interface Props {
  pageUserId: string;
  initialDto: MentorProfileVO;
  initialCatalogs: TagCatalogsByBucket;
}

export default function ProfilePageContainer({
  pageUserId,
  initialDto: _initialDto,
  initialCatalogs,
}: Props) {
  const router = useRouter();
  const pageUserIdNumber = Number(pageUserId);

  // Same idea for the tag catalog: SSR already fetched the localized labels,
  // so seed the client cache here so useTagCatalog resolves subject_group
  // codes to Chinese labels on first paint instead of flashing raw codes.
  primeTagCatalogCacheIfEmpty('zh_TW', initialCatalogs);

  // The page is now ISR-cached (no SSR session read), so identity is
  // resolved entirely client-side via useIdentity - the same single source
  // of truth Header/useProfileAuth use. Deliberately read `identity.
  // sessionSettled`/`hasFullUser`/`userId` here, not the faster `authKnown`/
  // `isLoggedIn`/hint-derived `userId` fields: those can go true/populated
  // from the middleware-written session-hint cookie alone (an unsigned,
  // client-writable, UI-only hint - see sessionHint.ts) before the real
  // `useSession()` round trip settles.
  //
  // Two distinct gates are needed, not one:
  // - `isIdentityResolved` (`sessionSettled`) answers "has the real session
  //   check finished, for ANY viewer" - true for a confirmed guest just as
  //   much as a confirmed member (unlike `hasFullUser`, which a guest can
  //   never satisfy). This is what BookingForm's loading skeleton must gate
  //   on, or guests would be stuck loading forever.
  // - `loginUserId` (and everything derived from it: isOwnProfile,
  //   canShowOwnerControls, useBookingConfirmation's menteeId) requires the
  //   stronger `hasFullUser`, since it either renders owner-only UI or
  //   feeds a real mutation - unlike the header's optimistic hint-based
  //   rendering, nothing here may act on an unauthoritative value.
  //
  // Per CLAUDE.md's "Role-based UI" rule: never render role-specific UI
  // before the role is resolved.
  const identity = useIdentity();
  const isIdentityResolved = identity.sessionSettled;
  const loginUserId = identity.hasFullUser ? (identity.userId ?? '') : '';

  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);

  // loginUserId is '' unless identity.hasFullUser, so isOwnProfile can only
  // be true for a real, verified session - it already carries that
  // guarantee, no separate resolution check needed here. Computed before
  // useMentorSchedule so it can gate includeBookedDates below; the whole
  // schedule region only renders once userData.is_mentor is confirmed true
  // (see ui.tsx's showScheduleRegion), so ownership alone is enough here to
  // distinguish "the mentor managing their own calendar" from "a mentee/
  // visitor browsing it" - no need to also wait on userData.is_mentor.
  const isOwnProfile = loginUserId === pageUserId;

  const schedule = useMentorSchedule({
    backend: { userId: pageUserId, year, month },
    loginUserId,
    includeBookedDates: isOwnProfile,
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

  const {
    userData,
    isLoading: userLoading,
    error,
    refetch,
  } = useUserData(pageUserIdNumber, 'zh_TW');

  // Single source of truth for "should owner-only controls (edit button,
  // become-mentor button, schedule-management dialog) render" so ui.tsx
  // doesn't need to re-derive this comparison at each of its three call
  // sites.
  const canShowOwnerControls = isOwnProfile;
  const avatarSrc = userData?.avatar || DefaultAvatarImgUrl;

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

  if (error === 'FETCH_FAILED') {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <p className="font-medium text-text-tertiary">
          載入個人檔案資料時發生連線錯誤
        </p>
        <Button onClick={refetch} variant="default" size="default">
          重新載入
        </Button>
      </div>
    );
  }

  if (error === 'USER_NOT_FOUND' || (!userLoading && !userData)) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-text-tertiary">
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
    if (userData.is_mentor && isOwnProfile) {
      setOpenReservationDialog(true);
      return;
    }
  };

  return (
    <ProfilePageUI
      userData={userData}
      userLoading={userLoading}
      schedule={schedule}
      scheduleLoaded={loaded}
      loginUserId={loginUserId}
      isIdentityResolved={isIdentityResolved}
      canShowOwnerControls={canShowOwnerControls}
      avatarSrc={avatarSrc}
      allowedDates={allowedDates}
      onReservation={reservationHandler}
      onScheduleMonthChange={handleScheduleMonthChange}
      selectedSlot={selectedSlot}
      setSelectedSlot={setSelectedSlot}
      isSubmitting={isSubmitting}
      onConfirmReservation={handleConfirmReservation}
      onEditProfile={() => router.push(`/profile/${pageUserId}/edit`)}
      onBecomeMentor={() => router.push(getMentorOnboardingUrl(pageUserId))}
      editorDialog={
        userData && canShowOwnerControls ? (
          <MentorScheduleDialog
            open={openReservationDialog}
            onOpenChange={setOpenReservationDialog}
            schedule={schedule}
            onMonthChange={handleScheduleMonthChange}
          />
        ) : undefined
      }
    />
  );
}
