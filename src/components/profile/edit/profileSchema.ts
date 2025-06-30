import * as z from 'zod';

//--------------------------------------------------
// 🗃️ Form Schema & Types
//--------------------------------------------------

const educationSchema = z.object({
  subject: z.string().min(1, '請輸入主修'),
  school: z.string().min(1, '請選擇學校'),
  educationPeriodStart: z.string().min(1, '請選擇開始年份'),
  educationPeriodEnd: z.string().min(1, '請選擇結束年份'),
});

const jobSchema = z.object({
  job: z.string(),
  company: z.string(),
  jobPeriodStart: z.string(),
  jobPeriodEnd: z.string(),
  industry: z.string(),
  jobLocation: z.string(),
  description: z.string(),
});

export const formSchema = z.object({
  avatarFile: z.instanceof(File).optional(),
  name: z.string().min(1, '請輸入姓名').max(20, '最多不可超過 20 字'),
  region: z.string({ required_error: '請選擇地區' }),
  statement: z.string(),
  about: z.string(),
  industry: z.string(),
  years_of_experience: z.string({ required_error: '請選擇經驗' }),
  jobs: z.array(jobSchema).min(1, '請至少填寫一筆工作經驗'),
  educations: z.array(educationSchema).min(1, '請至少填寫一筆教育資料'),
  linkedin: z.string(),
  facebook: z.string(),
  instagram: z.string(),
  twitter: z.string(),
  youtube: z.string(),
  website: z.string(),
});

export type ProfileFormValues = z.infer<typeof formSchema>;

export const defaultValues: ProfileFormValues = {
  avatarFile: undefined,
  name: '',
  region: '',
  statement: '',
  about: '',
  industry: '',
  years_of_experience: '',
  jobs: [
    {
      job: '',
      company: '',
      jobPeriodStart: '',
      jobPeriodEnd: '',
      industry: '',
      jobLocation: '',
      description: '',
    },
  ],
  educations: [
    {
      subject: '',
      school: '',
      educationPeriodStart: '',
      educationPeriodEnd: '',
    },
  ],
  linkedin: '',
  facebook: '',
  instagram: '',
  twitter: '',
  youtube: '',
  website: '',
};
