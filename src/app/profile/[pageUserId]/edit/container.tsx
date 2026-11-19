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
import { MentorGuidelinesCard } from '@/components/profile/edit/MentorGuidelinesCard';
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
import {
  isGooglePrefillAvatarUrl,
  isPresetAvatarUrl,
} from '@/lib/avatar/avatarUrl';
import { isDualTrackV2Enabled } from '@/lib/featureFlags';
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

function MentorOnboardingAvatarHint({
  form,
  isMentorOnboarding,
}: {
  form: ProfileFormContext;
  isMentorOnboarding: boolean;
}) {
  const watchedAvatar = useWatch({ control: form.control, name: 'avatar' });
  const watchedAvatarFile = useWatch({
    control: form.control,
    name: 'avatarFile',
  });

  if (!isMentorOnboarding || watchedAvatarFile) {
    return null;
  }

  if (isGooglePrefillAvatarUrl(watchedAvatar)) {
    return (
      <p className="text-text-tertiary max-w-[220px] text-xs leading-relaxed">
        請確認預填頭像為本人真實照片，或點擊更換照片。
      </p>
    );
  }

  if (!watchedAvatar || isPresetAvatarUrl(watchedAvatar)) {
    return (
      <p className="text-text-tertiary max-w-[220px] text-xs leading-relaxed">
        成為導師需使用本人真實照片，請點擊相機圖示上傳照片。
      </p>
    );
  }

  return null;
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

  const watchedAgreedGuidelines = useWatch({
    control: form.control,
    name: 'agreed_guidelines',
  });
  const agreedGuidelines = Boolean(watchedAgreedGuidelines);
  const guidelinesError = form.formState.errors.agreed_guidelines?.message;

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
    <div className="pb-24">
      <EditPageHeader
        isSaving={isSaving}
        onBack={handleGoToPrev}
        isMentorOnboarding={isMentorOnboarding}
        isMentor={isMentorRole}
      />

      <div className="mx-auto flex w-11/12 max-w-[1160px] flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
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
                  className="from-auth-gradient-1 via-auth-gradient-2/55 to-auth-gradient-3 h-20 w-full rounded-2xl bg-gradient-to-r sm:h-[72px]"
                />

                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
                  <div className="flex flex-col items-start gap-1.5">
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
                    <MentorOnboardingAvatarHint
                      form={form}
                      isMentorOnboarding={isMentorOnboarding}
                    />
                  </div>

                  <Section
                    id="name"
                    variant="inline"
                    className="flex-1"
                    title="姓名"
                    required
                    requiredPosition="suffix"
                    headerAction={<NameLengthCounter form={form} />}
                  >
                    <TextField
                      control={form.control}
                      name="name"
                      maxLength={20}
                      autoComplete="name"
                      placeholder="請填入您的姓名"
                    />
                  </Section>
                </div>

                {isMentorOnboarding && (
                  <MentorGuidelinesCard
                    id="agreed_guidelines"
                    checked={agreedGuidelines}
                    errorMessage={
                      typeof guidelinesError === 'string'
                        ? guidelinesError
                        : undefined
                    }
                    onCheckedChange={(next) =>
                      form.setValue('agreed_guidelines', next, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  />
                )}

                <div className="grid grid-cols-1 gap-5 pt-1 sm:grid-cols-2 md:grid-cols-[1fr_1fr_1.2fr]">
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
                    className="sm:col-span-2 md:col-span-1"
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
                variant="option-a"
                className="scroll-mt-28"
                title="關於我"
                required={isMentorRole}
                headerAction={<AboutLengthCounter form={form} />}
              >
                <TextareaField
                  control={form.control}
                  name="about"
                  rows={7}
                  placeholder={
                    isMentorRole
                      ? '介紹目前工作、能協助的問題與成為 Mentor 的原因。建議 150–300 字。'
                      : '介紹自己、目前的方向與希望交流的內容…'
                  }
                />
              </Section>

              {isMentorRole ? (
                <div
                  id="mentor-expertise"
                  className="border-background-border scroll-mt-28 space-y-8 border-t pt-8"
                >
                  <Section
                    id="have_topic"
                    variant="option-a"
                    noBorderTop
                    title="我能提供的服務"
                    required
                    subtitle="選擇最有把握協助的項目。建議選擇 2–4 項。"
                  >
                    <CategoryMultiSelectField
                      form={form}
                      name="have_topic"
                      categories={haveTopicCategories}
                      maxSelected={10}
                      addLabel="新增服務"
                      searchPlaceholder="搜尋服務"
                    />
                  </Section>

                  <Section
                    id="have_skill"
                    variant="option-a"
                    noBorderTop
                    title="專業能力"
                    required
                    subtitle="加入學員可能搜尋的技能。建議選擇 3–8 項。"
                  >
                    <CategoryMultiSelectField
                      form={form}
                      name="have_skill"
                      categories={haveSkillCategories}
                      maxSelected={10}
                      addLabel="新增技能"
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
                    required={!isDualTrackV2Enabled()}
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

              <div className="scroll-mt-28">
                <LinksSection id="links" form={form} />
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
            <DialogDescription>尚未儲存的變更將不會保留。</DialogDescription>
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
