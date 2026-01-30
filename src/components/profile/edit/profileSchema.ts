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
  job: z.string().min(1, '請輸入職稱'),
  company: z.string().min(1, '請輸入公司名稱'),
  jobPeriodStart: z.string().min(1, '請選擇開始年份'),
  jobPeriodEnd: z.string().min(1, '請選擇結束年份'),
  industry: z.string().min(1, '請輸入產業類別'),
  jobLocation: z.string().min(1, '請輸入工作地點'),
  description: z.string().min(1, '請輸入工作內容'),
});

export const personLinkSchema = z.object({
  id: z.number().int(),
  platform: z.string(),
  url: z.string(),
});

const isBrowser = typeof window !== 'undefined';
export const createProfileFormSchema = (isMentor: boolean) =>
  z
    .object({
      is_mentor: z.boolean(),
      avatarFile: isBrowser
        ? z.instanceof(File).optional()
        : z.any().optional(),
      name: z.string().min(1, '請輸入姓名').max(20, '最多不可超過 20 字'),
      location: z.string({ required_error: '請選擇地區' }),
      statement: z.string(),
      about: isMentor
        ? z.string().min(1, '請填寫關於我')
        : z.string().optional(),
      industry: z.string(),
      years_of_experience: z.string({ required_error: '請選擇經驗' }),
      work_experiences: z.array(jobSchema),
      educations: z.array(educationSchema),
      linkedin: personLinkSchema,
      facebook: personLinkSchema,
      instagram: personLinkSchema,
      twitter: personLinkSchema,
      youtube: personLinkSchema,
      website: personLinkSchema,
      what_i_offer: isMentor
        ? z.array(z.string()).min(1, '請至少選擇一個主題')
        : z.array(z.string()),
      expertises: isMentor
        ? z.array(z.string()).min(1, '請至少選擇一個技能')
        : z.array(z.string()),
      interested_positions: z.array(z.string()).min(1, '請至少選擇一個職位'),
      skills: z.array(z.string()).min(1, '請至少選擇一個技能'),
      topics: z.array(z.string()).min(1, '請至少選擇一個主題'),
    })
    .superRefine((data, ctx) => {
      if (isMentor) {
        if (data.work_experiences.length < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['work_experiences'],
            message: '請填寫至少一項工作經歷',
          });
        }
        if (data.educations.length < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['educations'],
            message: '請填寫至少一項學歷',
          });
        }
      }
    });

export type ProfileFormValues = z.infer<
  ReturnType<typeof createProfileFormSchema>
>;

export const defaultValues: ProfileFormValues = {
  is_mentor: false,
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
