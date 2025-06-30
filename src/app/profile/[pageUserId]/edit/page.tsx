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
import {
  defaultValues,
  formSchema,
  ProfileFormValues,
} from '@/components/profile/edit/profileSchema';
import { Section } from '@/components/profile/edit/section';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { MultiSelect } from '@/components/ui/multi-select';
import useLocations from '@/hooks/user/country/useLocations';
import useIndustries from '@/hooks/user/industry/useIndustries';
import useInterests from '@/hooks/user/interests/useInterests';
import { fetchUser } from '@/services/user/user';

const onSubmit = (values: z.infer<typeof formSchema>) => {
  console.log(values);
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
  const isOnboarding = searchParams?.get('onboarding') === 'true';

  useEffect(() => {
    const verifyUser = async () => {
      const session = await getSession();
      const loginUserId = String(session?.user?.id);

      if (!loginUserId || loginUserId !== pageUserId) {
        router.push('/');
        return;
      }

      setIsAuthorized(true);
      const isMentorFromSession = session?.user?.isMentor === true;
      setIsMentor(isMentorFromSession || isOnboarding);
    };

    verifyUser();
  }, [pageUserId, router]);

  const { locations } = useLocations('zh_TW');
  const { industries } = useIndustries('zh_TW');
  const { interestedPositions, skills, topics } = useInterests('zh_TW');

  const { reset, ...form } = useForm<ProfileFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const whatIOfferTopicsList = topics.map((topic) => ({
    value: topic.subject_group,
    label: topic.subject,
  }));

  const expertisedList = skills.map((skill) => ({
    value: skill.subject_group,
    label: skill.subject,
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

  const [selectedWhatIOffer, setSelectedWhatIOffer] = useState<string[]>([]);
  const [selectedExpertised, setSelectedExpertised] = useState<string[]>([]);
  const [interestedPosition, setInterestedPosition] = useState<string[]>([]);
  const [interestedSkills, setInterestedSkills] = useState<string[]>([]);
  const [interestedTopics, setInterestedTopics] = useState<string[]>([]);

  useEffect(() => {
    async function fetchUserData() {
      try {
        const data = await fetchUser('zh_TW');
        if (data) {
          reset({
            avatarFile: undefined,
            name: data.name || '',
            region: data.location || '',
            statement: data.personal_statement || '',
            about: data.about || '',
            industry: data.industry?.subject_group || '',
            years_of_experience: data.years_of_experience || '',
            linkedin: '',
            facebook: '',
            instagram: '',
            twitter: '',
            youtube: '',
            website: '',
            jobs:
              data.experiences?.map((job) => ({
                job: job.job_title || '',
                company: job.company || '',
                jobPeriodStart: job.start || '',
                jobPeriodEnd: job.end || '',
                industry: job.industry || '',
                jobLocation: job.location || '',
                description: job.description || '',
              })) || defaultValues.jobs,
            educations: defaultValues.educations,
          });

          setSelectedWhatIOffer(
            data.topics?.interests?.map((i) => i.subject_group) || [],
          );
          setSelectedExpertised(
            data.skills?.interests?.map((i) => i.subject_group) || [],
          );
          setInterestedPosition(
            data.interested_positions?.interests?.map((i) => i.subject_group) ||
              [],
          );
          setInterestedSkills(
            data.skills?.interests?.map((i) => i.subject_group) || [],
          );
          setInterestedTopics(
            data.topics?.interests?.map((i) => i.subject_group) || [],
          );
        }
      } catch (err) {
        console.error('Fetch User Data Error:', err);
      }
    }

    fetchUserData();
  }, [reset]);

  if (!isAuthorized) {
    return null;
  }

  const handleGoToPrev = () => {
    router.push(`/profile/${pageUserId}`);
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
            variant="default"
            className="grow rounded-full px-6 py-3 sm:grow-0"
          >
            儲存
          </Button>
        </div>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
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
              <MultiSelect
                options={whatIOfferTopicsList}
                onValueChange={setSelectedWhatIOffer}
                defaultValue={selectedWhatIOffer}
                placeholder="我能提供的服務"
                variant="primaryAlt"
                animation={2}
                maxCount={3}
              />
            </Section>
          )}

          {isMentor && (
            <Section title="*專業能力">
              <MultiSelect
                options={expertisedList}
                onValueChange={setSelectedExpertised}
                defaultValue={selectedExpertised}
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
              name="region"
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
            <MultiSelect
              options={interestedPositionList}
              onValueChange={setInterestedPosition}
              defaultValue={interestedPosition}
              value={interestedPosition}
              placeholder="有興趣多了解的職位"
              variant="primaryAlt"
              animation={2}
              maxCount={3}
            />
          </Section>

          <Section title="想多了解、加強的技能">
            <MultiSelect
              options={interestedSkillsList}
              onValueChange={setInterestedSkills}
              defaultValue={interestedSkills}
              value={interestedSkills}
              placeholder="想多了解、加強的技能"
              variant="primaryAlt"
              animation={2}
              maxCount={3}
            />
          </Section>

          <Section title="想多了解的主題">
            <MultiSelect
              options={interestedTopicsList}
              onValueChange={setInterestedTopics}
              defaultValue={interestedTopics}
              value={interestedTopics}
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
