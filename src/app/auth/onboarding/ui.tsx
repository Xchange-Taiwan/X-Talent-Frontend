'use client';

import { ArrowRight, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import React, { type FormEvent, useMemo } from 'react';
import { type UseFormReturn, useFormState, useWatch } from 'react-hook-form';

import { RoleSelectorCards } from '@/components/onboarding/RoleSelectorCards';
import { AvatarSection } from '@/components/profile/edit/AvatarSection';
import { CategoryMultiSelectField } from '@/components/profile/edit/CategoryMultiSelectField';
import {
  ComboboxField,
  SelectField,
  TextareaField,
  TextField,
} from '@/components/profile/edit/Fields';
import { MenteeDirectionPreferenceSection } from '@/components/profile/edit/MenteeDirectionPreferenceSection';
import { MentorGuidelinesCard } from '@/components/profile/edit/MentorGuidelinesCard';
import { Section } from '@/components/profile/edit/Section';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { totalWorkSpanOptions } from '@/constant/seniority';
import { isGooglePrefillAvatarUrl } from '@/lib/avatar/avatarUrl';
import { isDualTrackV2Enabled } from '@/lib/featureFlags';
import { tagGroupsToCategories } from '@/lib/profile/categoryGrouping';
import type { MenteeDirectionMap } from '@/lib/profile/menteeDirectionPreference';
import { FOCUS_RING_NO_OFFSET_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';
import type {
  OnboardingRole,
  ProfileFormValues,
} from '@/schemas/profileSchema';
import type { LocationType } from '@/types/location';
import type { IndustryOption, TagCatalogGroupVO } from '@/types/tagCatalog';

const JobExperienceSection = dynamic(
  async () => {
    const m = await import('@/components/profile/edit/JobExperienceSection');
    return { default: m.JobExperienceSection };
  },
  {
    ssr: false,
    loading: () => <Skeleton className="h-40 w-full rounded" />,
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
    loading: () => <Skeleton className="h-40 w-full rounded" />,
  }
);

const LinksSection = dynamic(
  async () => {
    const m = await import('@/components/profile/edit/LinkSection');
    return { default: m.LinksSection };
  },
  {
    ssr: false,
    loading: () => <Skeleton className="h-32 w-full rounded" />,
  }
);

function OnboardingIdentitySection({
  form,
  isMentor,
  onAvatarFileChange,
  onSelectPresetAvatar,
}: {
  form: UseFormReturn<ProfileFormValues>;
  isMentor: boolean;
  onAvatarFileChange: (file: File) => void;
  onSelectPresetAvatar: (presetUrlOrCode: string) => void;
}) {
  const watchedName = useWatch({ control: form.control, name: 'name' });
  const watchedAvatar = useWatch({ control: form.control, name: 'avatar' });
  const watchedAvatarFile = useWatch({
    control: form.control,
    name: 'avatarFile',
  });

  const nameLen = typeof watchedName === 'string' ? watchedName.length : 0;
  const hasGooglePrefillAvatar =
    isGooglePrefillAvatarUrl(watchedAvatar) && !watchedAvatarFile;

  return (
    <section className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
      <div className="flex flex-col items-start gap-1.5">
        <AvatarSection
          id="avatarFile"
          variant="compact"
          control={form.control}
          name="avatarFile"
          isMentor={isMentor}
          userName={watchedName || undefined}
          onFileChange={onAvatarFileChange}
          onSelectPresetAvatar={isMentor ? undefined : onSelectPresetAvatar}
        />
        {isMentor && hasGooglePrefillAvatar && (
          <p className="text-text-tertiary max-w-[200px] text-xs">
            請確認預填頭像為本人真實照片，或點擊更換照片。
          </p>
        )}
      </div>

      <Section
        id="name"
        variant="inline"
        className="max-w-md flex-1"
        title="姓名"
        required
        headerAction={
          <span className="text-text-tertiary text-xs tabular-nums">
            {nameLen}/20
          </span>
        }
      >
        <TextField
          control={form.control}
          name="name"
          maxLength={20}
          autoComplete="name"
          placeholder="請填入您的姓名"
        />
      </Section>
    </section>
  );
}

function OnboardingGuidelinesField({
  form,
}: {
  form: UseFormReturn<ProfileFormValues>;
}) {
  const watchedAgreed = useWatch({
    control: form.control,
    name: 'agreed_guidelines',
  });
  const { errors } = useFormState({
    control: form.control,
    name: 'agreed_guidelines',
  });

  return (
    <MentorGuidelinesCard
      id="agreed_guidelines"
      checked={Boolean(watchedAgreed)}
      errorMessage={
        typeof errors.agreed_guidelines?.message === 'string'
          ? errors.agreed_guidelines.message
          : undefined
      }
      onCheckedChange={(next) =>
        form.setValue('agreed_guidelines', next, {
          shouldDirty: true,
          shouldValidate: true,
        })
      }
    />
  );
}

export interface OnboardingUIProps {
  role: OnboardingRole;
  onRoleChange: (next: OnboardingRole) => void;
  enableDualTrackRoleSelect?: boolean;
  form: UseFormReturn<ProfileFormValues>;
  formRef?: React.RefObject<HTMLFormElement>;
  locations: LocationType[];
  industries: IndustryOption[];
  haveTopicGroups: TagCatalogGroupVO[];
  haveSkillGroups: TagCatalogGroupVO[];
  wantPositionGroups: TagCatalogGroupVO[];
  wantSkillGroups: TagCatalogGroupVO[];
  wantTopicGroups: TagCatalogGroupVO[];
  directionMap: MenteeDirectionMap;
  onDirectionMapChange: (next: MenteeDirectionMap) => void;
  onAvatarFileChange: (file: File) => void;
  onSelectPresetAvatar: (presetUrlOrCode: string) => void;
  isSubmitting: boolean;
  onSubmit: () => Promise<void>;
}

export default function OnboardingUI({
  role,
  onRoleChange,
  enableDualTrackRoleSelect,
  form,
  formRef,
  locations,
  industries,
  haveTopicGroups,
  haveSkillGroups,
  wantPositionGroups,
  wantSkillGroups,
  wantTopicGroups,
  directionMap,
  onDirectionMapChange,
  onAvatarFileChange,
  onSelectPresetAvatar,
  isSubmitting,
  onSubmit,
}: OnboardingUIProps) {
  const showRoleSelector = enableDualTrackRoleSelect ?? isDualTrackV2Enabled();
  const effectiveRole: OnboardingRole = showRoleSelector ? role : 'mentee';
  const isMentor = effectiveRole === 'mentor';

  const locationOptions = useMemo(
    () => locations.map((loc) => ({ value: loc.value, label: loc.text })),
    [locations]
  );

  const haveTopicCategories = useMemo(
    () => tagGroupsToCategories(haveTopicGroups),
    [haveTopicGroups]
  );
  const haveSkillCategories = useMemo(
    () => tagGroupsToCategories(haveSkillGroups),
    [haveSkillGroups]
  );
  const wantPositionCategories = useMemo(
    () => tagGroupsToCategories(wantPositionGroups),
    [wantPositionGroups]
  );
  const wantSkillCategories = useMemo(
    () => tagGroupsToCategories(wantSkillGroups),
    [wantSkillGroups]
  );
  const wantTopicCategories = useMemo(
    () => tagGroupsToCategories(wantTopicGroups),
    [wantTopicGroups]
  );

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSubmit();
  };

  return (
    <div className="mx-auto w-11/12 max-w-[960px] pt-12 pb-24">
      <div className="mb-8">
        <span className="text-brand-700 text-xs font-semibold tracking-wide">
          歡迎加入 X-Talent
        </span>
        <h1 className="text-text-primary sm:text-28 mt-1.5 text-2xl font-semibold">
          該如何稱呼你呢？
        </h1>
      </div>

      <Form {...form}>
        <form
          ref={formRef}
          data-clarity-mask="true"
          onSubmit={handleFormSubmit}
          className="space-y-10"
        >
          <OnboardingIdentitySection
            form={form}
            isMentor={isMentor}
            onAvatarFileChange={onAvatarFileChange}
            onSelectPresetAvatar={onSelectPresetAvatar}
          />

          {/* Dual-track starting role selector (gated until #964 / #745 / #890 land, #970) */}
          {showRoleSelector && (
            <RoleSelectorCards
              value={effectiveRole}
              onChange={onRoleChange}
              disabled={isSubmitting}
            />
          )}

          {/* Mentor Guidelines (shown immediately under RoleSelectorCards when Mentor) */}
          {isMentor && <OnboardingGuidelinesField form={form} />}

          {/* Basic Info */}
          <section
            id="basic"
            className="border-background-border space-y-5 border-t pt-8"
          >
            <h2 className="text-text-primary text-lg font-semibold">
              基本資料
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
              <Section id="location" variant="inline" title="地區" required>
                <ComboboxField
                  form={form}
                  name="location"
                  placeholder="請選擇"
                  searchPlaceholder="搜尋地區"
                  options={locationOptions}
                />
              </Section>

              <Section
                id="years_of_experience"
                variant="inline"
                title="經驗"
                required
              >
                <SelectField
                  form={form}
                  name="years_of_experience"
                  placeholder="請選擇您的年資區間"
                  options={totalWorkSpanOptions}
                />
              </Section>

              <Section
                id="industry"
                variant="inline"
                className="sm:col-span-2 md:col-span-1"
                title="產業"
                required={isMentor}
              >
                <SelectField
                  form={form}
                  name="industry"
                  placeholder="請選擇"
                  options={industries.map((i) => ({
                    value: i.subject_group,
                    label: i.subject,
                  }))}
                />
              </Section>
            </div>
          </section>

          {/* Role-specific fields */}
          {isMentor ? (
            <>
              <Section id="about" variant="option-a" title="關於我" required>
                <TextareaField
                  control={form.control}
                  name="about"
                  rows={5}
                  placeholder="分享你的背景與目前的方向…"
                />
              </Section>

              <section
                id="mentor-expertise"
                className="border-background-border space-y-6 border-t pt-8"
              >
                <h2 className="text-text-primary text-lg font-semibold">
                  服務與專長
                </h2>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <Section
                    id="have_skill"
                    variant="inline"
                    title="專業能力"
                    required
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

                  <Section
                    id="have_topic"
                    variant="inline"
                    title="我能提供的服務"
                    required
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
                </div>
              </section>

              <div id="work_experiences">
                <JobExperienceSection
                  industries={industries}
                  locations={locations}
                  form={form}
                  isMentor
                />
              </div>

              <div id="educations">
                <EducationSection form={form} isMentor />
              </div>

              <div>
                <LinksSection id="links" form={form} />
              </div>
            </>
          ) : (
            <div id="preferences">
              <MenteeDirectionPreferenceSection
                form={form}
                wantPositionCategories={wantPositionCategories}
                wantSkillCategories={wantSkillCategories}
                wantTopicCategories={wantTopicCategories}
                directionMap={directionMap}
                onDirectionMapChange={onDirectionMapChange}
                required
              />
            </div>
          )}

          <div className="border-background-border flex justify-end border-t pt-8">
            <Button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                FOCUS_RING_NO_OFFSET_CLASSES,
                'bg-brand-500 text-text-primary hover:bg-brand-600 focus-visible:ring-brand-700 h-11 min-w-[128px] rounded-lg px-6 font-semibold'
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2
                    className="mr-2 size-4 animate-spin"
                    aria-hidden="true"
                  />
                  提交中...
                </>
              ) : (
                <>
                  提交
                  <ArrowRight className="ml-1.5 size-4" aria-hidden="true" />
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
