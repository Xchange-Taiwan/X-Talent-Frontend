import * as z from 'zod';

import { isPresetAvatarUrl } from '@/lib/avatar/avatarUrl';
import {
  createEmptySocialLinks,
  socialLinksFormSchema,
} from '@/lib/profile/socialLinks';
import {
  educationSchema,
  jobSchema,
  MENTEE_MAX_WANT_POSITIONS,
  validateAvatarFile,
} from '@/schemas/profileSchema';

const isBrowser = typeof window !== 'undefined';

export const onboardingRoleSchema = z.enum(['mentee', 'mentor']);
export type OnboardingRole = z.infer<typeof onboardingRoleSchema>;

const avatarFileField = (isBrowser ? z.instanceof(File) : z.custom<File>())
  .optional()
  .superRefine((f, ctx) => {
    const err = validateAvatarFile(f);
    if (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err,
      });
    }
  });

const onboardingNameField = z
  .string()
  .min(1, '請輸入姓名')
  .max(20, '最多不可超過 20 字');
const onboardingLocationField = z
  .string({ required_error: '請選擇地區' })
  .min(1, '請選擇地區');
const onboardingYearsField = z.string().min(1, '請選擇您的年資區間');
const onboardingPositionField = z
  .array(z.string())
  .min(1, '請至少選擇一個職位')
  .max(MENTEE_MAX_WANT_POSITIONS, '目前僅開放選擇 1 個職位方向');
const onboardingSkillField = z
  .array(z.string())
  .min(1, '請至少選擇一個技能')
  .max(10, '最多選 10 個');
const onboardingTopicField = z
  .array(z.string())
  .min(1, '請至少選擇一個主題')
  .max(10, '最多選 10 個');

export const step1Schema = z.object({
  name: onboardingNameField,
  avatar: z.string().optional(),
  avatarFile: avatarFileField,
  language: z.string().optional(),
});

export const step2Schema = z.object({
  location: onboardingLocationField,
  years_of_experience: onboardingYearsField,
  industry: z.string().optional(),
});

export const step3Schema = z.object({
  want_position: onboardingPositionField,
});

export const step4Schema = z.object({
  want_skill: onboardingSkillField,
});

export const step5Schema = z.object({
  want_topic: onboardingTopicField,
});

export const onboardingFormSchema = z
  .object({
    role: onboardingRoleSchema.optional(),
    name: onboardingNameField,
    avatar: z.string().optional(),
    avatarFile: avatarFileField,
    language: z.string().optional(),
    agreed_guidelines: z.boolean().optional(),
    location: onboardingLocationField,
    years_of_experience: onboardingYearsField,
    industry: z.string().optional(),
    about: z.string().optional(),
    want_position: z.array(z.string()),
    want_skill: z.array(z.string()).max(10, '最多選 10 個'),
    want_topic: z.array(z.string()).max(10, '最多選 10 個'),
    have_topic: z.array(z.string()).max(10, '最多選 10 個').optional(),
    have_skill: z.array(z.string()).max(10, '最多選 10 個').optional(),
    work_experiences: z.array(jobSchema).optional(),
    educations: z.array(educationSchema).optional(),
    links: socialLinksFormSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'mentor') {
      if (data.agreed_guidelines !== true) {
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
      if ((data.have_topic ?? []).length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['have_topic'],
          message: '請至少選擇一個主題',
        });
      }
      if ((data.have_skill ?? []).length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['have_skill'],
          message: '請至少選擇一個技能',
        });
      }
      if ((data.work_experiences ?? []).length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['work_experiences'],
          message: '請填寫至少一項工作經歷',
        });
      }
      if ((data.educations ?? []).length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['educations'],
          message: '請填寫至少一項學歷',
        });
      }
      return;
    }

    if (data.want_position.length < 1) {
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
  });

export const formSchema = onboardingFormSchema;

export type OnboardingFormInput = z.input<typeof onboardingFormSchema>;
export type OnboardingFormValues = z.infer<typeof onboardingFormSchema>;

export const onboardingDefaultValues: OnboardingFormValues = {
  role: 'mentee',
  name: '',
  avatar: '',
  avatarFile: undefined,
  language: 'zh_TW',
  agreed_guidelines: false,
  location: 'TWN',
  years_of_experience: '',
  industry: '',
  about: '',
  want_position: [],
  want_skill: [],
  want_topic: [],
  have_topic: [],
  have_skill: [],
  work_experiences: [],
  educations: [],
  links: createEmptySocialLinks(),
};
