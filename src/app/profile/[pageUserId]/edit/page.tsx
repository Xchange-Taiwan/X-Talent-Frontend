'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import ArrowBackIcon from '@mui/icons-material/ArrowBackIosNew';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { getSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
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
import {
  defaultValues,
  educationSchema,
  jobSchema,
  personLinkSchema,
  profileFormSchema,
  ProfileFormValues,
} from '@/components/profile/edit/profileSchema';
import { Section } from '@/components/profile/edit/section';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { MultiSelect } from '@/components/ui/multi-select';
import useLocations from '@/hooks/user/country/useLocations';
import useExpertises from '@/hooks/user/expertises/useExpertises';
import useIndustries from '@/hooks/user/industry/useIndustries';
import useInterests from '@/hooks/user/interests/useInterests';
import { deleteExperience } from '@/services/profile/deleteExperience';
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

type BaseExperience = {
  id: number;
};

function diffExperienceArray<T extends BaseExperience>(
  oldData: T[],
  newData: T[],
) {
  const oldMap = new Map(oldData.map((item) => [item.id, item]));
  const newMap = new Map(newData.map((item) => [item.id, item]));

  const toDelete = oldData.filter((old) => !newMap.has(old.id));
  const toCreate = newData.filter((item) => item.id === -1);
  const toUpdate = newData.filter((item) => {
    const old = oldMap.get(item.id);
    return (
      item.id !== -1 && old && JSON.stringify(old) !== JSON.stringify(item)
    );
  });

  return { toDelete, toCreate, toUpdate };
}

