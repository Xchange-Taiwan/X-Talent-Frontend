'use client';

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useLayoutEffect, useRef, useState } from 'react';

import { AvatarSection } from '@/components/profile/edit/AvatarSection';
import { CategoryMultiSelectField } from '@/components/profile/edit/CategoryMultiSelectField';
import { EditPageHeader } from '@/components/profile/edit/EditPageHeader';
import {
  SelectField,
  TextareaField,
  TextField,
} from '@/components/profile/edit/Fields';
import { Section } from '@/components/profile/edit/Section';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { PageLoading } from '@/components/ui/loading-spinner';
import { totalWorkSpanOptions } from '@/constant/seniority';
import { useProfileAuth } from '@/hooks/user/auth/useProfileAuth';
import useLocations from '@/hooks/user/country/useLocations';
import { useBackgroundAvatarUpload } from '@/hooks/user/profile/useBackgroundAvatarUpload';
import { useEditProfileData } from '@/hooks/user/profile/useEditProfileData';
import { useEditProfileForm } from '@/hooks/user/profile/useEditProfileForm';
import { useFormErrorScroll } from '@/hooks/user/profile/useFormErrorScroll';
import { useProfileSubmit } from '@/hooks/user/profile/useProfileSubmit';
import useTagCatalog from '@/hooks/user/tags/useTagCatalog';
import { useUnsavedChangesPrompt } from '@/hooks/useUnsavedChangesPrompt';
import { tagGroupsToCategories } from '@/lib/profile/categoryGrouping';
import { mapVoToFormValues } from '@/lib/profile/profileSaveAdapter';
import { MENTOR_ONBOARDING_KEY } from '@/lib/routes';
import { ProfileFormValues } from '@/schemas/profileSchema';
import type { TagCatalogsByBucket } from '@/services/profile/tagCatalog';

const JobExperienceSection = dynamic(
  async () => {
    const m = await import('@/components/profile/edit/JobExperienceSection');
    return { default: m.JobExperienceSection };
  },
  {
    ssr: false,
    loading: () => (
      <div className="h-40 w-full animate-pulse rounded bg-muted" />
    ),
  }
);

const EducationSection = dynamic(
  async () => {
    const m =
      await import('@/components/profile/edit/educationSection/educationSection');
    return { default: m.EducationSection };
  },
  {
    ssr: false,
    loading: () => (
      <div className="h-40 w-full animate-pulse rounded bg-muted" />
    ),
  }
);

const LinksSection = dynamic(
  async () => {
    const m = await import('@/components/profile/edit/LinkSection');
    return { default: m.LinksSection };
  },
  {
    ssr: false,
    loading: () => (
      <div className="h-32 w-full animate-pulse rounded bg-muted" />
    ),
  }
);

interface Props {
  pageUserId: string;
  initialTagCatalog: TagCatalogsByBucket;
}

