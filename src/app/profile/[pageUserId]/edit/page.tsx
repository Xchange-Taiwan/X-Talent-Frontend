'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import ArrowBackIcon from '@mui/icons-material/ArrowBackIosNew';
import { Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { totalWorkSpanOptions } from '@/components/onboarding/steps/constant';
import { AvatarSection } from '@/components/profile/edit/AvatarSection';
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
  educationSchema,
  jobSchema,
  personLinkSchema,
  ProfileFormValues,
} from '@/components/profile/edit/profileSchema';
import { Section } from '@/components/profile/edit/Section';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import useLocations from '@/hooks/user/country/useLocations';
import useExpertises from '@/hooks/user/expertises/useExpertises';
import useIndustries from '@/hooks/user/industry/useIndustries';
import useInterests from '@/hooks/user/interests/useInterests';
import { ExperienceType } from '@/services/profile/experienceType';
import { updateAvatar } from '@/services/profile/updateAvatar';
import { updateProfile } from '@/services/profile/updateProfile';
import {
  MentorExperiencePayload,
  upsertMentorExperience,
} from '@/services/profile/upsertExperience';
import { fetchUser } from '@/services/profile/user';

type EducationFormValue = z.infer<typeof educationSchema>;
type WorkExperienceFormValue = z.infer<typeof jobSchema>;
type PersonLinkFormValue = z.infer<typeof personLinkSchema>;

type MentorExperienceMetadata<T> = {
  data?: T[];
};

type WhatIOfferMetadata = {
  subject_group: string;
};

function isProfileSynced(
  values: ProfileFormValues,
  latest: UserDTO,
  avatar: string
): boolean {
  if (latest.name !== values.name) return false;
  if ((latest.location ?? '') !== (values.location ?? '')) return false;
  if ((latest.personal_statement ?? '') !== (values.statement ?? ''))
    return false;
  if ((latest.about ?? '') !== (values.about ?? '')) return false;
  if ((latest.years_of_experience ?? '') !== (values.years_of_experience ?? ''))
    return false;
  if ((latest.industry?.subject_group ?? '') !== (values.industry ?? ''))
    return false;
  if (avatar && latest.avatar !== avatar) return false;
  return true;
}

