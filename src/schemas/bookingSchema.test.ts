import { describe, expect, it } from 'vitest';

import { bookingFormSchema } from './bookingSchema';

describe('bookingFormSchema', () => {
  it('should pass with a valid question', () => {
    const result = bookingFormSchema.safeParse({
      bookingQuestion: 'Hello, I want to learn React and TypeScript!',
    });
    expect(result.success).toBe(true);
  });

  it('should fail if question is empty', () => {
    const result = bookingFormSchema.safeParse({
      bookingQuestion: '',
    });
    expect(result.success).toBe(false);
    const issue = result.error!.issues[0];
    expect(issue.message).toBe('請輸入你想問導師的問題');
  });

  it('should fail and trim whitespace-only questions', () => {
    const result = bookingFormSchema.safeParse({
      bookingQuestion: '    \n   ',
    });
    expect(result.success).toBe(false);
    const issue = result.error!.issues[0];
    expect(issue.message).toBe('請輸入你想問導師的問題');
  });

  it('should fail if question exceeds 1000 characters', () => {
    const longQuestion = 'a'.repeat(1001);
    const result = bookingFormSchema.safeParse({
      bookingQuestion: longQuestion,
    });
    expect(result.success).toBe(false);
    const issue = result.error!.issues[0];
    expect(issue.message).toBe('問題字數請勿超過 1000 字');
  });

  it('should pass if question is exactly 1000 characters', () => {
    const exactQuestion = 'a'.repeat(1000);
    const result = bookingFormSchema.safeParse({
      bookingQuestion: exactQuestion,
    });
    expect(result.success).toBe(true);
  });
});
