import * as z from 'zod';

const linkedinProfileUrlRegex =
  /^https:\/\/www\.linkedin\.com\/in\/[a-z-]+\/?$/;

export const formSchema = z.object({
  name: z.string().min(1, '請輸入姓名').max(20, '最多不可超過 20 字'),
  region: z.string({ required_error: '請選擇地區' }),
  experience: z.string().optional(),
  industry: z.string().optional(),
  jobTitle: z.string().optional(),
  company: z.string().optional(),
  linkedinUrl: z
    .string()
    .refine(
      (url) => url.length === 0 || linkedinProfileUrlRegex.test(url),
      '請輸入正確的 Linkedin 個人頁面連結',
    )
    .optional(),
  interestedRole: z.array(z.string()),
  skillEnhancementTarget: z.array(z.string()),
  talkTopic: z.array(z.string()),
});

export { InterestedPosition } from './InterestedPosition';
export { PersonalInfo } from './PersonalInfo';
export { SkillsToImprove } from './SkillsToImprove';
export { TopicsToDiscuss } from './TopicsToDiscuss';
export { WhoAreYou } from './WhoAreYou';
