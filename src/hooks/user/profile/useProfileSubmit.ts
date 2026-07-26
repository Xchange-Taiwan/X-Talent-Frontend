'use client';
import { useRouter } from 'next/navigation';
import { Session } from 'next-auth';
import { useState } from 'react';

import { revalidateProfilePath } from '@/app/profile/[pageUserId]/actions';
import { useToast } from '@/components/ui/use-toast';
import {
  clearUserDataCache,
  primeUserDataCache,
} from '@/hooks/user/user-data/useUserData';
import { trackEvent } from '@/lib/analytics';
import { setAvatarOverride } from '@/lib/avatar/avatarOverrideStore';
import { captureFlowFailure } from '@/lib/monitoring';
import {
  firstSyncedFetch,
  pollUntilSynced,
} from '@/lib/profile/pollUntilSynced';
import {
  type ProfileDirtyFields,
  saveProfileWorkflow,
} from '@/lib/profile/saveProfileWorkflow';
import { ProfileFormValues } from '@/schemas/profileSchema';
import { updateAvatar } from '@/services/profile/updateAvatar';
import { updateProfile } from '@/services/profile/updateProfile';

export type { ProfileDirtyFields };

interface Options {
  pageUserId: string;
  isMentorOnboarding: boolean;
  session: Session | null;
  updateSession: (data: unknown) => Promise<Session | null>;
  // Optional: lets the page hand back an already-in-flight S3 upload (kicked
  // off when the user picked the file) so submit doesn't pay the round trip.
  // Falls back to a direct upload when omitted, preserving legacy callers.
  consumeAvatarUpload?: (file: File | undefined) => Promise<string | undefined>;
}

export function useProfileSubmit({
  pageUserId,
  isMentorOnboarding,
  session,
  updateSession,
  consumeAvatarUpload,
}: Options) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const onSubmit = async (
    values: ProfileFormValues,
    dirtyFields?: ProfileDirtyFields
  ) => {
    try {
      setIsSaving(true);

      const result = await saveProfileWorkflow(
        values,
        {
          pageUserId,
          isMentorOnboarding,
          session,
          dirtyFields,
        },
        {
          updateSession,
          consumeAvatarUpload,
          updateProfile,
          updateAvatar,
          revalidateProfilePath,
          clearUserDataCache,
          primeUserDataCache,
          setAvatarOverride,
          firstSyncedFetch,
          pollUntilSynced,
          captureFlowFailure,
        }
      );

      if (!result.ok) {
        // saveProfileWorkflow has already called captureFlowFailure with the specific step.
        // We log locally and present the failure toast directly to avoid double Sentry logging.
        console.error('saveProfileWorkflow failed:', result.step, result.error);
        toast({
          variant: 'destructive',
          description: '儲存失敗，請稍後再試',
          duration: 5000,
        });
        setIsSaving(false);
        return;
      }

      trackEvent({ name: 'profile_update_submitted', feature: 'profile' });
      if (isMentorOnboarding) {
        router.push('/profile/card');
      } else {
        router.push(`/profile/${pageUserId}`);
      }
    } catch (err) {
      // Catch genuine unexpected exceptions in the process (e.g. payload mapping) and log to Sentry
      captureFlowFailure({
        flow: 'profile_update',
        step: 'unexpected',
        message:
          err instanceof Error
            ? err.message
            : 'Unexpected profile update error',
      });
      console.error('Update Profile Unexpected Error:', err);
      toast({
        variant: 'destructive',
        description: '儲存失敗，請稍後再試',
        duration: 5000,
      });
      setIsSaving(false);
    }
  };

  return { onSubmit, isSaving };
}
