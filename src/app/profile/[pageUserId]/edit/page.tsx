'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { totalWorkSpanOptions } from '@/components/onboarding/steps/constant';
import { AvatarSection } from '@/components/profile/edit/AvatarSection';
import { EditPageHeader } from '@/components/profile/edit/EditPageHeader';
import { EducationSection } from '@/components/profile/edit/educationSection/educationSection';
import {
  SelectField,
  TextareaField,
  TextField,
} from '@/components/profile/edit/Fields';
import { JobExperienceSection } from '@/components/profile/edit/JobExperienceSection';
import { LinksSection } from '@/components/profile/edit/LinkSection';
import { MultiSelectField } from '@/components/profile/edit/MultiSelectField';
import {
  createProfileFormSchema,
  defaultValues,
  ProfileFormValues,
} from '@/components/profile/edit/profileSchema';
import { Section } from '@/components/profile/edit/Section';
import { Form } from '@/components/ui/form';
import { useProfileAuth } from '@/hooks/user/auth/useProfileAuth';
import useLocations from '@/hooks/user/country/useLocations';
import useExpertises from '@/hooks/user/expertises/useExpertises';
import useIndustries from '@/hooks/user/industry/useIndustries';
import useInterests from '@/hooks/user/interests/useInterests';
import { useEditProfileData } from '@/hooks/user/profile/useEditProfileData';
import { useProfileSelectOptions } from '@/hooks/user/profile/useProfileSelectOptions';
import { useProfileSubmit } from '@/hooks/user/profile/useProfileSubmit';

export default function Page({
  params: { pageUserId },
}: {
  params: { pageUserId: string };
}) {
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
  const { industries } = useIndustries('zh_TW');
  const { interestedPositions, skills, topics } = useInterests('zh_TW');
  const { expertises } = useExpertises('zh_TW');

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(createProfileFormSchema(isMentor)),
    defaultValues,
  });

  const isMentorWatch = useWatch({ control: form.control, name: 'is_mentor' });

  const watchedResolver = useMemo(
    () => zodResolver(createProfileFormSchema(isMentorWatch)),
    [isMentorWatch]
  );

  form.setOptions({ resolver: watchedResolver });

  useEditProfileData({
    form,
    isAuthorized,
    isMentorOnboarding,
    setIsMentor,
    setIsPageLoading,
  });

  const {
    whatIOfferTopicsList,
    expertisedList,
    interestedPositionList,
    interestedSkillsList,
    interestedTopicsList,
  } = useProfileSelectOptions({
    topics,
    expertises,
    interestedPositions,
    skills,
  });

  const { onSubmit, isSaving } = useProfileSubmit({
    pageUserId,
    isMentorOnboarding,
    session,
    updateSession,
    jobSectionError,
    educationSectionError,
  });

  if (!isAuthorized) return null;
  if (isPageLoading) return null;

  const handleGoToPrev = () => {
    router.push(`/profile/${pageUserId}`);
  };

  return (
    <div className="mx-auto w-11/12 max-w-[1064px] pb-20 pt-10">
      <EditPageHeader isSaving={isSaving} onBack={handleGoToPrev} />

      <Form {...form}>
        <form
          id="edit-profile-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-10"
        >
          <AvatarSection
            control={form.control}
            name="avatarFile"
            avatarUrl={
              form.watch('avatar')
                ? `${form.watch('avatar')}?cb=${session?.user?.avatarUpdatedAt ?? 0}`
                : ''
            }
          />

          <Section
            title={
              <>
                <span className="text-status-200">* </span>姓名
              </>
            }
          >
            <TextField form={form} name="name" placeholder="請填入您的姓名" />
          </Section>

          {isMentor && (
            <Section
              title={
                <>
                  <span className="text-status-200">* </span>我能提供的服務
                </>
              }
            >
              <MultiSelectField
                form={form}
                name="what_i_offer"
                options={whatIOfferTopicsList}
                placeholder="我能提供的服務"
                variant="primaryAlt"
                animation={2}
                maxCount={3}
              />
            </Section>
          )}

          {isMentor && (
            <Section
              title={
                <>
                  <span className="text-status-200">* </span>專業能力
                </>
              }
            >
              <MultiSelectField
                form={form}
                name="expertises"
                options={expertisedList}
                placeholder="專業能力"
                variant="primaryAlt"
                animation={2}
                maxCount={3}
              />
            </Section>
          )}

          <Section
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
            title={
              <>
                <span className="text-status-200">* </span>產業
              </>
            }
          >
            <SelectField
              form={form}
              name="industry"
              placeholder="請選擇產業"
              options={industries.map((loc) => ({
                value: loc.subject_group,
                label: loc.subject,
              }))}
            />
          </Section>

          <Section
            title={
              <>
                {isMentor && <span className="text-status-200">* </span>}
                自我介紹
              </>
            }
          >
            <TextareaField form={form} name="about" rows={6} />
          </Section>

          <Section
            title={
              <>
                <span className="text-status-200">* </span>有興趣多了解的職位
              </>
            }
          >
            <MultiSelectField
              form={form}
              name="interested_positions"
              options={interestedPositionList}
              placeholder="有興趣多了解的職位"
              variant="primaryAlt"
              animation={2}
              maxCount={3}
            />
          </Section>

          <Section
            title={
              <>
                <span className="text-status-200">* </span>想多了解、加強的技能
              </>
            }
          >
            <MultiSelectField
              form={form}
              name="skills"
              options={interestedSkillsList}
              placeholder="想多了解、加強的技能"
              variant="primaryAlt"
              animation={2}
              maxCount={3}
            />
          </Section>

          <Section
            title={
              <>
                <span className="text-status-200">* </span>想多了解的主題
              </>
            }
          >
            <MultiSelectField
              form={form}
              name="topics"
              options={interestedTopicsList}
              placeholder="想多了解的主題"
              variant="primaryAlt"
              animation={2}
              maxCount={3}
            />
          </Section>

          <JobExperienceSection
            industries={industries}
            locations={locations}
            form={form}
            isMentor={isMentor}
            onValidationChange={setJobSectionError}
          />

          <EducationSection
            form={form}
            isMentor={isMentor}
            onValidationChange={setEducationSectionError}
          />

          <LinksSection form={form} />
        </form>
      </Form>
    </div>
  );
}
