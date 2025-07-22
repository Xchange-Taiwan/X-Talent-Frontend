import * as z from 'zod';

//--------------------------------------------------
// 🗃️ Form Schema & Types
//--------------------------------------------------

export const educationSchema = z.object({
  id: z.number().int(),
  subject: z.string().min(1, '請輸入主修'),
  school: z.string().min(1, '請選擇學校'),
  educationPeriodStart: z.string().min(1, '請選擇開始年份'),
  educationPeriodEnd: z.string().min(1, '請選擇結束年份'),
});

export const jobSchema = z.object({
  id: z.number().int(),
  job: z.string(),
  company: z.string(),
  jobPeriodStart: z.string(),
  jobPeriodEnd: z.string(),
  industry: z.string(),
  jobLocation: z.string(),
  description: z.string(),
});

export const personLinkSchema = z.object({
  id: z.number().int(),
  platform: z.string(),
  url: z.string(),
});

const isBrowser = typeof window !== 'undefined';
export const createProfileFormSchema = (isMentor: boolean) =>
  z.object({
    avatarFile: isBrowser ? z.instanceof(File).optional() : z.any().optional(),
    name: z.string().min(1, '請輸入姓名').max(20, '最多不可超過 20 字'),
    location: z.string({ required_error: '請選擇地區' }),
    statement: z.string(),
    about: isMentor ? z.string().min(1, '請填寫關於我') : z.string().optional(),
    industry: z.string(),
    years_of_experience: z.string({ required_error: '請選擇經驗' }),
    work_experiences: isMentor
      ? z.array(jobSchema).min(1, '請填寫至少一項工作經歷')
      : z.array(jobSchema),
    educations: isMentor
      ? z.array(educationSchema).min(1, '請填寫至少一項學歷')
      : z.array(educationSchema),
    linkedin: personLinkSchema,
    facebook: personLinkSchema,
    instagram: personLinkSchema,
    twitter: personLinkSchema,
    youtube: personLinkSchema,
    website: personLinkSchema,
    what_i_offer: z.array(z.string()),
    expertises: z.array(z.string()),
    interested_positions: z.array(z.string()).min(1, '請至少選擇一個職位'),
    skills: z.array(z.string()).min(1, '請至少選擇一個技能'),
    topics: z.array(z.string()).min(1, '請至少選擇一個主題'),
  });

export type ProfileFormValues = z.infer<
  ReturnType<typeof createProfileFormSchema>
>;

export const defaultValues: ProfileFormValues = {
  avatarFile: undefined,
  name: '',
  location: '',
  statement: '',
  about: '',
  industry: '',
  years_of_experience: '',
  work_experiences: [],
  educations: [],
  linkedin: { id: -1, url: '', platform: 'linkedin' },
  facebook: { id: -1, url: '', platform: 'facebook' },
  instagram: { id: -1, url: '', platform: 'instagram' },
  twitter: { id: -1, url: '', platform: 'twitter' },
  youtube: { id: -1, url: '', platform: 'youtube' },
  website: { id: -1, url: '', platform: 'website' },
  what_i_offer: [],
  expertises: [],
  interested_positions: [],
  skills: [],
  topics: [],
};
