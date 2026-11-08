'use client';

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

import { AvatarSection } from '@/components/profile/edit/AvatarSection';
import { CategoryMultiSelectField } from '@/components/profile/edit/CategoryMultiSelectField';
import { EditPageHeader } from '@/components/profile/edit/EditPageHeader';
import {
  ComboboxField,
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
import { useProfileEditorSession } from '@/hooks/user/profile/useProfileEditorSession';
import useTagCatalog from '@/hooks/user/tags/useTagCatalog';
import { tagGroupsToCategories } from '@/lib/profile/categoryGrouping';
import { MENTOR_ONBOARDING_KEY } from '@/lib/routes';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';

const JobExperienceSection = dynamic(
  async () => {
    const m = await import('@/components/profile/edit/JobExperienceSection');
    return { default: m.JobExperienceSection };
  },
  {
    ssr: false,
    loading: () => (
      <div className="bg-muted h-40 w-full animate-pulse rounded" />
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
      <div className="bg-muted h-40 w-full animate-pulse rounded" />
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
      <div className="bg-muted h-32 w-full animate-pulse rounded" />
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
  const searchParams = useSearchParams();
  const isMentorOnboarding =
    searchParams?.get(MENTOR_ONBOARDING_KEY) === 'true' ||
    searchParams?.get('onboarding') === 'true';

  const { isAuthorized, isResolving } = useProfileAuth(pageUserId);

  const { locations } = useLocations('zh_TW');
  const locationOptions = useMemo(
    () => locations.map((loc) => ({ value: loc.value, label: loc.text })),
    [locations]
  );
  const tagCatalog = useTagCatalog('zh_TW', initialTagCatalog);
  const industries = tagCatalog.industry;

  const {
    form,
    formRef,
    isMentorRole,
    isError,
    isHydrating,
    isSaving,
    handleAvatarFileChange,
    handleFormSubmit,
    setJobSectionError,
    setEducationSectionError,
    handleGoToPrev,
    isPromptOpen,
    cancelLeave,
    confirmLeave,
  } = useProfileEditorSession({
    pageUserId,
    isAuthorized,
    isMentorOnboarding,
  });

  const haveTopicCategories = tagGroupsToCategories(tagCatalog.have_topic);
  const haveSkillCategories = tagGroupsToCategories(tagCatalog.have_skill);
  const wantPositionCategories = tagGroupsToCategories(
    tagCatalog.want_position
  );
  const wantSkillCategories = tagGroupsToCategories(tagCatalog.want_skill);
  const wantTopicCategories = tagGroupsToCategories(tagCatalog.want_topic);

  if (isResolving) return <PageLoading />;

  if (!isAuthorized) return null;

  if (isError) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
        <p className="text-status-error-default text-lg font-medium">
          載入失敗，請稍後再試。
        </p>
        <Button onClick={() => window.location.reload()} variant="outline">
          重新整理
        </Button>
      </div>
    );
  }

  if (isHydrating) return <PageLoading />;

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
          onSubmit={handleFormSubmit}
          className="space-y-10"
        >
          <AvatarSection
            id="avatarFile"
            control={form.control}
            name="avatarFile"
            isMentor={isMentorRole}
            onFileChange={handleAvatarFileChange}
          />

          <Section id="name" title="姓名" required>
            <TextField
              control={form.control}
              name="name"
              placeholder="請填入您的姓名"
            />
          </Section>

          <Section id="about" title="關於我" required={isMentorRole}>
            <TextareaField control={form.control} name="about" rows={10} />
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
            <ComboboxField
              form={form}
              name="location"
              placeholder="請選擇地區"
              searchPlaceholder="搜尋地區"
              options={locationOptions}
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
        open={isPromptOpen}
        onOpenChange={(open) => {
          if (!open) cancelLeave();
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
            <Button variant="outline" onClick={cancelLeave}>
              繼續編輯
            </Button>
            <Button variant="destructive" onClick={confirmLeave}>
              離開頁面
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
