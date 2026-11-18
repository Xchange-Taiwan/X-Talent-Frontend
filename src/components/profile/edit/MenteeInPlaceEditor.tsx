'use client';

import { Camera } from 'lucide-react';
import Image from 'next/image';
import React, { useMemo, useState } from 'react';
import { useFormState, useWatch } from 'react-hook-form';

import DefaultAvatarImgUrl from '@/assets/default-avatar.png';
import { EducationSection } from '@/components/profile/edit/educationSection/educationSection';
import {
  ComboboxField,
  SelectField,
  TextareaField,
} from '@/components/profile/edit/Fields';
import { JobExperienceSection } from '@/components/profile/edit/JobExperienceSection';
import { LinksSection } from '@/components/profile/edit/LinkSection';
import { MenteeAvatarDialog } from '@/components/profile/edit/MenteeAvatarDialog';
import { MenteeDirectionPreferenceSection } from '@/components/profile/edit/MenteeDirectionPreferenceSection';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PageLoading } from '@/components/ui/loading-spinner';
import { totalWorkSpanOptions } from '@/constant/seniority';
import { useObjectUrl } from '@/hooks/useObjectUrl';
import useLocations from '@/hooks/user/country/useLocations';
import { useMenteeDirectionPreference } from '@/hooks/user/profile/useMenteeDirectionPreference';
import {
  type ProfileFormContext,
  useProfileEditorSession,
} from '@/hooks/user/profile/useProfileEditorSession';
import useTagCatalog from '@/hooks/user/tags/useTagCatalog';
import { tagGroupsToCategories } from '@/lib/profile/categoryGrouping';
import {
  FOCUS_RING_CLASSES,
  FOCUS_RING_NO_OFFSET_CLASSES,
} from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';
import type { MentorProfileVO } from '@/types/user';

