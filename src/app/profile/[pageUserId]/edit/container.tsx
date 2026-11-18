'use client';

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { useWatch } from 'react-hook-form';

import { AvatarSection } from '@/components/profile/edit/AvatarSection';
import { CategoryMultiSelectField } from '@/components/profile/edit/CategoryMultiSelectField';
import { EditPageHeader } from '@/components/profile/edit/EditPageHeader';
import {
  ComboboxField,
  SelectField,
  TextareaField,
  TextField,
} from '@/components/profile/edit/Fields';
import { MenteeDirectionPreferenceSection } from '@/components/profile/edit/MenteeDirectionPreferenceSection';
import { ProfileEditChapterNav } from '@/components/profile/edit/ProfileEditChapterNav';
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
import {
  type ProfileFormContext,
  useProfileEditorSession,
} from '@/hooks/user/profile/useProfileEditorSession';
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

function NameLengthCounter({ form }: { form: ProfileFormContext }) {
  const watchedName = useWatch({ control: form.control, name: 'name' });
  const len = typeof watchedName === 'string' ? watchedName.length : 0;
  return (
    <span className="text-text-tertiary text-xs tabular-nums">{len}/20</span>
  );
}

function AboutLengthCounter({ form }: { form: ProfileFormContext }) {
  const watchedAbout = useWatch({ control: form.control, name: 'about' });
  const len = typeof watchedAbout === 'string' ? watchedAbout.length : 0;
  return (
    <span className="text-text-tertiary text-xs tabular-nums">{len} 字</span>
  );
}

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
    userDto,
    isMentorRole,
    isError,
    isHydrating,
    isSaving,
    directionMap,
    setDirectionMap,
    handleAvatarFileChange,
    handleSelectPresetAvatar,
    handleFormSubmit,
    handleGoToPrev,
    isPromptOpen,
    cancelLeave,
    confirmLeave,
  } = useProfileEditorSession({
    pageUserId,
    isAuthorized,
    isMentorOnboarding,
    industryCatalog: industries,
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
    <div className="mx-auto w-11/12 max-w-[1160px] pb-24">
      <EditPageHeader
        isSaving={isSaving}
        onBack={handleGoToPrev}
        isMentorOnboarding={isMentorOnboarding}
        isMentor={isMentorRole}
      />

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
        <ProfileEditChapterNav isMentor={isMentorRole} />

        <div className="min-w-0 flex-1">
          <Form {...form}>
            <form
              ref={formRef}
              id="edit-profile-form"
              data-clarity-mask="true"
              onSubmit={handleFormSubmit}
              className="space-y-8"
            >
              <div id="basic-info" className="scroll-mt-28 space-y-6">
                <div
                  aria-hidden="true"
                  className="from-auth-gradient-1 via-auth-gradient-2/55 to-auth-gradient-3 h-20 w-full rounded-2xl bg-gradient-to-r"
                />

                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
                  <AvatarSection
                    id="avatarFile"
                    variant="compact"
                    control={form.control}
                    name="avatarFile"
                    isMentor={isMentorRole}
                    userName={userDto?.name ?? undefined}
                    onFileChange={handleAvatarFileChange}
                    onSelectPresetAvatar={
                      isMentorRole ? undefined : handleSelectPresetAvatar
                    }
                  />

                  <Section
                    id="name"
                    variant="inline"
                    className="flex-1"
                    title="姓名"
                    required
                    headerAction={<NameLengthCounter form={form} />}
                  >
                    <TextField
                      control={form.control}
                      name="name"
                      placeholder="請填入您的姓名"
                    />
                  </Section>
                </div>

                <div className="grid grid-cols-1 gap-5 pt-1 md:grid-cols-3">
                  <Section
                    id="location"
                    variant="inline"
                    title="地區"
                    required={isMentorRole}
                  >
                    <ComboboxField
                      form={form}
                      name="location"
                      placeholder="選擇地區"
                      searchPlaceholder="搜尋地區"
                      options={locationOptions}
                    />
                  </Section>

                  <Section
                    id="years_of_experience"
                    variant="inline"
                    title="經驗"
                    required={isMentorRole}
                  >
                    <SelectField
                      form={form}
                      name="years_of_experience"
                      placeholder="選擇工作年資"
                      options={totalWorkSpanOptions}
                    />
                  </Section>

                  <Section
                    id="industry"
                    variant="inline"
                    title="產業"
                    required={isMentorRole}
                  >
                    <SelectField
                      form={form}
                      name="industry"
                      placeholder="選擇產業"
                      options={industries.map((i) => ({
                        value: i.subject_group,
                        label: i.subject,
                      }))}
                    />
                  </Section>
                </div>
              </div>

              <Section
                id="about"
                variant="default"
                className="scroll-mt-28"
                title="關於我"
                required={isMentorRole}
                subtitle={
                  isMentorRole
                    ? '建議 150–300 字，分享你的專業背景與可協助的方向。'
                    : undefined
                }
                headerAction={<AboutLengthCounter form={form} />}
              >
                <TextareaField
                  control={form.control}
                  name="about"
                  rows={6}
                  placeholder={
                    isMentorRole
                      ? '介紹目前工作、能協助的問題與成為 Mentor 的原因。建議 150–300 字。'
                      : '分享你的背景、目前關注的方向與想交流的主題。'
                  }
                />
              </Section>

              {isMentorRole ? (
                <div id="mentor-expertise" className="scroll-mt-28 space-y-8">
                  <Section
                    id="have_topic"
                    variant="default"
                    title="我能提供的服務"
                    required
                    subtitle="選擇最有把握協助的項目。建議選擇 2–4 項。"
                  >
                    <CategoryMultiSelectField
                      form={form}
                      name="have_topic"
                      categories={haveTopicCategories}
                      maxSelected={10}
                      searchPlaceholder="搜尋服務"
                    />
                  </Section>

                  <Section
                    id="have_skill"
                    variant="default"
                    title="專業能力"
                    required
                    subtitle="加入學員可能搜尋的技能。建議選擇 3–8 項。"
                  >
                    <CategoryMultiSelectField
                      form={form}
                      name="have_skill"
                      categories={haveSkillCategories}
                      maxSelected={10}
                      searchPlaceholder="搜尋專業能力"
                    />
                  </Section>
                </div>
              ) : (
                <div id="mentee-preferences" className="scroll-mt-28">
                  <MenteeDirectionPreferenceSection
                    form={form}
                    wantPositionCategories={wantPositionCategories}
                    wantSkillCategories={wantSkillCategories}
                    wantTopicCategories={wantTopicCategories}
                    directionMap={directionMap}
                    onDirectionMapChange={setDirectionMap}
                  />
                </div>
              )}

              <div id="work_experiences" className="scroll-mt-28">
                <JobExperienceSection
                  industries={industries}
                  locations={locations}
                  form={form}
                  isMentor={isMentorRole}
                />
              </div>

              <div id="educations" className="scroll-mt-28">
                <EducationSection form={form} isMentor={isMentorRole} />
              </div>

              <div id="links" className="scroll-mt-28">
                <LinksSection form={form} />
              </div>
            </form>
          </Form>
        </div>
      </div>

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
