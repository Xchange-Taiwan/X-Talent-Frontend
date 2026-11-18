'use client';

import { Camera } from 'lucide-react';
import Image from 'next/image';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useWatch } from 'react-hook-form';

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
import useLocations from '@/hooks/user/country/useLocations';
import { useProfileEditorSession } from '@/hooks/user/profile/useProfileEditorSession';
import useTagCatalog from '@/hooks/user/tags/useTagCatalog';
import { tagGroupsToCategories } from '@/lib/profile/categoryGrouping';
import {
  hydrateMenteeDirectionMap,
  type MenteeDirectionMap,
  readStoredMenteeDirectionMap,
  writeStoredMenteeDirectionMap,
} from '@/lib/profile/menteeDirectionPreference';
import { FOCUS_RING_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';
import type { MentorProfileVO } from '@/types/user';

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

  const [directionMap, setDirectionMap] = useState<MenteeDirectionMap>({});
  const [initialDirectionMapJson, setInitialDirectionMapJson] =
    useState<string>('{}');
  const directionMapRef = useRef<MenteeDirectionMap>(directionMap);
  directionMapRef.current = directionMap;
  const hydratedDirectionUserRef = useRef<string | null>(null);

  const isDirectionMapDirty = useMemo(
    () => JSON.stringify(directionMap) !== initialDirectionMapJson,
    [directionMap, initialDirectionMapJson]
  );

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
    onAfterSave: () => {
      writeStoredMenteeDirectionMap(pageUserId, directionMapRef.current);
    },
  });

  useEffect(() => {
    if (!userDto) return;
    if (hydratedDirectionUserRef.current === pageUserId) return;
    hydratedDirectionUserRef.current = pageUserId;

    const stored = readStoredMenteeDirectionMap(pageUserId);
    const hydrated = hydrateMenteeDirectionMap({
      positions: userDto.want_position ?? [],
      flatSkills: userDto.want_skill ?? [],
      flatTopics: userDto.want_topic ?? [],
      storedMap: stored,
    });
    setDirectionMap(hydrated);
    setInitialDirectionMapJson(JSON.stringify(hydrated));
  }, [pageUserId, userDto]);

  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);

  const watchedAvatar = useWatch({ control: form.control, name: 'avatar' });
  const watchedAvatarFile = useWatch({
    control: form.control,
    name: 'avatarFile',
  });
  const watchedName = useWatch({ control: form.control, name: 'name' });
  const watchedWorkExperiences = useWatch({
    control: form.control,
    name: 'work_experiences',
  });

  const [avatarFileObjectUrl, setAvatarFileObjectUrl] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!watchedAvatarFile) {
      setAvatarFileObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(watchedAvatarFile);
    setAvatarFileObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [watchedAvatarFile]);

  const workExperiencesDirty = Boolean(
    form.formState.dirtyFields.work_experiences
  );

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

  const previewAvatarSrc =
    avatarFileObjectUrl ||
    (typeof watchedAvatar === 'string' && watchedAvatar
      ? watchedAvatar
      : DefaultAvatarImgUrl);

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
            <div className="mx-auto flex flex-shrink-0 flex-col items-center gap-2 sm:mx-0">
              <button
                type="button"
                aria-label="編輯個人頭像"
                onClick={() => setAvatarDialogOpen(true)}
                className={cn(
                  'group border-background-white bg-background-white relative h-[160px] w-[160px] cursor-pointer rounded-full border-4 p-0 shadow-sm',
                  FOCUS_RING_CLASSES
                )}
              >
                <span className="relative block size-full overflow-hidden rounded-full">
                  <Image
                    src={previewAvatarSrc}
                    alt={
                      watchedName ? `Avatar of ${watchedName}` : '個人頭像預覽'
                    }
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
                onClick={() => setAvatarDialogOpen(true)}
                className="rounded-full text-xs"
              >
                更換頭像
              </Button>
            </div>

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
                              className="pr-16 text-lg font-semibold"
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

              {(livePrimaryJob.jobTitle || livePrimaryJob.company) && (
                <p className="text-text-secondary mt-2 text-sm">
                  {livePrimaryJob.jobTitle}
                  {livePrimaryJob.jobTitle && livePrimaryJob.company && (
                    <span className="text-text-tertiary"> at </span>
                  )}
                  {livePrimaryJob.company}
                </p>
              )}

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
            <section
              data-testid="mentee-section-basic"
              className="border-background-border bg-background-white rounded-2xl border p-6 shadow-sm"
            >
              <div className="mb-5">
                <h2 className="text-text-primary text-xl font-bold">
                  基本資料
                </h2>
                <p className="text-text-tertiary mt-1 text-sm">
                  職稱與公司取自工作經驗中「設為頁面顯示的職稱」那一筆
                </p>
              </div>

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
            </section>

            {/* 2. 關於我 */}
            <section
              id="about"
              data-testid="mentee-section-about"
              className="border-background-border bg-background-white rounded-2xl border p-6 shadow-sm"
            >
              <div className="mb-4">
                <h2 className="text-text-primary text-xl font-bold">關於我</h2>
                <p className="text-text-tertiary mt-1 text-sm">
                  介紹你自己，以及想了解的方向
                </p>
              </div>
              <TextareaField
                control={form.control}
                name="about"
                rows={6}
                placeholder="介紹你自己，以及想了解的方向"
              />
            </section>

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

      <MenteeAvatarDialog
        open={avatarDialogOpen}
        onOpenChange={setAvatarDialogOpen}
        currentAvatarUrl={
          typeof watchedAvatar === 'string' ? watchedAvatar : ''
        }
        currentAvatarFile={watchedAvatarFile}
        userName={typeof watchedName === 'string' ? watchedName : undefined}
        onSavePreset={handleSelectPresetAvatar}
        onSaveCustomFile={handleAvatarFileChange}
      />

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