function MenteeHeaderAvatarControl({
  form,
  fallbackName,
  onSavePreset,
  onSaveCustomFile,
}: {
  form: ProfileFormContext;
  fallbackName?: string | null;
  onSavePreset: (presetUrl: string) => void;
  onSaveCustomFile: (file: File) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const watchedAvatar = useWatch({ control: form.control, name: 'avatar' });
  const watchedAvatarFile = useWatch({
    control: form.control,
    name: 'avatarFile',
  });
  const avatarFileObjectUrl = useObjectUrl(watchedAvatarFile);

  const previewAvatarSrc =
    avatarFileObjectUrl ||
    (typeof watchedAvatar === 'string' && watchedAvatar
      ? watchedAvatar
      : DefaultAvatarImgUrl);

  const resolvedName = form.getValues('name') || fallbackName || '';

  return (
    <>
      <div className="mx-auto flex flex-shrink-0 flex-col items-center gap-2 sm:mx-0">
        <button
          type="button"
          aria-label="編輯個人頭像"
          onClick={() => setDialogOpen(true)}
          className={cn(
            'group border-background-white bg-background-white relative h-[160px] w-[160px] cursor-pointer rounded-full border-4 p-0 shadow-sm',
            FOCUS_RING_CLASSES
          )}
        >
          <span className="relative block size-full overflow-hidden rounded-full">
            <Image
              src={previewAvatarSrc}
              alt={resolvedName ? `Avatar of ${resolvedName}` : '個人頭像預覽'}
              fill
              sizes="160px"
              className="object-cover"
              priority
            />
            <span className="bg-dark/40 text-background-white absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
              <Camera className="size-8" aria-hidden="true" />
            </span>
          </span>
        </button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="rounded-full text-xs"
        >
          更換頭像
        </Button>
      </div>

      <MenteeAvatarDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        currentAvatarUrl={
          typeof watchedAvatar === 'string' ? watchedAvatar : ''
        }
        currentAvatarFile={watchedAvatarFile}
        userName={resolvedName || undefined}
        onSavePreset={onSavePreset}
        onSaveCustomFile={onSaveCustomFile}
      />
    </>
  );
}

function MenteePrimaryJobPreview({
  form,
  userDto,
  isHydrating,
}: {
  form: ProfileFormContext;
  userDto: MentorProfileVO | null | undefined;
  isHydrating: boolean;
}) {
  const watchedWorkExperiences = useWatch({
    control: form.control,
    name: 'work_experiences',
  });
  const { dirtyFields } = useFormState({
    control: form.control,
    name: 'work_experiences',
  });
  const workExperiencesDirty = Boolean(dirtyFields.work_experiences);

  const livePrimaryJob = useMemo(() => {
    const workList =
      watchedWorkExperiences && watchedWorkExperiences.length > 0
        ? watchedWorkExperiences
        : (form.getValues('work_experiences') ?? []);
    if (workList.length > 0) {
      const primary = workList.find((w) => w.is_primary) ?? workList[0];
      return {
        jobTitle: primary?.job?.trim() ?? '',
        company: primary?.company?.trim() ?? '',
      };
    }
    if (!isHydrating && workExperiencesDirty) {
      return { jobTitle: '', company: '' };
    }
    return {
      jobTitle: userDto?.job_title?.trim() ?? '',
      company: userDto?.company?.trim() ?? '',
    };
  }, [
    form,
    isHydrating,
    userDto?.company,
    userDto?.job_title,
    watchedWorkExperiences,
    workExperiencesDirty,
  ]);

  if (!livePrimaryJob.jobTitle && !livePrimaryJob.company) return null;

  return (
    <p className="text-text-secondary mt-2 text-sm">
      {livePrimaryJob.jobTitle}
      {livePrimaryJob.jobTitle && livePrimaryJob.company && (
        <span className="text-text-tertiary"> at </span>
      )}
      {livePrimaryJob.company}
    </p>
  );
}

export interface MenteeInPlaceEditorProps {
  pageUserId: string;
  initialUserDto?: MentorProfileVO | null;
  initialTagCatalog?: TagCatalogsByBucket;
  onExitEdit: () => void;
}

export function MenteeInPlaceEditor({
  pageUserId,
  initialUserDto,
  initialTagCatalog,
  onExitEdit,
}: MenteeInPlaceEditorProps) {
  const { locations } = useLocations('zh_TW');
  const locationOptions = useMemo(
    () => locations.map((loc) => ({ value: loc.value, label: loc.text })),
    [locations]
  );

  const tagCatalog = useTagCatalog('zh_TW', initialTagCatalog);
  const industries = tagCatalog.industry;

  const [syncedDto, setSyncedDto] = useState<MentorProfileVO | null>(
    initialUserDto ?? null
  );

  const {
    directionMap,
    setDirectionMap,
    isDirectionMapDirty,
    persistDirectionMap,
  } = useMenteeDirectionPreference(pageUserId, syncedDto);

  const {
    form,
    formRef,
    userDto,
    isError,
    isHydrating,
    isSaving,
    handleAvatarFileChange,
    handleSelectPresetAvatar,
    handleFormSubmit,
    handleGoToPrev,
    isPromptOpen,
    cancelLeave,
    confirmLeave,
  } = useProfileEditorSession({
    pageUserId,
    isAuthorized: true,
    isMentorOnboarding: false,
    industryCatalog: industries,
    initialUserDto,
    onExitEdit,
    extraDirty: isDirectionMapDirty,
    onAfterSave: persistDirectionMap,
  });

  if (userDto && userDto !== syncedDto) {
    setSyncedDto(userDto);
  }

  const wantPositionCategories = useMemo(
    () => tagGroupsToCategories(tagCatalog.want_position),
    [tagCatalog.want_position]
  );
  const wantSkillCategories = useMemo(
    () => tagGroupsToCategories(tagCatalog.want_skill),
    [tagCatalog.want_skill]
  );
  const wantTopicCategories = useMemo(
    () => tagGroupsToCategories(tagCatalog.want_topic),
    [tagCatalog.want_topic]
  );

  if (isError) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center space-y-4">
        <p className="text-status-error-default text-lg font-medium">
          載入失敗，請稍後再試。
        </p>
        <Button type="button" variant="outline" onClick={onExitEdit}>
          返回個人頁面
        </Button>
      </div>
    );
  }

  if (isHydrating) return <PageLoading />;

  return (
    <div data-testid="mentee-inplace-editor">
      <Form {...form}>
        <form
          ref={formRef}
          id="mentee-inplace-edit-form"
          onSubmit={handleFormSubmit}
          noValidate
        >
          {/* Same-position Header matching B-1 Mentee Profile View */}
          <div className="-mt-10 mb-8 flex h-auto flex-col sm:flex-row sm:items-start">
            <MenteeHeaderAvatarControl
              form={form}
              fallbackName={userDto?.name}
              onSavePreset={handleSelectPresetAvatar}
              onSaveCustomFile={handleAvatarFileChange}
            />

            <div className="mt-4 flex min-w-0 flex-1 flex-col items-center sm:mt-14 sm:ml-6 sm:items-start">
              <div id="name" className="w-full max-w-md">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => {
                    const currentName =
                      typeof field.value === 'string' ? field.value : '';
                    return (
                      <FormItem>
                        <FormLabel className="sr-only">姓名</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              aria-label="姓名"
                              value={currentName}
                              placeholder="請填入您的姓名（1–20 字）"
                              className={cn(
                                'focus-visible:border-ring pr-16 text-lg font-semibold',
                                FOCUS_RING_NO_OFFSET_CLASSES
                              )}
                            />
                            <span className="text-text-tertiary pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs tabular-nums">
                              {currentName.length}/20
                            </span>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>

              <MenteePrimaryJobPreview
                form={form}
                userDto={userDto}
                isHydrating={isHydrating}
              />

              <div className="mt-4 flex items-center justify-center gap-3 sm:justify-start">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full px-6 py-3"
                  onClick={handleGoToPrev}
                  disabled={isSaving}
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  className="rounded-full px-6 py-3"
                  disabled={isSaving}
                >
                  {isSaving ? '儲存中...' : '儲存'}
                </Button>
              </div>
            </div>
          </div>

          {/* 6 Mentee Form Sections */}
          <div className="w-full max-w-3xl space-y-6">
            {/* 1. 基本資料 */}
            <Section
              variant="card"
              dataTestId="mentee-section-basic"
              title="基本資料"
              subtitle="職稱與公司取自工作經驗中「設為頁面顯示的職稱」那一筆"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div id="location" className="space-y-2">
                  <p className="text-text-primary text-sm font-medium">地區</p>
                  <ComboboxField
                    form={form}
                    name="location"
                    placeholder="請選擇地區"
                    searchPlaceholder="搜尋地區"
                    options={locationOptions}
                  />
                </div>

                <div id="years_of_experience" className="space-y-2">
                  <p className="text-text-primary text-sm font-medium">經驗</p>
                  <SelectField
                    form={form}
                    name="years_of_experience"
                    placeholder="請填入您的經驗"
                    options={totalWorkSpanOptions}
                  />
                </div>

                <div id="industry" className="space-y-2">
                  <p className="text-text-primary text-sm font-medium">產業</p>
                  <SelectField
                    form={form}
                    name="industry"
                    placeholder="請選擇產業"
                    options={industries.map((i) => ({
                      value: i.subject_group,
                      label: i.subject,
                    }))}
                  />
                </div>
              </div>
            </Section>

            {/* 2. 關於我 */}
            <Section
              id="about"
              variant="card"
              dataTestId="mentee-section-about"
              title="關於我"
              subtitle="介紹你自己，以及想了解的方向"
            >
              <TextareaField
                control={form.control}
                name="about"
                rows={6}
                placeholder="介紹你自己，以及想了解的方向"
                className={cn(
                  'focus-visible:border-ring',
                  FOCUS_RING_NO_OFFSET_CLASSES
                )}
              />
            </Section>

            {/* 3. 交流偏好 */}
            <MenteeDirectionPreferenceSection
              form={form}
              wantPositionCategories={wantPositionCategories}
              wantSkillCategories={wantSkillCategories}
              wantTopicCategories={wantTopicCategories}
              directionMap={directionMap}
              onDirectionMapChange={setDirectionMap}
            />

            {/* 4. 工作經驗 */}
            <div id="work_experiences">
              <JobExperienceSection
                industries={industries}
                locations={locations}
                form={form}
                isMentor={false}
                collapsible
                cardVariant
              />
            </div>

            {/* 5. 教育 */}
            <div id="educations">
              <EducationSection
                form={form}
                isMentor={false}
                collapsible
                cardVariant
              />
            </div>

            {/* 6. 個人連結 */}
            <LinksSection id="links" form={form} cardVariant />

            {/* Bottom Cancel / Save Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full px-6 py-3"
                onClick={handleGoToPrev}
                disabled={isSaving}
              >
                取消
              </Button>
              <Button
                type="submit"
                variant="default"
                className="rounded-full px-6 py-3"
                disabled={isSaving}
              >
                {isSaving ? '儲存中...' : '儲存'}
              </Button>
            </div>
          </div>
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
            <Button type="button" variant="outline" onClick={cancelLeave}>
              繼續編輯
            </Button>
            <Button type="button" variant="destructive" onClick={confirmLeave}>
              離開頁面
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
