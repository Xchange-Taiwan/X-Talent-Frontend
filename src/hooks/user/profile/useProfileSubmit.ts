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
import { captureFlowFailure } from '@/lib/monitoring';
import { type ProfileDirtyFields } from '@/lib/profile/profileSaveAdapter';
import { saveProfile } from '@/lib/profile/saveProfile';
import { ProfileFormValues } from '@/schemas/profileSchema';

export type { ProfileDirtyFields };

interface Options {
  pageUserId: string;
  isMentorOnboarding: boolean;
  session: Session | null;
  updateSession: (data: unknown) => Promise<Session | null>;
  jobSectionError: boolean;
  educationSectionError: boolean;
  onScrollToError?: (fieldId: string) => void;
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
  jobSectionError,
  educationSectionError,
  onScrollToError,
  consumeAvatarUpload,
}: Options) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const onSubmit = async (
    values: ProfileFormValues,
    dirtyFields?: ProfileDirtyFields
  ) => {
    if (jobSectionError || educationSectionError) {
      onScrollToError?.(jobSectionError ? 'work_experiences' : 'educations');
      return;
    }

    try {
      setIsSaving(true);
      await saveProfile(values, {
        pageUserId,
        isMentorOnboarding,
        session,
        dirtyFields,
        consumeAvatarUpload,
        updateSession,
        navigate: router.push,
        revalidateProfilePath,
        clearUserDataCache,
        primeUserDataCache,
      });
    } catch (err) {
      captureFlowFailure({
        flow: 'profile_update',
        step: 'unexpected',
        message:
          err instanceof Error
            ? err.message
            : 'Unexpected profile update error',
      });
      console.error('Update Profile Error:', err);
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
