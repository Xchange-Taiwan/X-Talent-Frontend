'use client';

import { useSession } from 'next-auth/react';

import { buildOnboardingDtoStub } from '@/hooks/user/onboarding/buildOnboardingDtoStub';
import {
  clearUserDataCache,
  primeUserDataCache,
} from '@/hooks/user/user-data/useUserData';
import { captureFlowFailure } from '@/lib/monitoring';
import { formSchema } from '@/schemas/onboarding';
import { updateProfile } from '@/services/profile/updateProfile';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';

interface Options {
  industries: TagCatalogsByBucket['industry'];
}

export function useOnboardingSubmit({ industries }: Options) {
  const { data: session, update: updateSession } = useSession();

  const submitProfile = async (allData: unknown, hasAvatarFile: boolean) => {
    try {
      const validatedData = formSchema.parse(allData);
      await updateProfile(session?.user?.id, validatedData);

      // Prime the user-profile cache from the form values + tag pools
      // we already have in memory, so /profile/card mounts from
      // cache instead of refetching the same DTO. Falls back to
      // clearUserDataCache if the userId is not a finite number.
      const sessionUserId = session?.user?.id ? Number(session.user.id) : NaN;
      if (Number.isFinite(sessionUserId)) {
        const stub = buildOnboardingDtoStub({
          userId: sessionUserId,
          formData: validatedData,
          industryCatalog: industries,
        });
        primeUserDataCache(sessionUserId, 'zh_TW', stub);
      } else if (session?.user?.id) {
        clearUserDataCache(Number(session.user.id), 'zh_TW');
      }

      // Optimistic session update — server-side `onboarding` is derived from
      // the tags we just submitted, so values are predictable without a fetch.
      await updateSession({
        user: {
          ...session?.user,
          name: validatedData.name ?? session?.user?.name,
          avatar: validatedData.avatar ?? session?.user?.avatar,
          onBoarding: true,
          ...(hasAvatarFile ? { avatarUpdatedAt: Date.now() } : {}),
        },
      });
    } catch (err) {
      captureFlowFailure({
        flow: 'onboarding_submit',
        step: 'submit_profile',
        message:
          err instanceof Error
            ? err.message
            : 'Onboarding profile submit failed',
      });
      throw err;
    }
  };

  return { submitProfile };
}
