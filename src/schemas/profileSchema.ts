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
export const MENTEE_MAX_WANT_POSITIONS = 1;

export const onboardingRoleSchema = z.enum(['mentee', 'mentor']);
export type OnboardingRole = z.infer<typeof onboardingRoleSchema>;

export type ProfileFormMode = 'edit' | 'onboarding';

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

const avatarFileSchema = (
  typeof File !== 'undefined'
    ? z.union([z.instanceof(File), z.undefined()])
    : z.custom<File | undefined>((val) => val === undefined)
)
  .optional()
  .superRefine((f, ctx) => {
    const errorMsg = validateAvatarFile(f);
    if (errorMsg) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: errorMsg,
      });
    }
  });

const baseProfileFormObjectSchema = z.object({
  role: onboardingRoleSchema.optional(),
  language: z.string().optional(),
  avatar: z.string().optional(),
  agreed_guidelines: z.boolean().optional(),
  avatarFile: avatarFileSchema,
  name: z.string(),
  location: z.string().optional(),
  statement: z.string().optional(),
  about: z.string().optional(),
  industry: z.string().optional(),
  years_of_experience: z.string().optional(),
  work_experiences: z.array(jobSchema),
  educations: z.array(educationSchema),
  links: socialLinksFormSchema,
  is_mentor: z.boolean().optional(),
  onboarding: z.boolean().optional(),
  have_topic: z.array(z.string()).max(10, '最多選 10 個'),
  have_skill: z.array(z.string()).max(10, '最多選 10 個'),
  want_position: z.array(z.string()).max(10, '最多選 10 個'),
  want_skill: z.array(z.string()).max(10, '最多選 10 個'),
  want_topic: z.array(z.string()).max(10, '最多選 10 個'),
});

export interface CreateProfileFormSchemaOptions {
  mode?: ProfileFormMode;
  requireMenteePosition?: boolean;
}

export const createProfileFormSchema = (
  isMentor = false,
  isMentorOnboarding = false,
  options?: CreateProfileFormSchemaOptions
) => {
  const isOnboardingMode = options?.mode === 'onboarding';

  return baseProfileFormObjectSchema.superRefine((data, ctx) => {
    if (data.name.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['name'],
        message: '請輸入姓名',
      });
    } else if (data.name.length > 20) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['name'],
        message: '最多不可超過 20 字',
      });
    }

    const effectiveIsMentor = isOnboardingMode
      ? data.role === 'mentor'
      : isMentor;

    if (effectiveIsMentor) {
      if (
        (isOnboardingMode || isMentorOnboarding) &&
        data.agreed_guidelines !== true
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['agreed_guidelines'],
          message: '請先閱讀並勾選同意導師規範',
        });
      }
      if (
        !data.avatarFile &&
        (!data.avatar || isPresetAvatarUrl(data.avatar))
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['avatarFile'],
          message: '請上傳真人照片，預設頭像僅供預覽',
        });
      }
      if (!data.location?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['location'],
          message: '請選擇地區',
        });
      }
      if (!data.years_of_experience?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['years_of_experience'],
          message: isOnboardingMode ? '請選擇您的年資區間' : '請選擇經驗',
        });
      }
      if (!data.industry?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['industry'],
          message: '請選擇產業',
        });
      }
      if (!data.about?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['about'],
          message: '請填寫關於我',
        });
      }
      if (data.have_topic.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['have_topic'],
          message: '請至少選擇一個主題',
        });
      }
      if (data.have_skill.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['have_skill'],
          message: '請至少選擇一個技能',
        });
      }
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
      return;
    }

    if (isOnboardingMode) {
      if (!data.location?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['location'],
          message: '請選擇地區',
        });
      }
      if (!data.years_of_experience?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['years_of_experience'],
          message: '請選擇您的年資區間',
        });
      }
    }

    const requireMenteePosition =
      isOnboardingMode || Boolean(options?.requireMenteePosition);
    if (requireMenteePosition && data.want_position.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['want_position'],
        message: '請至少選擇一個職位',
      });
    } else if (data.want_position.length > MENTEE_MAX_WANT_POSITIONS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['want_position'],
        message: '目前僅開放選擇 1 個職位方向',
      });
    }

    if (isOnboardingMode) {
      if (data.want_skill.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['want_skill'],
          message: '請至少選擇一個技能',
        });
      }
      if (data.want_topic.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['want_topic'],
          message: '請至少選擇一個主題',
        });
      }
      return;
    }

    if (
      data.want_position.length > 0 &&
      data.want_skill.length === 0 &&
      data.want_topic.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['want_skill'],
        message: '已選擇職位方向時，請至少選擇一項想加強的技能或想了解的主題',
      });
    }
  });
};

export const onboardingFormSchema = createProfileFormSchema(false, false, {
  mode: 'onboarding',
});

export type ProfileFormSchema = ReturnType<typeof createProfileFormSchema>;
export type ProfileFormInput = z.input<ProfileFormSchema>;
export type ProfileFormValues = z.infer<ProfileFormSchema>;

export const defaultValues: ProfileFormValues = {
  role: undefined,
  language: 'zh_TW',
  avatar: '',
  agreed_guidelines: false,
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

export const onboardingDefaultValues: ProfileFormValues = {
  ...defaultValues,
  role: 'mentee',
  location: 'TWN',
  onboarding: true,
};
