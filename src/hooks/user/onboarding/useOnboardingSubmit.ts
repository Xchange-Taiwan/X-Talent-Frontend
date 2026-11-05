'use client';

import { useSession } from 'next-auth/react';

import { buildOnboardingDtoStub } from '@/hooks/user/onboarding/buildOnboardingDtoStub';
import {
  clearUserDataCache,
  primeUserDataCache,
} from '@/hooks/user/user-data/useUserData';
import {
  applyIdentityPatch,
  deriveOptimisticIdentityPatch,
} from '@/lib/identity/identityProjection';
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

      const sessionUserId = session?.user?.id ? Number(session.user.id) : NaN;
      const stub = Number.isFinite(sessionUserId)
        ? buildOnboardingDtoStub({
            userId: sessionUserId,
            formData: validatedData,
            industryCatalog: industries,
          })
        : null;

      const patch = deriveOptimisticIdentityPatch({
        name: validatedData.name ?? session?.user?.name ?? '',
        avatarUrl: validatedData.avatar,
        isMentorOnboarding: Boolean(stub?.is_mentor),
        fallbackAvatar: session?.user?.avatar,
        fallbackIsMentor: session?.user?.isMentor,
        fallbackOnBoarding: true,
      });

      await applyIdentityPatch(patch, {
        primeProfileDto: () => {
          if (Number.isFinite(sessionUserId) && stub) {
            primeUserDataCache(sessionUserId, 'zh_TW', stub);
          } else if (session?.user?.id) {
            clearUserDataCache(Number(session.user.id), 'zh_TW');
          }
        },
        updateSession: (p) =>
          updateSession({
            user: {
              ...session?.user,
              name: p.name,
              avatar: p.avatar ?? session?.user?.avatar,
              isMentor: p.isMentor,
              onBoarding: p.onBoarding,
              ...(hasAvatarFile ? { avatarUpdatedAt: Date.now() } : {}),
            },
          }),
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
