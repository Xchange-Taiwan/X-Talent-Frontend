'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { ExpertiseSelectItem } from '@/components/profile/ExpertiseSelectItem';
import { formSchema } from '@/components/profile/ExpertiseSelectItem';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';

const EXPERTISE_SELECTION = [
  'UI Design',
  'UX Design',
  'SEO Writing',
  'Graphic Design',
] as const;

const onSubmit = (values: z.infer<typeof formSchema>) => {
  console.log(values);
};

export default function Page() {
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      expertise: [],
    },
  });

  return (
    <div className="mx-auto w-11/12 max-w-[630px] pb-20 pt-10">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
          <p className="mb-3 text-4xl font-bold">你的專長領域</p>
          <div>
            <div className="grid max-h-[600px] grid-cols-1 gap-4 overflow-scroll">
              {EXPERTISE_SELECTION.map((type) => (
                <ExpertiseSelectItem form={form} key={type} type={type} />
              ))}
            </div>
          </div>
          <div className="flex justify-center gap-4">
            <Button
              variant="outline"
              className="grow rounded-full px-6  py-3 sm:grow-0"
            >
              之後再成為 Mentor
            </Button>
            <Button
              variant="default"
              className="grow rounded-full px-6 py-3 sm:grow-0"
              onClick={() => router.push('/profile/kai')}
            >
              建立我的 Mentor 頁面
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