export default function Page({
  params: { pageUserId },
}: {
  params: { pageUserId: string };
}) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isMentor, setIsMentor] = useState(false);

  const searchParams = useSearchParams();
  const isOnboarding = searchParams?.get('onboarding') === 'true';

  const [originalWorkExperiences, setOriginalWorkExperiences] = useState<
    WorkExperienceFormValue[]
  >([]);
  const [originalEducations, setOriginalEducations] = useState<
    EducationFormValue[]
  >([]);

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
    resolver: zodResolver(profileFormSchema),
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
          e.mentor_experiences_metadata as Partial<PersonLinkFormValue>;
        const platform = metadata.platform as keyof typeof result;
        const url = metadata.url || '';
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

    return result;
  }

  useEffect(() => {
    async function fetchUserData() {
      try {
        const data = await fetchUser('zh_TW');
        if (data) {
          const parsedExperiences = data.experiences
            ?.filter((e) => e.category === 'WORK')
            .map((e): WorkExperienceFormValue => {
              const metadata =
                e.mentor_experiences_metadata as Partial<WorkExperienceFormValue>;
              return {
                id: typeof e.id === 'number' ? e.id : -1,
                job: metadata.job || '',
                company: metadata.company || '',
                jobPeriodStart: metadata.jobPeriodStart || '',
                jobPeriodEnd: metadata.jobPeriodEnd || '',
                industry: metadata.industry || '',
                jobLocation: metadata.jobLocation || '',
                description: metadata.description || '',
              };
            });

          const parsedEducations = data.experiences
            ?.filter((e) => e.category === 'EDUCATION')
            .map((e): EducationFormValue => {
              const metadata =
                e.mentor_experiences_metadata as Partial<EducationFormValue>;
              return {
                id: typeof e.id === 'number' ? e.id : -1,
                school: metadata.school || '',
                subject: metadata.subject || '',
                educationPeriodStart: metadata.educationPeriodStart || '',
                educationPeriodEnd: metadata.educationPeriodEnd || '',
              };
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

          setOriginalWorkExperiences(parsedExperiences || []);
          setOriginalEducations(parsedEducations || []);

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

          setIsMentor(data.is_mentor || isOnboarding);
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

  const onSubmit = async (values: z.infer<typeof profileFormSchema>) => {
    console.log(values);

    updateProfile(values);

    const {
      toDelete: workToDelete,
      toCreate: workToCreate,
      toUpdate: workToUpdate,
    } = diffExperienceArray(originalWorkExperiences, values.work_experiences);

    await Promise.all(
      workToDelete.map((item) =>
        deleteExperience(ExperienceType.WORK, item.id, true),
      ),
    );
    await Promise.all(
      workToCreate.map((item, idx) =>
        upsertMentorExperience(ExperienceType.WORK, true, {
          category: ExperienceType.WORK,
          mentor_experiences_metadata: {
            job: item.job,
            company: item.company,
            jobPeriodStart: item.jobPeriodStart,
            jobPeriodEnd: item.jobPeriodEnd,
            industry: item.industry,
            jobLocation: item.jobLocation,
            description: item.description,
          },
          order: idx,
        }),
      ),
    );
    await Promise.all(
      workToUpdate.map((item, idx) =>
        upsertMentorExperience(ExperienceType.WORK, true, {
          id: item.id,
          category: ExperienceType.WORK,
          mentor_experiences_metadata: {
            job: item.job,
            company: item.company,
            jobPeriodStart: item.jobPeriodStart,
            jobPeriodEnd: item.jobPeriodEnd,
            industry: item.industry,
            jobLocation: item.jobLocation,
            description: item.description,
          },
          order: idx,
        }),
      ),
    );

    const {
      toDelete: eduToDelete,
      toCreate: eduToCreate,
      toUpdate: eduToUpdate,
    } = diffExperienceArray(originalEducations, values.educations);

    await Promise.all(
      eduToDelete.map((item) =>
        deleteExperience(ExperienceType.EDUCATION, item.id, true),
      ),
    );
    await Promise.all(
      eduToCreate.map((item, idx) =>
        upsertMentorExperience(ExperienceType.EDUCATION, true, {
          category: ExperienceType.EDUCATION,
          mentor_experiences_metadata: {
            school: item.school,
            subject: item.subject,
            educationPeriodStart: item.educationPeriodStart,
            educationPeriodEnd: item.educationPeriodEnd,
          },
          order: idx,
        }),
      ),
    );
    await Promise.all(
      eduToUpdate.map((item, idx) =>
        upsertMentorExperience(ExperienceType.EDUCATION, true, {
          id: item.id,
          category: ExperienceType.EDUCATION,
          mentor_experiences_metadata: {
            school: item.school,
            subject: item.subject,
            educationPeriodStart: item.educationPeriodStart,
            educationPeriodEnd: item.educationPeriodEnd,
          },
          order: idx,
        }),
      ),
    );

    const links = [
      values.linkedin,
      values.facebook,
      values.instagram,
      values.twitter,
      values.youtube,
      values.website,
    ];

    await Promise.all(
      links.map((link, idx) => {
        const metadata = {
          platform: link.platform,
          url: link.url,
        };

        const payload: MentorExperiencePayload = {
          category: ExperienceType.LINK,
          mentor_experiences_metadata: metadata,
          order: idx,
        };

        // 如果沒有填 url 而且是舊資料（有 id），就刪除
        if (!link.url && link.id !== -1) {
          return deleteExperience(ExperienceType.LINK, link.id, true);
        }

        // 有填 url，就 upsert
        if (link.url) {
          if (link.id !== -1) {
            payload.id = link.id;
          }
          return upsertMentorExperience(ExperienceType.LINK, isMentor, payload);
        }

        // 全新空白 link，什麼都不做
        return Promise.resolve();
      }),
    );
  };

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
              <Controller
                control={form.control}
                name="what_i_offer"
                render={({ field }) => (
                  <MultiSelect
                    {...field}
                    options={whatIOfferTopicsList}
                    placeholder="我能提供的服務"
                    variant="primaryAlt"
                    animation={2}
                    maxCount={3}
                  />
                )}
              />
            </Section>
          )}

          {isMentor && (
            <Section title="*專業能力">
              <Controller
                control={form.control}
                name="expertises"
                render={({ field }) => (
                  <MultiSelect
                    {...field}
                    options={expertisedList}
                    placeholder="專業能力"
                    variant="primaryAlt"
                    animation={2}
                    maxCount={3}
                  />
                )}
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
            <Controller
              control={form.control}
              name="interested_positions"
              render={({ field }) => (
                <MultiSelect
                  {...field}
                  options={interestedPositionList}
                  placeholder="有興趣多了解的職位"
                  variant="primaryAlt"
                  animation={2}
                  maxCount={3}
                />
              )}
            />
          </Section>

          <Section title="想多了解、加強的技能">
            <Controller
              control={form.control}
              name="skills"
              render={({ field }) => (
                <MultiSelect
                  {...field}
                  options={interestedSkillsList}
                  placeholder="想多了解、加強的技能"
                  variant="primaryAlt"
                  animation={2}
                  maxCount={3}
                />
              )}
            />
          </Section>

          <Section title="想多了解的主題">
            <Controller
              control={form.control}
              name="topics"
              render={({ field }) => (
                <MultiSelect
                  {...field}
                  options={interestedTopicsList}
                  placeholder="想多了解的主題"
                  variant="primaryAlt"
                  animation={2}
                  maxCount={3}
                />
              )}
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
