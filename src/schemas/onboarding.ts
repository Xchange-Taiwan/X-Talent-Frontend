import * as z from 'zod';

const isBrowser = typeof window !== 'undefined';

export const step1Schema = z.object({
  name: z.string().min(1, '請輸入姓名').max(20, '最多不可超過 20 字'),
  avatar: z.string().optional(),
  avatarFile: isBrowser ? z.instanceof(File).optional() : z.any().optional(),
  language: z.string().optional(),
});

export const step2Schema = z.object({
  location: z.string({ required_error: '請選擇地區' }),
  years_of_experience: z.string().min(1, '請選擇您的年資區間'),
  industry: z.string().optional(),
});

export const step3Schema = z.object({
  want_position: z
    .array(z.string())
    .min(1, '請至少選擇一個職位')
    .max(10, '最多選 10 個'),
});

export const step4Schema = z.object({
  want_skill: z
    .array(z.string())
    .min(1, '請至少選擇一個技能')
    .max(10, '最多選 10 個'),
});

export const step5Schema = z.object({
  want_topic: z
    .array(z.string())
    .min(1, '請至少選擇一個主題')
    .max(10, '最多選 10 個'),
});

export const formSchema = step1Schema
  .merge(step2Schema)
  .merge(step3Schema)
  .merge(step4Schema)
  .merge(step5Schema);
