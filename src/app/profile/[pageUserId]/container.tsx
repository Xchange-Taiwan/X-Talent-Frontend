'use client';

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import DefaultAvatarImgUrl from '@/assets/default-avatar.png';
import MentorScheduleDialog from '@/components/profile/reservation/MentorScheduleDialog';
import { Button } from '@/components/ui/button';
import { useConsumePendingFavorite } from '@/hooks/favorites';
import { useMentorSchedule } from '@/hooks/useMentorSchedule';
import { useResolvedIdentity } from '@/hooks/user/auth/useResolvedIdentity';
import { useMentorFeedback } from '@/hooks/user/feedback/useMentorFeedback';
import useUserData from '@/hooks/user/user-data/useUserData';
import { useTrackMentorNoAvailableSlots } from '@/hooks/useTrackMentorNoAvailableSlots';
import { isFeedbackEnabled } from '@/lib/featureFlags';
import type { BookingCalendarReader } from '@/lib/profile/bookingAvailability';
import {
  normalizePositiveUserId,
  resolveProfileUserId,
} from '@/lib/profile/userId';
import { OPEN_SCHEDULE_DIALOG_KEY } from '@/lib/routes';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';
import type { MentorProfileVO } from '@/types/user';

import { ProfilePageSkeleton } from './skeleton';

const ProfilePageUI = dynamic(() => import('./ui'), {
  loading: () => <ProfilePageSkeleton />,
});

function ScheduleAutoOpenWatcher({
  canAutoOpen,
  onAutoOpen,
}: {
  canAutoOpen: boolean;
  onAutoOpen: () => void;
}): null {
  const searchParams = useSearchParams();
  const shouldAutoOpen = searchParams?.get(OPEN_SCHEDULE_DIALOG_KEY) === 'true';
  const hasAutoOpenedRef = useRef(false);

  useEffect(() => {
    if (!shouldAutoOpen || !canAutoOpen || hasAutoOpenedRef.current) {
      return;
    }
    hasAutoOpenedRef.current = true;
    onAutoOpen();
  }, [shouldAutoOpen, canAutoOpen, onAutoOpen]);

  return null;
}

interface Props {
  pageUserId: string;
  initialDto: MentorProfileVO | null;
  initialCatalogs: TagCatalogsByBucket | null;
}

