import { describe, expect, it } from 'vitest';

import { educationSchema } from './profileSchema';

const baseEducation = {
  id: 1,
  subject: '資工',
  education_period_start: '2016',
  education_period_end: '2020',
};

describe('educationSchema school field (free-text school name)', () => {
  it('trims surrounding whitespace from the school name', () => {
    const result = educationSchema.safeParse({
      ...baseEducation,
      school: '  MIT  ',
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.school).toBe('MIT');
  });

  it('rejects a school name that is only whitespace', () => {
    const result = educationSchema.safeParse({
      ...baseEducation,
      school: '   ',
    });
    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some(
        (i) => i.path[0] === 'school' && i.message === '請選擇學校'
      )
    ).toBe(true);
  });

  it('accepts a school name at the 100 character limit', () => {
    const result = educationSchema.safeParse({
      ...baseEducation,
      school: 'A'.repeat(100),
    });
    expect(result.success).toBe(true);
  });

  it('rejects a school name over the 100 character limit', () => {
    const result = educationSchema.safeParse({
      ...baseEducation,
      school: 'A'.repeat(101),
    });
    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some(
        (i) => i.path[0] === 'school' && i.message === '學校名稱不可超過 100 字'
      )
    ).toBe(true);
  });
});
