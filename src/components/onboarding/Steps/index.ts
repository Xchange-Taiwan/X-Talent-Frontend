import * as z from 'zod';

const linkedinProfileUrlRegex =
  /^https:\/\/www\.linkedin\.com\/in\/[a-zA-Z0-9-._~]+\/?$/;

export const formSchema = z.object({
  name: z.string().min(1, '請輸入姓名').max(20, '最多不可超過 20 字'),
  avatar: z.string().optional(),
  avatarFile: z.instanceof(File).optional(),
  location: z.string({ required_error: '請選擇地區' }),
  years_of_experience: z.string({ required_error: '請選擇您的年資區間' }),
  industry: z.string({ required_error: '請選擇您的產業類別' }),
  job_title: z.string().optional(),
  company: z.string().optional(),
  linkedin_profile: z
    .string()
    .refine(
      (url) => url.length === 0 || linkedinProfileUrlRegex.test(url),
      '請輸入正確的 Linkedin 個人頁面連結',
    )
    .optional(),
  interested_positions: z.array(z.string()),
  skills: z.array(z.string()),
  topics: z.array(z.string()),
  language: z.string().optional(),
});

export { InterestedPosition } from './InterestedPosition';
export { PersonalInfo } from './PersonalInfo';
export { SkillsToImprove } from './SkillsToImprove';
export { TopicsToDiscuss } from './TopicsToDiscuss';
export { WhoAreYou } from './WhoAreYou';
