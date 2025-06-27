import * as z from 'zod';

// It will be used in the future
// const linkedinProfileUrlRegex =
//   /^https:\/\/www\.linkedin\.com\/in\/[a-zA-Z0-9-._~]+\/?$/;

export const step1Schema = z.object({
  name: z.string().min(1, '請輸入姓名').max(20, '最多不可超過 20 字'),
  avatar: z.string().optional(),
  avatarFile: z.instanceof(File).optional(),
  language: z.string().optional(),
});

export const step2Schema = z.object({
  location: z.string({ required_error: '請選擇地區' }),
  years_of_experience: z.string().min(1, '請選擇您的年資區間'),
  industry: z.string({ required_error: '請選擇您的產業類別' }),
  job_title: z.string().optional(),
  company: z.string().optional(),
});

export const step3Schema = z.object({
  interested_positions: z.array(z.string()).min(1, '請至少選擇一個職位'),
});

export const step4Schema = z.object({
  skills: z.array(z.string()).min(1, '請至少選擇一個技能'),
});

export const step5Schema = z.object({
  topics: z.array(z.string()).min(1, '請至少選擇一個主題'),
});

export const formSchema = step1Schema
  .merge(step2Schema)
  .merge(step3Schema)
  .merge(step4Schema)
  .merge(step5Schema);

export { InterestedPosition } from './InterestedPosition';
export { PersonalInfo } from './PersonalInfo';
export { SkillsToImprove } from './SkillsToImprove';
export { TopicsToDiscuss } from './TopicsToDiscuss';
export { WhoAreYou } from './WhoAreYou';
