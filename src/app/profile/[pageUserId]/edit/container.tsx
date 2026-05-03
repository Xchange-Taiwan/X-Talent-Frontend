'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { FieldErrors, useForm } from 'react-hook-form';

import { totalWorkSpanOptions } from '@/components/onboarding/steps/constant';
import { AvatarSection } from '@/components/profile/edit/AvatarSection';
import { CategoryMultiSelectField } from '@/components/profile/edit/CategoryMultiSelectField';
import { EditPageHeader } from '@/components/profile/edit/EditPageHeader';
import {
  SelectField,
  TextareaField,
  TextField,
} from '@/components/profile/edit/Fields';
import {
  createProfileFormSchema,
  defaultValues,
  ProfileFormValues,
} from '@/components/profile/edit/profileSchema';
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
import { useProfileAuth } from '@/hooks/user/auth/useProfileAuth';
import useLocations from '@/hooks/user/country/useLocations';
import useIndustries from '@/hooks/user/industry/useIndustries';
import { useBackgroundAvatarUpload } from '@/hooks/user/profile/useBackgroundAvatarUpload';
import { useEditProfileData } from '@/hooks/user/profile/useEditProfileData';
import { useProfileSubmit } from '@/hooks/user/profile/useProfileSubmit';
import useTagCatalog from '@/hooks/user/tags/useTagCatalog';
import { useUnsavedChangesPrompt } from '@/hooks/useUnsavedChangesPrompt';
import {
  flattenAsSingleCategory,
  tagGroupsToCategories,
} from '@/lib/profile/categoryGrouping';
import type { ProfessionVO } from '@/services/profile/industries';
import type { TagCatalogsByBucket } from '@/services/profile/tagCatalog';
import { prefetchPresignedUrl } from '@/services/profile/updateAvatar';

const JobExperienceSection = dynamic(async () => {
  const m = await import('@/components/profile/edit/JobExperienceSection');
  return { default: m.JobExperienceSection };
});

const EducationSection = dynamic(async () => {
  const m =
    await import('@/components/profile/edit/educationSection/educationSection');
  return { default: m.EducationSection };
});

const LinksSection = dynamic(async () => {
  const m = await import('@/components/profile/edit/LinkSection');
  return { default: m.LinksSection };
});

interface Props {
  pageUserId: string;
  initialIndustries: ProfessionVO[];
  initialTagCatalog: TagCatalogsByBucket;
}

