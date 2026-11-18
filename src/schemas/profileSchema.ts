import * as z from 'zod';

import { isPresetAvatarUrl } from '@/lib/avatar/avatarUrl';
import {
  createEmptySocialLinks,
  socialLinksFormSchema,
} from '@/lib/profile/socialLinks';

//--------------------------------------------------
// 🗃️ Form Schema & Types
//--------------------------------------------------

function isEndBeforeStart(start: string, end: string): boolean {
  if (!start || !end || end === 'now') return false;
  const startYear = Number(start);
  const endYear = Number(end);
  if (Number.isNaN(startYear) || Number.isNaN(endYear)) return false;
  return startYear > endYear;
}

export const educationSchema = z
  .object({
    id: z.number().int(),
    subject: z.string(),
    school: z.string().trim(),
    education_period_start: z.string(),
    education_period_end: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.subject.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['subject'],
        message: '請輸入主修',
      });
    }
    if (data.school.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['school'],
        message: '請選擇學校',
      });
    } else if (data.school.length > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['school'],
        message: '學校名稱不可超過 100 字',
      });
    }
    if (data.education_period_start.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['education_period_start'],
        message: '請選擇開始年份',
      });
    }
    if (data.education_period_end.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['education_period_end'],
        message: '請選擇結束年份',
      });
    } else if (
      data.education_period_start.length > 0 &&
      isEndBeforeStart(data.education_period_start, data.education_period_end)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['education_period_end'],
        message: '開始年份不可大於結束年份',
      });
    }
  });

export const jobSchema = z
  .object({
    id: z.number().int(),
    job: z.string(),
    company: z.string(),
    job_period_start: z.string(),
    job_period_end: z.string(),
    industry: z.string(),
    job_location: z.string(),
    description: z.string(),
    is_primary: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.job.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['job'],
        message: '請輸入職稱',
      });
    }
    if (data.company.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['company'],
        message: '請輸入公司名稱',
      });
    }
    if (data.job_period_start.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['job_period_start'],
        message: '請選擇開始年份',
      });
    }
    if (data.job_period_end.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['job_period_end'],
        message: '請選擇結束年份',
      });
    } else if (
      data.job_period_start.length > 0 &&
      isEndBeforeStart(data.job_period_start, data.job_period_end)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['job_period_end'],
        message: '開始年份不可大於結束年份',
      });
    }
    if (data.industry.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['industry'],
        message: '請輸入產業類別',
      });
    }
    if (data.job_location.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['job_location'],
        message: '請輸入工作地點',
      });
    }
    if (data.description.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['description'],
        message: '請輸入工作內容',
      });
    }
  });

export const ALLOWED_AVATAR_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export const MAX_AVATAR_FILE_BYTES = 5 * 1024 * 1024;

export function validateAvatarFile(
  file: File | undefined | null
): string | null {
  if (!file) return null;
  if (!(ALLOWED_AVATAR_MIME_TYPES as readonly string[]).includes(file.type)) {
    return '只允許 jpg / png / gif / webp';
  }
  if (file.size > MAX_AVATAR_FILE_BYTES) {
    return '頭像檔案大小不可超過 5MB';
  }
  return null;
}

export const createProfileFormSchema = (isMentor: boolean) =>
  z
    .object({
      avatar: z.string().optional(),
      avatarFile: z
        .union([z.instanceof(File), z.undefined()])
        .optional()
        .superRefine((f, ctx) => {
          const errorMsg = validateAvatarFile(f);
          if (errorMsg) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: errorMsg,
            });
          }
        }),
      name: z.string().min(1, '請輸入姓名').max(20, '最多不可超過 20 字'),
      location: isMentor
        ? z.string().min(1, '請選擇地區')
        : z.string().optional(),
      statement: z.string().optional(),
      about: isMentor
        ? z.string().min(1, '請填寫關於我')
        : z.string().optional(),
      industry: isMentor
        ? z.string().min(1, '請選擇產業')
        : z.string().optional(),
      years_of_experience: isMentor
        ? z.string({ required_error: '請選擇經驗' }).min(1, '請選擇經驗')
        : z.string().optional(),
      work_experiences: isMentor
        ? z.array(jobSchema).min(1, '請填寫至少一項工作經歷')
        : z.array(jobSchema),
      educations: isMentor
        ? z.array(educationSchema).min(1, '請填寫至少一項學歷')
        : z.array(educationSchema),
      links: socialLinksFormSchema,
      is_mentor: z.boolean().optional(),
      onboarding: z.boolean().optional(),

      have_topic: isMentor
        ? z
            .array(z.string())
            .min(1, '請至少選擇一個主題')
            .max(10, '最多選 10 個')
        : z.array(z.string()).max(10, '最多選 10 個'),
      have_skill: isMentor
        ? z
            .array(z.string())
            .min(1, '請至少選擇一個技能')
            .max(10, '最多選 10 個')
        : z.array(z.string()).max(10, '最多選 10 個'),

      want_position: z.array(z.string()).max(10, '最多選 10 個'),
      want_skill: z.array(z.string()).max(10, '最多選 10 個'),
      want_topic: z.array(z.string()).max(10, '最多選 10 個'),
    })
    .superRefine((data, ctx) => {
      if (isMentor && !data.avatarFile) {
        if (!data.avatar || isPresetAvatarUrl(data.avatar)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['avatarFile'],
            message: '請上傳真人照片，預設頭像僅供預覽',
          });
        }
      }
    });

export type ProfileFormSchema = ReturnType<typeof createProfileFormSchema>;
export type ProfileFormInput = z.input<ProfileFormSchema>;
export type ProfileFormValues = z.infer<ProfileFormSchema>;

export const defaultValues: ProfileFormValues = {
  avatar: '',
  avatarFile: undefined,
  name: '',
  location: '',
  statement: '',
  about: '',
  industry: '',
  years_of_experience: '',
  is_mentor: false,
  onboarding: false,
  work_experiences: [],
  educations: [],
  links: createEmptySocialLinks(),
  have_topic: [],
  have_skill: [],
  want_position: [],
  want_skill: [],
  want_topic: [],
};
