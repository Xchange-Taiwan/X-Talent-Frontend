import * as z from 'zod';

export const quickReplyFormSchema = z.object({
  reply: z.string().trim().max(500, '回覆訊息請勿超過 500 字').optional(),
});

export type QuickReplyFormValues = z.infer<typeof quickReplyFormSchema>;