export default function Page({
  params: { pageUserId },
}: {
  params: { pageUserId: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMentorOnboarding = searchParams?.get('onboarding') === 'true';

  const { data: session, status, update: updateSession } = useSession();

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isMentor, setIsMentor] = useState(false);

  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [jobSectionError, setJobSectionError] = useState(false);
  const [educationSectionError, setEducationSectionError] = useState(false);

  // ---- authorization (client-side guard) ----
  useEffect(() => {
    if (status === 'loading') return;

    const loginUserId = session?.user?.id ? String(session.user.id) : '';

    if (!loginUserId || loginUserId !== pageUserId) {
      router.push('/');
      return;
    }

    setIsAuthorized(true);
  }, [pageUserId, router, session?.user?.id, status]);

  const { locations } = useLocations('zh_TW');
  const { industries } = useIndustries('zh_TW');
  const { interestedPositions, skills, topics } = useInterests('zh_TW');
  const { expertises } = useExpertises('zh_TW');

  const resolver = useMemo(
    () => zodResolver(createProfileFormSchema(isMentor)),
    [isMentor]
  );

  const form = useForm<ProfileFormValues>({
    resolver,
    defaultValues,
  });

  const whatIOfferTopicsList = topics.map((topic) => ({
    value: topic.subject_group,
    label: topic.subject,
  }));

  const expertisedList = expertises.map((expertise) => ({
    value: expertise.subject_group,
    label: expertise.subject,
  }));

  const interestedPositionList = interestedPositions.map((skill) => ({
    value: skill.subject_group,
    label: skill.subject,
  }));

  const interestedSkillsList = skills.map((skill) => ({
    value: skill.subject_group,
    label: skill.subject,
  }));

  const interestedTopicsList = topics.map((skill) => ({
    value: skill.subject_group,
    label: skill.subject,
  }));

  function parseLinks(
    experiences: MentorExperiencePayload[]
  ): Partial<
    Record<
      'linkedin' | 'facebook' | 'instagram' | 'twitter' | 'youtube' | 'website',
      PersonLinkFormValue
    >
  > {
    const result: Partial<
      Record<
        | 'linkedin'
        | 'facebook'
        | 'instagram'
        | 'twitter'
        | 'youtube'
        | 'website',
        PersonLinkFormValue
      >
    > = {};

    experiences
      ?.filter((e) => e.category === 'LINK')
      .forEach((e) => {
        const metadata =
          e.mentor_experiences_metadata as MentorExperienceMetadata<PersonLinkFormValue>;
        const entries = metadata?.data || [];

        entries.forEach((entry) => {
          const platform = entry.platform as keyof typeof result;
          const url = entry.url || '';
          const id = e.id ?? -1;

          if (
            platform &&
            [
              'linkedin',
              'facebook',
              'instagram',
              'twitter',
              'youtube',
              'website',
            ].includes(platform)
          ) {
            result[platform] = { id, platform, url };
          }
        });
      });

    return result;
  }

  function parseWhatIOffer(experiences: MentorExperiencePayload[]): string[] {
    const whatIOffer = experiences.find((e) => e.category === 'WHAT_I_OFFER');
    const metadata =
      whatIOffer?.mentor_experiences_metadata as MentorExperienceMetadata<WhatIOfferMetadata>;

    return metadata?.data?.map((item) => item.subject_group) || [];
  }

  // ---- fetch page data only after authorized ----
  useEffect(() => {
    if (!isAuthorized) return;

    let cancelled = false;

    async function fetchUserData() {
      try {
        const data = await fetchUser('zh_TW');
        if (!data || cancelled) return;

        const mentorFlag = Boolean(data.is_mentor || isMentorOnboarding);

        const parsedExperiences = data.experiences
          ?.filter((e) => e.category === 'WORK')
          .flatMap((e): WorkExperienceFormValue[] => {
            const metadata =
              e.mentor_experiences_metadata as MentorExperienceMetadata<WorkExperienceFormValue>;
            const entries = metadata?.data || [];

            return entries.map((item) => ({
              id: typeof e.id === 'number' ? e.id : -1,
              job: item.job || '',
              company: item.company || '',
              jobPeriodStart: item.jobPeriodStart || '',
              jobPeriodEnd: item.jobPeriodEnd || '',
              industry: item.industry || '',
              jobLocation: item.jobLocation || '',
              description: item.description || '',
            }));
          });

        const parsedEducations = data.experiences
          ?.filter((e) => e.category === 'EDUCATION')
          .flatMap((e): EducationFormValue[] => {
            const metadata =
              e.mentor_experiences_metadata as MentorExperienceMetadata<EducationFormValue>;
            const entries = metadata?.data || [];

            return entries.map((item) => ({
              id: typeof e.id === 'number' ? e.id : -1,
              school: item.school || '',
              subject: item.subject || '',
              educationPeriodStart: item.educationPeriodStart || '',
              educationPeriodEnd: item.educationPeriodEnd || '',
            }));
          });

        const parsedLinks = parseLinks(
          data.experiences as unknown as MentorExperiencePayload[]
        );

        form.reset({
          is_mentor: mentorFlag,
          avatar: data.avatar || '',
          avatarFile: undefined,
          name: data.name || '',
          location: data.location || '',
          statement: data.personal_statement || '',
          about: data.about || '',
          industry: data.industry?.subject_group || '',
          years_of_experience: data.years_of_experience || '',
          linkedin: parsedLinks.linkedin || defaultValues.linkedin,
          facebook: parsedLinks.facebook || defaultValues.facebook,
          instagram: parsedLinks.instagram || defaultValues.instagram,
          twitter: parsedLinks.twitter || defaultValues.twitter,
          youtube: parsedLinks.youtube || defaultValues.youtube,
          website: parsedLinks.website || defaultValues.website,
          work_experiences: parsedExperiences || defaultValues.work_experiences,
          educations: parsedEducations || defaultValues.educations,
        });

        form.setValue(
          'expertises',
          data.expertises?.professions?.map((i) => i.subject_group) || []
        );
        form.setValue(
          'interested_positions',
          data.interested_positions?.interests?.map((i) => i.subject_group) ||
            []
        );
        form.setValue(
          'skills',
          data.skills?.interests?.map((i) => i.subject_group) || []
        );
        form.setValue(
          'topics',
          data.topics?.interests?.map((i) => i.subject_group) || []
        );
        form.setValue(
          'what_i_offer',
          parseWhatIOffer(
            data.experiences as unknown as MentorExperiencePayload[]
          )
        );

        setIsMentor(mentorFlag);
        setIsPageLoading(false);
      } catch (err) {
        // 你可以加 toast
        console.error('Fetch User Data Error:', err);
      }
    }

    fetchUserData();

    return () => {
      cancelled = true;
    };
  }, [form, isAuthorized, isMentorOnboarding]);

  if (!isAuthorized) return null;
  if (isPageLoading) return null;

  const handleGoToPrev = () => {
    router.push(`/profile/${pageUserId}`);
  };

  const onSubmit = async (values: ProfileFormValues) => {
    if (jobSectionError || educationSectionError) return;

    try {
      setIsSaving(true);

      // 1) avatar upload (if any)
      let avatar = values.avatar;
      if (values.avatarFile) {
        const newUrl = await updateAvatar(values.avatarFile);
        avatar = newUrl ?? avatar;
      }

      // 2) profile update
      const payload = { ...values, avatar, avatarFile: undefined };
      await updateProfile(payload);

      // 3) upsert experiences (keep your original logic)
      if (values.work_experiences?.length > 0) {
        await upsertMentorExperience(ExperienceType.WORK, true, {
          id: 1,
          category: ExperienceType.WORK,
          mentor_experiences_metadata: {
            data: values.work_experiences.map((item) => ({
              job: item.job,
              company: item.company,
              jobPeriodStart: item.jobPeriodStart,
              jobPeriodEnd: item.jobPeriodEnd,
              industry: item.industry,
              jobLocation: item.jobLocation,
              description: item.description,
            })),
          },
          order: 1,
        });
      }

      if (values.educations?.length > 0) {
        await upsertMentorExperience(ExperienceType.EDUCATION, true, {
          id: 2,
          category: ExperienceType.EDUCATION,
          mentor_experiences_metadata: {
            data: values.educations.map((item) => ({
              school: item.school,
              subject: item.subject,
              educationPeriodStart: item.educationPeriodStart,
              educationPeriodEnd: item.educationPeriodEnd,
            })),
          },
          order: 2,
        });
      }

      const links = [
        values.linkedin,
        values.facebook,
        values.instagram,
        values.twitter,
        values.youtube,
        values.website,
      ].filter((l) => l && l.url);

      if (links.length > 0) {
        await upsertMentorExperience(ExperienceType.LINK, true, {
          id: 3,
          category: ExperienceType.LINK,
          mentor_experiences_metadata: {
            data: links.map((link) => ({
              platform: link.platform,
              url: link.url,
            })),
          },
          order: 3,
        });
      }

      if (values.what_i_offer?.length > 0) {
        await upsertMentorExperience(ExperienceType.WHAT_I_OFFER, true, {
          id: 4,
          category: ExperienceType.WHAT_I_OFFER,
          mentor_experiences_metadata: {
            data: values.what_i_offer.map((item) => ({
              subject_group: item,
            })),
          },
          order: 4,
        });
      }

      // 4) poll until backend reflects all updated fields (up to 1 min, every 5s)
      let latest = await fetchUser('zh_TW');
      const MAX_RETRIES = 12;
      for (
        let i = 1;
        i < MAX_RETRIES && !(latest && isProfileSynced(values, latest, avatar));
        i++
      ) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        latest = await fetchUser('zh_TW');
      }

      // 5) update next-auth session (requires jwt trigger update handler!)
      await updateSession({
        user: {
          // keep id from current session
          id: session?.user?.id,
          name: latest?.name ?? values.name ?? session?.user?.name,
          avatar: latest?.avatar ?? avatar ?? session?.user?.avatar,
          avatarUpdatedAt: values.avatarFile
            ? Date.now()
            : session?.user?.avatarUpdatedAt,
          isMentor: Boolean(latest?.is_mentor),
          onBoarding: Boolean(latest?.onboarding),
          msg: session?.user?.msg,
        },
      });

      // 6) navigate
      if (isMentorOnboarding) {
        router.push('/profile/card');
      } else {
        handleGoToPrev();
      }
    } catch (err) {
      console.error('Update Profile Error:', err);
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto w-11/12 max-w-[1064px] pb-20 pt-10">
      <div className="mb-10 flex justify-between">
        <div className="flex items-center gap-3">
          <ArrowBackIcon
            className={`sm:hidden ${isSaving ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
            onClick={isSaving ? undefined : handleGoToPrev}
          />
          <p className="text-4xl font-bold">編輯個人頁面</p>
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            className="hidden grow rounded-full px-6 py-3 sm:inline-flex sm:grow-0"
            onClick={handleGoToPrev}
            disabled={isSaving}
          >
            取消
          </Button>

          <Button
            type="submit"
            variant="default"
            className="grow rounded-full px-6 py-3 sm:grow-0"
            form="edit-profile-form"
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                儲存中...
              </>
            ) : (
              '儲存'
            )}
          </Button>
        </div>
      </div>

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
