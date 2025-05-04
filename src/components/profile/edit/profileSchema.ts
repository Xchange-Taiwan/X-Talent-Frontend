import * as z from 'zod';

//--------------------------------------------------
// 🗃️ Form Schema & Types
//--------------------------------------------------

export const formSchema = z.object({
  avatarFile: z.instanceof(File).optional(),
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

export type ProfileFormValues = z.infer<typeof formSchema>;

export const defaultValues: ProfileFormValues = {
  avatarFile: undefined,
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
};
