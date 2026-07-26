'use client';
import { useRouter } from 'next/navigation';
import { Session } from 'next-auth';
import { useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { trackEvent } from '@/lib/analytics';
import { captureFlowFailure } from '@/lib/monitoring';
import {
  type ProfileDirtyFields,
  saveProfileWorkflow,
} from '@/lib/profile/saveProfileWorkflow';
import { ProfileFormValues } from '@/schemas/profileSchema';

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
        }
      );

      if (!result.ok) {
        throw result.error;
      }

      trackEvent({ name: 'profile_update_submitted', feature: 'profile' });
      if (isMentorOnboarding) {
        router.push('/profile/card');
      } else {
        router.push(`/profile/${pageUserId}`);
      }
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