export default function ProfilePageContainer({
  pageUserId,
  initialDto,
  initialCatalogs,
}: Props) {
  const router = useRouter();
  const canonicalUserId = normalizePositiveUserId(pageUserId);
  const resolvedProfileUserId: number | string =
    resolveProfileUserId(pageUserId) ?? pageUserId;

  const identity = useResolvedIdentity();
  const isIdentityResolved =
    identity.state === 'confirmed-guest' ||
    identity.state === 'confirmed-member';
  const loginUserId =
    identity.state === 'confirmed-member' ? identity.userId : '';

  const isOwnProfile =
    Boolean(canonicalUserId) && loginUserId === canonicalUserId;

  const schedule = useMentorSchedule({
    backend: { userId: canonicalUserId ?? pageUserId },
    loginUserId,
    includeBookedDates: isOwnProfile,
  });
  const { loaded, reader, editor } = schedule;

  const [openReservationDialog, setOpenReservationDialog] = useState(false);

  const isOwnMentorStaleInitialDto = Boolean(
    isOwnProfile &&
    identity.state === 'confirmed-member' &&
    identity.isMentor &&
    initialDto &&
    !initialDto.is_mentor
  );
  const effectiveInitialDto = isOwnMentorStaleInitialDto ? null : initialDto;

  const {
    userData,
    isLoading: userLoading,
    error,
    refetch,
  } = useUserData(
    resolvedProfileUserId,
    'zh_TW',
    effectiveInitialDto,
    initialCatalogs ?? undefined
  );

  const refetchedStaleMentorRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      isOwnProfile &&
      identity.state === 'confirmed-member' &&
      identity.isMentor &&
      userData &&
      !userData.is_mentor &&
      !userLoading &&
      refetchedStaleMentorRef.current !== pageUserId
    ) {
      refetchedStaleMentorRef.current = pageUserId;
      refetch?.();
    }
  }, [identity, isOwnProfile, pageUserId, refetch, userData, userLoading]);

  useConsumePendingFavorite({
    pageUserId: canonicalUserId ?? pageUserId,
    loginUserId,
    userData,
    userLoading,
  });

  useTrackMentorNoAvailableSlots({
    isIdentityResolved,
    isOwnProfile,
    userLoading,
    isMentor: Boolean(userData?.is_mentor),
    mentorId: resolvedProfileUserId,
    loaded,
    monthLoaded: reader.slotsSnapshot?.monthLoaded ?? loaded,
    isFetching: Boolean(reader.isFetching),
    hasError: Boolean(reader.hasError),
    year: reader.year,
    month: reader.month,
    allowedDates: reader.allowedDates,
  });

  const feedback = useMentorFeedback({
    mentorId: resolvedProfileUserId,
    enabled: Boolean(
      isFeedbackEnabled() && !userLoading && userData?.is_mentor
    ),
  });

  // Single source of truth for "should owner-only controls (edit button,
  // become-mentor button, schedule-management dialog) render" so ui.tsx
  // doesn't need to re-derive this comparison at each of its three call
  // sites.
  const canShowOwnerControls = isOwnProfile;
  const avatarSrc = userData?.avatar || DefaultAvatarImgUrl;

  const handleScheduleMonthChange = useCallback(
    (date: Date, options?: { preserveSelectedDate?: boolean }) => {
      reader.onMonthChange?.(
        date,
        options ?? { preserveSelectedDate: openReservationDialog }
      );
    },
    [reader, openReservationDialog]
  );

  const scheduleReader = useMemo<BookingCalendarReader>(
    () => ({
      ...reader,
      onMonthChange: handleScheduleMonthChange,
    }),
    [reader, handleScheduleMonthChange]
  );

  const canAutoOpenSchedule = Boolean(
    !userLoading && userData?.is_mentor && canShowOwnerControls && editor
  );

  const handleAutoOpenSchedule = useCallback(() => {
    reader.clampSelectedDateToToday?.();
    setOpenReservationDialog(true);
    router.replace?.(`/profile/${pageUserId}`, { scroll: false });
  }, [reader, router, pageUserId]);

  if (error === 'FETCH_FAILED') {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-text-tertiary font-medium">
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
      <div className="text-text-tertiary flex h-[50vh] items-center justify-center">
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
    reader.clampSelectedDateToToday?.();
    if (userData.is_mentor && isOwnProfile) {
      setOpenReservationDialog(true);
      return;
    }
  };

  return (
    <ProfilePageUI
      userData={userData}
      userLoading={userLoading}
      schedule={scheduleReader}
      scheduleLoaded={loaded}
      feedback={feedback}
      loginUserId={loginUserId}
      isIdentityResolved={isIdentityResolved}
      canShowOwnerControls={canShowOwnerControls}
      avatarSrc={avatarSrc}
      onReservation={reservationHandler}
      onEditProfile={() => router.push(`/profile/${pageUserId}/edit`)}
      editorDialog={
        // canShowOwnerControls and the hook's own editor gating are both
        // driven by the same loginUserId === pageUserId check, so editor is
        // guaranteed non-null here.
        userData && canShowOwnerControls && editor ? (
          <>
            <Suspense fallback={null}>
              <ScheduleAutoOpenWatcher
                canAutoOpen={canAutoOpenSchedule}
                onAutoOpen={handleAutoOpenSchedule}
              />
            </Suspense>
            <MentorScheduleDialog
              open={openReservationDialog}
              onOpenChange={setOpenReservationDialog}
              reader={scheduleReader}
              schedule={editor}
              onMonthChange={handleScheduleMonthChange}
            />
          </>
        ) : undefined
      }
    />
  );
}
