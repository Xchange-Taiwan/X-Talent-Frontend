'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import ArrowBackIcon from '@mui/icons-material/ArrowBackIosNew';
import ImageIcon from '@mui/icons-material/ImageOutlined';
import { Pencil1Icon, PlusIcon } from '@radix-ui/react-icons';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const formSchema = z.object({
  name: z.string().min(1, '請輸入姓名').max(20, '最多不可超過 20 字'),
  region: z.string({ required_error: '請選擇地區' }),
  statement: z.string(),
  about: z.string(),
  seniority: z.string({ required_error: '請選擇職務級別' }),
  job: z.string(),
  company: z.string(),
  jobPeriodStart: z.string(),
  jobPeriodEnd: z.string(),
  industry: z.string(),
  jobLocation: z.string(),
  description: z.string(),
  subject: z.string(),
  school: z.string(),
  educationPeriodStart: z.string(),
  educationPeriodEnd: z.string(),
  educationLocation: z.string(),
  linkedin: z.string(),
  facebook: z.string(),
  instagram: z.string(),
  twitter: z.string(),
  youtube: z.string(),
  website: z.string(),
});

const onSubmit = (values: z.infer<typeof formSchema>) => {
  console.log(values);
};

export default function Page() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      region: '',
      statement: '',
      about: '',
      seniority: '',
      job: '',
      company: '',
      jobPeriodStart: '',
      jobPeriodEnd: '',
      industry: '',
      jobLocation: '',
      description: '',
      subject: '',
      school: '',
      educationPeriodStart: '',
      educationPeriodEnd: '',
      educationLocation: '',
      linkedin: '',
      facebook: '',
      instagram: '',
      twitter: '',
      youtube: '',
      website: '',
    },
  });
  const handleUploadAvatar = () => {
    alert('TODO: upload avatar');
  };
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
          <div className="flex flex-col border-t-2 border-solid border-background-border pt-10 lg:flex-row">
            <div className="max-w-80 grow">
              <p className="mb-4 text-xl font-bold">個人頭像</p>
            </div>
            <div>
              <div
                className="relative flex h-32 w-32 cursor-pointer items-center justify-center rounded-full border-2 border-[#B7CBCB] bg-[#F4FCFC] p-5"
                onClick={handleUploadAvatar}
              >
                <ImageIcon sx={{ fontSize: 80, color: '#B7CBCB' }} />
                <div className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border border-solid border-background-border bg-background-white">
                  <Pencil1Icon />
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col border-t-2 border-solid border-background-border pt-10 lg:flex-row">
            <div className="max-w-80 grow">
              <p className="mb-4 text-xl font-bold">姓名</p>
            </div>
            <div className="grow">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="請填入您的姓名" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
          <div className="flex flex-col border-t-2 border-solid border-background-border pt-10 lg:flex-row">
            <div className="max-w-80 grow">
              <p className="mb-4 text-xl font-bold">Personal Statement</p>
            </div>
            <div className="grow">
              <FormField
                control={form.control}
                name="statement"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
          <div className="flex flex-col border-t-2 border-solid border-background-border pt-10 lg:flex-row">
            <div className="max-w-80 grow">
              <p className="mb-4 text-xl font-bold">關於我</p>
            </div>
            <div className="grow">
              <FormField
                control={form.control}
                name="about"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea {...field} className="h-48" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
          <div className="flex flex-col border-t-2 border-solid border-background-border pt-10 lg:flex-row">
            <div className="max-w-80 grow">
              <p className="mb-4 text-xl font-bold">職務級別</p>
            </div>
            <div className="grow">
              <FormField
                control={form.control}
                name="seniority"
                render={({ field }) => (
                  <FormItem>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="請填入您的職務級別" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={'junior'}>junior</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
          <div className="flex flex-col border-t-2 border-solid border-background-border pt-10 lg:flex-row">
            <div className="max-w-80 grow">
              <p className="mb-4 text-xl font-bold">工作經驗</p>
            </div>
            <div className="grow">
              <div className="block grow gap-6 md:flex">
                <FormField
                  control={form.control}
                  name="job"
                  render={({ field }) => (
                    <FormItem className="mb-4 grow">
                      <FormLabel>職稱</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem className="mb-4 grow">
                      <FormLabel>公司名稱</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="block grow md:flex">
                <FormField
                  control={form.control}
                  name="jobPeriodStart"
                  render={({ field }) => (
                    <FormItem className="mb-0 grow basis-1/2 md:mb-4">
                      <FormLabel>Period</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Start" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={'2024'}>2024</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <p className="relative bottom-[-8px] mx-2 my-auto hidden text-center md:block">
                  ~
                </p>
                <p className="relative bottom-[-8px] mx-2 my-auto text-center text-sm md:hidden">
                  to
                </p>
                <FormField
                  control={form.control}
                  name="jobPeriodEnd"
                  render={({ field }) => (
                    <FormItem className="my-4 grow basis-1/2 md:mb-4 md:mt-0">
                      <FormLabel className="hidden md:inline-block">
                        &nbsp;
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="present" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={'now'}>now</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="block grow gap-6 md:flex">
                <FormField
                  control={form.control}
                  name="industry"
                  render={({ field }) => (
                    <FormItem className="mb-4 grow basis-1/2">
                      <FormLabel>產業</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="請填入您的產業" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={'金融業'}>金融業Ｆ</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="jobLocation"
                  render={({ field }) => (
                    <FormItem className="mb-4 grow basis-1/2">
                      <FormLabel>地點</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="請填入您的地點" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={'台北'}>台北</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grow">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>描述</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="h-24" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button
                variant="ghost"
                className="mt-4 grow rounded-full px-4 py-3 text-brand-500 sm:grow-0"
              >
                <PlusIcon className="mr-2 h-5 w-5" />
                新增
              </Button>
            </div>
          </div>
          <div className="flex flex-col border-t-2 border-solid border-background-border pt-10 lg:flex-row">
            <div className="max-w-80 grow">
              <p className="mb-4 text-xl font-bold">教育</p>
            </div>
            <div className="grow">
              <div className="block grow gap-6 md:flex">
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem className="mb-4 grow">
                      <FormLabel>主修</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="school"
                  render={({ field }) => (
                    <FormItem className="mb-4 grow">
                      <FormLabel>學校名稱</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="block grow gap-6 md:flex">
                <div className="block grow basis-1/2 md:flex">
                  <FormField
                    control={form.control}
                    name="educationPeriodStart"
                    render={({ field }) => (
                      <FormItem className="mb-0 grow basis-1/2 sm:mb-4">
                        <FormLabel>Period</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Start" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={'2024'}>2024</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <p className="relative bottom-[-8px] mx-2 my-auto hidden text-center md:block">
                    ~
                  </p>
                  <p className="relative bottom-[-8px] mx-2 my-auto text-center text-sm md:hidden">
                    to
                  </p>
                  <FormField
                    control={form.control}
                    name="educationPeriodEnd"
                    render={({ field }) => (
                      <FormItem className="my-4 grow basis-1/2 sm:mb-4 sm:mt-0">
                        <FormLabel className="hidden sm:inline-block">
                          &nbsp;
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="present" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={'now'}>now</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="educationLocation"
                  render={({ field }) => (
                    <FormItem className="mb-4 grow basis-1/2">
                      <FormLabel>地點</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="請填入您的地點" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={'台北'}>台北</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button
                variant="ghost"
                className="mt-4 grow rounded-full px-4 py-3 text-brand-500 sm:grow-0"
              >
                <PlusIcon className="mr-2 h-5 w-5" />
                新增
              </Button>
            </div>
          </div>
          <div className="flex flex-col border-t-2 border-solid border-background-border pt-10 lg:flex-row">
            <div className="max-w-80 grow">
              <p className="mb-4 text-xl font-bold">個人連結</p>
            </div>
            <div className="grow">
              <FormField
                control={form.control}
                name="linkedin"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel>Linkedin</FormLabel>
                    <div className="flex items-center">
                      <div className="mr-3 h-5 w-5 bg-[url('/profile/edit/facebook-logo.svg')] bg-contain bg-no-repeat"></div>
                      <FormControl>
                        <Input
                          placeholder="請填入您的連結"
                          {...field}
                          className="!m-auto"
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="facebook"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel>Facebook</FormLabel>
                    <div className="flex items-center">
                      <div className="mr-3 h-5 w-5 bg-[url('/profile/edit/linkedin-logo.svg')] bg-contain bg-no-repeat"></div>
                      <FormControl>
                        <Input
                          placeholder="請填入您的連結"
                          {...field}
                          className="!m-auto"
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="instagram"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel>Instagram</FormLabel>
                    <div className="flex items-center">
                      <div className="mr-3 h-5 w-5 bg-[url('/profile/edit/instagram-logo.svg')] bg-contain bg-no-repeat"></div>
                      <FormControl>
                        <Input
                          placeholder="請填入您的連結"
                          {...field}
                          className="!m-auto"
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="twitter"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel>X (fomerly twitter)</FormLabel>
                    <div className="flex items-center">
                      <div className="mr-3 h-5 w-5 bg-[url('/profile/edit/twitter-logo.svg')] bg-contain bg-no-repeat"></div>
                      <FormControl>
                        <Input
                          placeholder="請填入您的連結"
                          {...field}
                          className="!m-auto"
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="youtube"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel>Youtube</FormLabel>
                    <div className="flex items-center">
                      <div className="mr-3 h-5 w-5 bg-[url('/profile/edit/youtube-logo.svg')] bg-contain bg-no-repeat"></div>
                      <FormControl>
                        <Input
                          placeholder="請填入您的連結"
                          {...field}
                          className="!m-auto"
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>個人網站</FormLabel>
                    <div className="flex items-center">
                      <div className="mr-3 h-5 w-5 bg-[url('/profile/edit/website-logo.svg')] bg-contain bg-no-repeat"></div>
                      <FormControl>
                        <Input
                          placeholder="請填入您的連結"
                          {...field}
                          className="!m-auto"
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
