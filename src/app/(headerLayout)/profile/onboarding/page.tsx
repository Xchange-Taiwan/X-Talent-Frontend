'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import OnboardingCoverImgUrl from '@/assets/auth/onboarding-cover.png';
import {
  formSchema,
  Step1,
  Step2,
  Step3,
  Step4,
} from '@/components/onboarding/Steps';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Progress } from '@/components/ui/progress';
import { useMultiStepForm } from '@/hooks/useMultiStepForm';

export default function Page() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      region: undefined,
      totalWorkSpan: undefined,
      industry: undefined,
      jobTitle: '',
      company: '',
      school: '',
      linkedin: '',
      interestedRole: [],
      skillEnhancementTarget: [],
      talkTopic: [],
    },
  });

  const { stepElement, progress, goToNext } = useMultiStepForm([
    <Step1 key="Step1" form={form} />,
    <Step2 key="Step2" form={form} />,
    <Step3 key="Step3" form={form} />,
    <Step4 key="Step4" form={form} />,
  ]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    console.log(values);

    goToNext();
  };

  return (
    <div className="relative">
      <Progress
        className="fixed inset-x-0 top-[70px] z-10 h-2 rounded-none bg-white text-zinc-100"
        value={progress * 100}
      />

      <div className="flex">
        <div className="hidden flex-1 lg:block">
          <div
            className="fixed top-[70px] h-[calc(100vh-70px)] w-1/2 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${OnboardingCoverImgUrl.src})` }}
          />
        </div>
        <div className="flex-1">
          <div className="mx-auto max-w-[600px] px-5 py-20">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-8"
              >
                {stepElement}
                <div className="mt-10 flex justify-end">
                  <Button className="rounded-xl px-12" type="submit">
                    下一步
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}
