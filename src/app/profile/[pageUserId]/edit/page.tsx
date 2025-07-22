'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import ArrowBackIcon from '@mui/icons-material/ArrowBackIosNew';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { getSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { totalWorkSpanOptions } from '@/components/onboarding/Steps/constant';
import { AvatarSection } from '@/components/profile/edit/avatarSection';
import { EducationSection } from '@/components/profile/edit/educationSection/educationSection';
import {
  SelectField,
  TextareaField,
  TextField,
} from '@/components/profile/edit/fields';
import { JobExperienceSection } from '@/components/profile/edit/jobExperienceSection';
import { LinksSection } from '@/components/profile/edit/linkSection';
import { MultiSelectField } from '@/components/profile/edit/MultiSelectField';
import {
  createProfileFormSchema,
  defaultValues,
  educationSchema,
  jobSchema,
  personLinkSchema,
  ProfileFormValues,
} from '@/components/profile/edit/profileSchema';
import { Section } from '@/components/profile/edit/section';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import useLocations from '@/hooks/user/country/useLocations';
import useExpertises from '@/hooks/user/expertises/useExpertises';
import useIndustries from '@/hooks/user/industry/useIndustries';
import useInterests from '@/hooks/user/interests/useInterests';
import { ExperienceType } from '@/services/profile/experienceType';
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

export default function Page({
  params: { pageUserId },
}: {
  params: { pageUserId: string };
}) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isMentor, setIsMentor] = useState(false);

  const searchParams = useSearchParams();
  const isMentorOnboarding = searchParams?.get('onboarding') === 'true';
  const [isPageLoading, setIsPageLoading] = useState(true);

  useEffect(() => {
    const verifyUser = async () => {
      const session = await getSession();
      const loginUserId = String(session?.user?.id);

      if (!loginUserId || loginUserId !== pageUserId) {
        router.push('/');
        return;
      }

      setIsAuthorized(true);
    };

    verifyUser();
  }, [pageUserId, router]);

  const { locations } = useLocations('zh_TW');
  const { industries } = useIndustries('zh_TW');
  const { interestedPositions, skills, topics } = useInterests('zh_TW');
  const { expertises } = useExpertises('zh_TW');

  const { ...form } = useForm<ProfileFormValues>({
    resolver: zodResolver(createProfileFormSchema(isMentor)),
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
    experiences: MentorExperiencePayload[],
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
            result[platform] = {
              id,
              platform,
              url,
            };
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

  useEffect(() => {
    async function fetchUserData() {
      try {
        const data = await fetchUser('zh_TW');
        if (data) {
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
            data.experiences as unknown as MentorExperiencePayload[],
          );

          form.reset({
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
            work_experiences:
              parsedExperiences || defaultValues.work_experiences,
            educations: parsedEducations || defaultValues.educations,
          });

          form.setValue(
            'what_i_offer',
            data.topics?.interests?.map((i) => i.subject_group) || [],
          );
          form.setValue(
            'expertises',
            data.expertises?.professions?.map((i) => i.subject_group) || [],
          );
          form.setValue(
            'interested_positions',
            data.interested_positions?.interests?.map((i) => i.subject_group) ||
              [],
          );
          form.setValue(
            'skills',
            data.skills?.interests?.map((i) => i.subject_group) || [],
          );
          form.setValue(
            'topics',
            data.topics?.interests?.map((i) => i.subject_group) || [],
          );
          form.setValue(
            'what_i_offer',
            parseWhatIOffer(
              data.experiences as unknown as MentorExperiencePayload[],
            ),
          );

          setIsMentor(data.is_mentor || isMentorOnboarding);
          setIsPageLoading(false);
        }
      } catch (err) {
        console.error('Fetch User Data Error:', err);
      }
    }

    fetchUserData();
  }, []);

  if (!isAuthorized) {
    return null;
  }

  const handleGoToPrev = () => {
    router.push(`/profile/${pageUserId}`);
  };

  const onSubmit = async (values: ProfileFormValues) => {
    await updateProfile(values);

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

    const links = [
      values.linkedin,
      values.facebook,
      values.instagram,
      values.twitter,
      values.youtube,
      values.website,
    ];

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

    if (isMentorOnboarding) {
      router.push('/profile/card');
    } else {
      handleGoToPrev();
    }
  };

  if (isPageLoading) {
    return null;
  }

  return (
    <div className="mx-auto w-11/12 max-w-[1064px] pb-20 pt-10">
      <div className="mb-10 flex justify-between">
        <div className="flex items-center gap-3">
          <ArrowBackIcon
            className="cursor-pointer sm:hidden"
            onClick={handleGoToPrev}
          />
          <p className="text-4xl font-bold">編輯個人頁面</p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            className="hidden grow rounded-full  px-6 py-3 sm:inline-flex sm:grow-0"
            onClick={handleGoToPrev}
          >
            取消
          </Button>
          <Button
            type="submit"
            variant="default"
            className="grow rounded-full px-6 py-3 sm:grow-0"
            form="edit-profile-form"
          >
            儲存
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
            avatarUrl={''}
          />
          <Section title="姓名">
            <TextField form={form} name="name" placeholder="請填入您的姓名" />
          </Section>

          {isMentor && (
            <Section title="*我能提供的服務">
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
            <Section title="*專業能力">
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

          <Section title="地區">
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

          <Section title="經驗">
            <SelectField
              form={form}
              name="years_of_experience"
              placeholder="請填入您的經驗"
              options={totalWorkSpanOptions}
            />
          </Section>

          <Section title="產業">
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

          <Section title="關於我">
            <TextareaField form={form} name="about" rows={6} />
          </Section>

          <Section title="有興趣多了解的職位">
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

          <Section title="想多了解、加強的技能">
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

          <Section title="想多了解的主題">
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
          />
          <EducationSection form={form} />
          <LinksSection form={form} />
        </form>
      </Form>
    </div>
  );
}