export default function EditProfileContainer({
  pageUserId,
  initialIndustries,
  initialTagCatalog,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMentorOnboarding = searchParams?.get('onboarding') === 'true';

  const { data: session, update: updateSession } = useSession();

  const { isAuthorized } = useProfileAuth(pageUserId);

  const [isMentor, setIsMentor] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [jobSectionError, setJobSectionError] = useState(false);
  const [educationSectionError, setEducationSectionError] = useState(false);

  const { locations } = useLocations('zh_TW');
  const { industries } = useIndustries('zh_TW', initialIndustries);
  const tagCatalog = useTagCatalog('zh_TW', initialTagCatalog);

  const isMentorRef = useRef(isMentor);
  isMentorRef.current = isMentor;

  const form = useForm<ProfileFormValues>({
    resolver: (...args) =>
      zodResolver(createProfileFormSchema(isMentorRef.current))(...args),
    defaultValues,
  });

  useEditProfileData({
    userId: Number(pageUserId),
    form,
    isAuthorized,
    isMentorOnboarding,
    setIsMentor,
    setIsPageLoading,
  });

  // Warm up the avatar presigned URL once authorized. Saves a serial round
  // trip from the submit waterfall when the user uploads a new avatar.
  useEffect(() => {
    if (!isAuthorized) return;
    const userId = Number(pageUserId);
    if (!Number.isFinite(userId)) return;
    prefetchPresignedUrl(userId);
  }, [isAuthorized, pageUserId]);

  // Kicks off the S3 upload the moment the user crops a new avatar so
  // submit doesn't pay the round trip — see useBackgroundAvatarUpload.
  const avatarUpload = useBackgroundAvatarUpload();

  const industryCategories = flattenAsSingleCategory(industries);
  const haveTopicCategories = tagGroupsToCategories(tagCatalog.have_topic);
  const haveSkillCategories = tagGroupsToCategories(tagCatalog.have_skill);
  const wantPositionCategories = tagGroupsToCategories(
    tagCatalog.want_position
  );
  const wantSkillCategories = tagGroupsToCategories(tagCatalog.want_skill);
  const wantTopicCategories = tagGroupsToCategories(tagCatalog.want_topic);

  const scrollToField = (fieldId: string) => {
    document
      .getElementById(fieldId)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const FIELD_SCROLL_ORDER: (keyof ProfileFormValues)[] = [
    'name',
    'about',
    'have_topic',
    'have_skill',
    'location',
    'years_of_experience',
    'industry',
    'want_position',
    'want_skill',
    'want_topic',
    'work_experiences',
    'educations',
  ];

  const onError = (errors: FieldErrors<ProfileFormValues>) => {
    const firstKey = FIELD_SCROLL_ORDER.find((key) => key in errors);
    if (firstKey) scrollToField(firstKey);
  };

  const { onSubmit, isSaving } = useProfileSubmit({
    pageUserId,
    isMentorOnboarding,
    session,
    updateSession,
    jobSectionError,
    educationSectionError,
    onScrollToError: scrollToField,
    consumeAvatarUpload: avatarUpload.consume,
  });

  // Suppress the prompt while a submit is in flight so onSubmit's own
  // router.push isn't blocked by us. isSaving stays true through the
  // navigation (only reset on failure), so the page unmounts cleanly.
  const unsaved = useUnsavedChangesPrompt(form.formState.isDirty && !isSaving);

  if (!isAuthorized) return null;
  if (isPageLoading) return <PageLoading />;

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
          id="edit-profile-form"
          onSubmit={form.handleSubmit(
            (values) => onSubmit(values, form.formState.dirtyFields),
            onError
          )}
          className="space-y-10"
        >
          <AvatarSection
            control={form.control}
            name="avatarFile"
            onFileChange={(file) =>
              avatarUpload.kickOff(file, form.getValues('avatar'))
            }
          />

          <Section
            id="name"
            title={
              <>
                <span className="text-status-200">* </span>姓名
              </>
            }
          >
            <TextField form={form} name="name" placeholder="請填入您的姓名" />
          </Section>

          <Section
            id="about"
            title={
              <>
                {isMentor && <span className="text-status-200">* </span>}
                關於我
              </>
            }
          >
            <TextareaField form={form} name="about" rows={10} />
          </Section>

          {isMentor && (
            <Section
              id="have_topic"
              title={
                <>
                  <span className="text-status-200">* </span>我能提供的服務
                </>
              }
            >
              <CategoryMultiSelectField
                form={form}
                name="have_topic"
                categories={haveTopicCategories}
                maxSelected={10}
                searchPlaceholder="搜尋服務"
              />
            </Section>
          )}

          {isMentor && (
            <Section
              id="have_skill"
              title={
                <>
                  <span className="text-status-200">* </span>專業能力
                </>
              }
            >
              <CategoryMultiSelectField
                form={form}
                name="have_skill"
                categories={haveSkillCategories}
                maxSelected={10}
                searchPlaceholder="搜尋專業能力"
              />
            </Section>
          )}

          <Section
            id="location"
            title={
              <>
                <span className="text-status-200">* </span>地區
              </>
            }
          >
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

          <Section
            id="years_of_experience"
            title={
              <>
                <span className="text-status-200">* </span>經驗
              </>
            }
          >
            <SelectField
              form={form}
              name="years_of_experience"
              placeholder="請填入您的經驗"
              options={totalWorkSpanOptions}
            />
          </Section>

          <Section
            id="industry"
            title={
              <>
                {isMentor && <span className="text-status-200">* </span>}
                產業
              </>
            }
          >
            <CategoryMultiSelectField
              form={form}
              name="industry"
              categories={industryCategories}
              flat
              maxSelected={10}
              searchPlaceholder="搜尋產業"
            />
          </Section>

          <Section
            id="want_position"
            title={
              <>
                <span className="text-status-200">* </span>有興趣多了解的職位
              </>
            }
          >
            <CategoryMultiSelectField
              form={form}
              name="want_position"
              categories={wantPositionCategories}
              maxSelected={10}
              searchPlaceholder="搜尋職位"
            />
          </Section>

          <Section
            id="want_skill"
            title={
              <>
                <span className="text-status-200">* </span>想多了解、加強的技能
              </>
            }
          >
            <CategoryMultiSelectField
              form={form}
              name="want_skill"
              categories={wantSkillCategories}
              maxSelected={10}
              searchPlaceholder="搜尋技能"
            />
          </Section>

          <Section
            id="want_topic"
            title={
              <>
                <span className="text-status-200">* </span>想多了解的主題
              </>
            }
          >
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
              isMentor={isMentor}
              onValidationChange={setJobSectionError}
            />
          </div>

          <div id="educations">
            <EducationSection
              form={form}
              isMentor={isMentor}
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
