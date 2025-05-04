'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import ArrowBackIcon from '@mui/icons-material/ArrowBackIosNew';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { AvatarSection } from '@/components/profile/edit/avatarSection';
import { EducationSection } from '@/components/profile/edit/educationSection';
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

const onSubmit = (values: z.infer<typeof formSchema>) => {
  console.log(values);
};

export default function Page() {
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const handleGoToPrev = () => {};
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

          <Section title="Personal Statement">
            <TextField form={form} name="statement" />
          </Section>

          <Section title="關於我">
            <TextareaField form={form} name="about" rows={6} />
          </Section>

          <Section title="職務級別">
            <SelectField
              form={form}
              name="seniority"
              placeholder="請填入您的職務級別"
              options={[{ label: 'junior', value: 'junior' }]}
            />
          </Section>

          <JobExperienceSection form={form} />
          <EducationSection form={form} />
          <LinksSection form={form} />
        </form>
      </Form>
    </div>
  );
}
