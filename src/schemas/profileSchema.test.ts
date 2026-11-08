import { describe, expect, it } from 'vitest';

import {
  createProfileFormSchema,
  defaultValues,
  educationSchema,
} from '@/schemas/profileSchema';

const mentorRequiredFields = {
  about: '關於我',
  industry: '軟體業',
  have_topic: ['topic-1'],
  have_skill: ['skill-1'],
  work_experiences: [
    {
      id: 1,
      job: '工程師',
      company: '公司',
      job_period_start: '2020',
      job_period_end: '2021',
      industry: '軟體業',
      job_location: '台北',
      description: '工作內容',
    },
  ],
  educations: [
    {
      id: 1,
      subject: '資工',
      school: '學校',
      education_period_start: '2016',
      education_period_end: '2020',
    },
  ],
};

const baseData = {
  ...defaultValues,
  name: '測試使用者',
  location: 'TWN',
  years_of_experience: '3',
  want_position: ['position-1'],
  want_skill: ['skill-1'],
  want_topic: ['topic-1'],
};

describe('createProfileFormSchema mentor avatar requirement', () => {
  it('mentor with an existing avatar URL passes', () => {
    const result = createProfileFormSchema(true).safeParse({
      ...baseData,
      ...mentorRequiredFields,
      avatar: 'https://example.com/avatar.png',
      avatarFile: undefined,
    });
    expect(result.success).toBe(true);
  });

  it('mentor with a newly uploaded avatarFile passes', () => {
    const result = createProfileFormSchema(true).safeParse({
      ...baseData,
      ...mentorRequiredFields,
      avatar: '',
      avatarFile: new File(['avatar'], 'avatar.png', { type: 'image/png' }),
    });
    expect(result.success).toBe(true);
  });

  it('mentor with neither avatar nor avatarFile fails with 請上傳個人頭像', () => {
    const result = createProfileFormSchema(true).safeParse({
      ...baseData,
      ...mentorRequiredFields,
      avatar: '',
      avatarFile: undefined,
    });
    expect(result.success).toBe(false);
    const issue = result.error!.issues.find((i) => i.path[0] === 'avatarFile');
    expect(issue?.message).toBe('請上傳個人頭像');
  });

  it('mentee with neither avatar nor avatarFile passes', () => {
    const result = createProfileFormSchema(false).safeParse({
      ...baseData,
      avatar: '',
      avatarFile: undefined,
    });
    expect(result.success).toBe(true);
  });
});

describe('createProfileFormSchema conditional validations (Mentor vs Mentee)', () => {
  it('mentor is validated for required fields', () => {
    const result = createProfileFormSchema(true).safeParse({
      ...baseData,
      ...mentorRequiredFields,
      avatar: 'https://example.com/avatar.png',
      industry: '',
      about: '',
    });
    expect(result.success).toBe(false);
    const issues = result.error!.issues;
    expect(
      issues.some((i) => i.path[0] === 'industry' && i.message === '請選擇產業')
    ).toBe(true);
    expect(
      issues.some((i) => i.path[0] === 'about' && i.message === '請填寫關於我')
    ).toBe(true);
  });

  it('mentor is validated for topic and skill array lengths', () => {
    const result = createProfileFormSchema(true).safeParse({
      ...baseData,
      ...mentorRequiredFields,
      avatar: 'https://example.com/avatar.png',
      have_topic: [],
      have_skill: [],
    });
    expect(result.success).toBe(false);
    const issues = result.error!.issues;
    expect(
      issues.some(
        (i) => i.path[0] === 'have_topic' && i.message === '請至少選擇一個主題'
      )
    ).toBe(true);
    expect(
      issues.some(
        (i) => i.path[0] === 'have_skill' && i.message === '請至少選擇一個技能'
      )
    ).toBe(true);
  });

  it('mentee succeeds without industry, about, topics, or skills', () => {
    const result = createProfileFormSchema(false).safeParse({
      ...baseData,
      avatar: '',
      avatarFile: undefined,
      industry: undefined,
      about: undefined,
      have_topic: [],
      have_skill: [],
    });
    expect(result.success).toBe(true);
  });
});

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
