import * as z from 'zod';

export const formSchema = z.object({
  name: z.string().min(1, '請輸入姓名').max(20, '最多不可超過 20 字'),
  region: z.string({ required_error: '請選擇地區' }),
  totalWorkSpan: z.string().optional(),
  industry: z.string().optional(),
  jobTitle: z.string().optional(),
  company: z.string().optional(),
  school: z.string().min(1, '請輸入學校名稱'),
  linkedin: z.string().optional(),
  interestedRole: z.array(z.string()),
  skillEnhancementTarget: z.array(z.string()),
  talkTopic: z.array(z.string()),
});

export { Step1 } from './Step1';
export { Step2 } from './Step2';
export { Step3 } from './Step3';
export { Step4 } from './Step4';
