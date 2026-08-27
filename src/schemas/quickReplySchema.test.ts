import { describe, expect, it } from 'vitest';

import { quickReplyFormSchema } from './quickReplySchema';

describe('quickReplyFormSchema', () => {
  it('should pass with a valid reply', () => {
    const result = quickReplyFormSchema.safeParse({
      reply: '屆時於 Google Meet 見,請先準備一份履歷。',
    });
    expect(result.success).toBe(true);
  });

  it('should pass if reply is empty', () => {
    const result = quickReplyFormSchema.safeParse({ reply: '' });
    expect(result.success).toBe(true);
  });

  it('should pass if reply is undefined', () => {
    const result = quickReplyFormSchema.safeParse({ reply: undefined });
    expect(result.success).toBe(true);
  });

  it('should trim whitespace-only replies', () => {
    const result = quickReplyFormSchema.safeParse({ reply: '    \n   ' });
    expect(result.success).toBe(true);
    expect(result.data?.reply).toBe('');
  });

  it('should fail if reply exceeds 500 characters', () => {
    const longReply = 'a'.repeat(501);
    const result = quickReplyFormSchema.safeParse({ reply: longReply });
    expect(result.success).toBe(false);
    const issue = result.error!.issues[0];
    expect(issue.message).toBe('回覆訊息請勿超過 500 字');
  });

  it('should pass if reply is exactly 500 characters', () => {
    const exactReply = 'a'.repeat(500);
    const result = quickReplyFormSchema.safeParse({ reply: exactReply });
    expect(result.success).toBe(true);
  });
});