export default function EditProfileContainer({
  pageUserId,
  initialTagCatalog,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMentorOnboarding =
    searchParams?.get(MENTOR_ONBOARDING_KEY) === 'true' ||
    searchParams?.get('onboarding') === 'true';

  const { data: session, update: updateSession } = useSession();

  const { isAuthorized } = useProfileAuth(pageUserId);

  const [jobSectionError, setJobSectionError] = useState(false);
  const [educationSectionError, setEducationSectionError] = useState(false);

  const { locations } = useLocations('zh_TW');
  const tagCatalog = useTagCatalog('zh_TW', initialTagCatalog);
  const industries = tagCatalog.industry;

  const [isContainerLoading, setIsContainerLoading] = useState(true);
  const [prevPageUserId, setPrevPageUserId] = useState(pageUserId);

  // Synchronously reset container loading state back to true when route switches to a different pageUserId.
  // This satisfies React's standard prop-sync guidelines and prevents old user data leaks during swaps.
  if (pageUserId !== prevPageUserId) {
    setPrevPageUserId(pageUserId);
    setIsContainerLoading(true);
  }

  const { userDto, isMentor, isError } = useEditProfileData({
    userId: Number(pageUserId),
    isAuthorized,
  });

  // Effective mentor-mode flag: true once the user is already a mentor OR is
  // going through the "become a mentor" onboarding flow. Drives both the Zod
  // schema's required fields (via useEditProfileForm) and which mentor-only
  // sections render below — the two must stay in sync or required fields can
  // end up invisible while still blocking submit.
  const isMentorRole = isMentor || isMentorOnboarding;

  const { form } = useEditProfileForm(isMentorRole);

  const { formRef, onError, scrollToField } =
    useFormErrorScroll<ProfileFormValues>();

  const lastResetUserIdRef = useRef<number | null>(null);

  // Reset form when user profile data successfully loads or updates
  useLayoutEffect(() => {
    if (!isAuthorized || !userDto) return;
    if (lastResetUserIdRef.current === userDto.user_id && !isContainerLoading)
      return; // Tolerates SWR focus revalidation successes silently without resetting active inputs.

    const formValues = mapVoToFormValues(userDto, isMentorOnboarding);
    form.reset(formValues);
    lastResetUserIdRef.current = userDto.user_id;
    setIsContainerLoading(false);
  }, [userDto, isAuthorized, isMentorOnboarding, form, isContainerLoading]);

  // Kicks off the S3 upload the moment the user crops a new avatar so
  // submit doesn't pay the round trip — see useBackgroundAvatarUpload.
  const avatarUpload = useBackgroundAvatarUpload();

  const haveTopicCategories = tagGroupsToCategories(tagCatalog.have_topic);
  const haveSkillCategories = tagGroupsToCategories(tagCatalog.have_skill);
  const wantPositionCategories = tagGroupsToCategories(
    tagCatalog.want_position
  );
  const wantSkillCategories = tagGroupsToCategories(tagCatalog.want_skill);
  const wantTopicCategories = tagGroupsToCategories(tagCatalog.want_topic);

  // NOTE: document.getElementById/formRef querySelector is used to query dynamic error-bearing section container boundaries.
  // This approach bypasses standard React refs to avoid inflating complexity with dozens of sub-component
  // ref callback dictionaries, while cleanly retaining declarative styling structures.
  const { onSubmit, isSaving } = useProfileSubmit({
    pageUserId,
    isMentorOnboarding,
    session,
    updateSession,
    consumeAvatarUpload: avatarUpload.consume,
  });

  // Suppress the prompt while a submit is in flight so onSubmit's own
  // router.push isn't blocked by us. isSaving stays true through the
  // navigation (only reset on failure), so the page unmounts cleanly.
  const unsaved = useUnsavedChangesPrompt(form.formState.isDirty && !isSaving);

  if (!isAuthorized) return null;

  if (isError) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
        <p className="text-lg font-medium text-status-error-default">
          載入失敗，請稍後再試。
        </p>
        <Button onClick={() => window.location.reload()} variant="outline">
          重新整理
        </Button>
      </div>
    );
  }

  if (isContainerLoading) return <PageLoading />;

  const handleGoToPrev = () => {
    unsaved.guardNavigate(() => router.push(`/profile/${pageUserId}`));
  };

  return (
    <div className="mx-auto w-11/12 max-w-[1064px] pb-20">
      <EditPageHeader
        isSaving={isSaving}
        onBack={handleGoToPrev}
        isMentorOnboarding={isMentorOnboarding}
      />

      <Form {...form}>
        <form
          ref={formRef}
          id="edit-profile-form"
          onSubmit={form.handleSubmit((values) => {
            if (jobSectionError || educationSectionError) {
              scrollToField(
                jobSectionError ? 'work_experiences' : 'educations'
              );
              return;
            }
            return onSubmit(values, form.formState.dirtyFields);
          }, onError)}
          className="space-y-10"
        >
          <AvatarSection
            id="avatarFile"
            control={form.control}
            name="avatarFile"
            isMentor={isMentorRole}
            onFileChange={(file) =>
              avatarUpload.kickOff(file, form.getValues('avatar'))
            }
          />

          <Section id="name" title="姓名" required>
            <TextField form={form} name="name" placeholder="請填入您的姓名" />
          </Section>

          <Section id="about" title="關於我" required={isMentorRole}>
            <TextareaField form={form} name="about" rows={10} />
          </Section>

          {isMentorRole && (
            <Section id="have_topic" title="我能提供的服務" required>
              <CategoryMultiSelectField
                form={form}
                name="have_topic"
                categories={haveTopicCategories}
                maxSelected={10}
                searchPlaceholder="搜尋服務"
              />
            </Section>
          )}

          {isMentorRole && (
            <Section id="have_skill" title="專業能力" required>
              <CategoryMultiSelectField
                form={form}
                name="have_skill"
                categories={haveSkillCategories}
                maxSelected={10}
                searchPlaceholder="搜尋專業能力"
              />
            </Section>
          )}

          <Section id="location" title="地區" required>
            <SelectField
              form={form}
              name="location"
              placeholder="請選擇地區"
              options={locations.map((loc) => ({
                value: loc.value,
                label: loc.text,
              }))}
            />
          </Section>

          <Section id="years_of_experience" title="經驗" required>
            <SelectField
              form={form}
              name="years_of_experience"
              placeholder="請填入您的經驗"
              options={totalWorkSpanOptions}
            />
          </Section>

          <Section id="industry" title="產業" required={isMentorRole}>
            <SelectField
              form={form}
              name="industry"
              placeholder="請選擇產業"
              options={industries.map((i) => ({
                value: i.subject_group,
                label: i.subject,
              }))}
            />
          </Section>

          <Section id="want_position" title="有興趣多了解的職位" required>
            <CategoryMultiSelectField
              form={form}
              name="want_position"
              categories={wantPositionCategories}
              maxSelected={10}
              searchPlaceholder="搜尋職位"
            />
          </Section>

          <Section id="want_skill" title="想多了解、加強的技能" required>
            <CategoryMultiSelectField
              form={form}
              name="want_skill"
              categories={wantSkillCategories}
              maxSelected={10}
              searchPlaceholder="搜尋技能"
            />
          </Section>

          <Section id="want_topic" title="想多了解的主題" required>
            <CategoryMultiSelectField
              form={form}
              name="want_topic"
              categories={wantTopicCategories}
              maxSelected={10}
              searchPlaceholder="搜尋主題"
            />
          </Section>

          <div id="work_experiences">
            <JobExperienceSection
              industries={industries}
              locations={locations}
              form={form}
              isMentor={isMentorRole}
              onValidationChange={setJobSectionError}
            />
          </div>

          <div id="educations">
            <EducationSection
              form={form}
              isMentor={isMentorRole}
              onValidationChange={setEducationSectionError}
            />
          </div>

          <LinksSection form={form} />
        </form>
      </Form>

      <Dialog
        open={unsaved.isPromptOpen}
        onOpenChange={(open) => {
          if (!open) unsaved.cancelLeave();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>尚未儲存的變更</DialogTitle>
            <DialogDescription>
              你的更動會直接遺失，確定要離開嗎？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={unsaved.cancelLeave}>
              繼續編輯
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                // Restore the pre-edit avatar in S3 before navigating. Fire
                // and forget — re-uploading the snapshot can take a couple of
                // seconds, and the user shouldn't have to wait while leaving
                // a page they explicitly cancelled. The hook drops the job
                // ref synchronously so unmount cleanup can't double-abort.
                void avatarUpload.rollback();
                unsaved.confirmLeave();
              }}
            >
              離開頁面
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
