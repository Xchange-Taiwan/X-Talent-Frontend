import { describe, expect, it } from 'vitest';

import {
  createProfileFormSchema,
  defaultValues,
  educationSchema,
  jobSchema,
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

  it('mentor with neither avatar nor avatarFile fails with 請上傳真人照片，預設頭像僅供預覽', () => {
    const result = createProfileFormSchema(true).safeParse({
      ...baseData,
      ...mentorRequiredFields,
      avatar: '',
      avatarFile: undefined,
    });
    expect(result.success).toBe(false);
    const issue = result.error!.issues.find((i) => i.path[0] === 'avatarFile');
    expect(issue?.message).toBe('請上傳真人照片，預設頭像僅供預覽');
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

  it('enforces max 20 characters on name', () => {
    const atLimit = createProfileFormSchema(false).safeParse({
      ...baseData,
      name: '王'.repeat(20),
    });
    expect(atLimit.success).toBe(true);

    const overLimit = createProfileFormSchema(false).safeParse({
      ...baseData,
      name: '王'.repeat(21),
    });
    expect(overLimit.success).toBe(false);
    expect(
      overLimit.error?.issues.some(
        (i) => i.path[0] === 'name' && i.message === '最多不可超過 20 字'
      )
    ).toBe(true);
  });

  it('enforces max 10 items on have_topic and have_skill for mentees', () => {
    const elevenItems = Array.from({ length: 11 }, (_, idx) => `item-${idx}`);
    const result = createProfileFormSchema(false).safeParse({
      ...baseData,
      have_topic: elevenItems,
      have_skill: elevenItems,
    });
    expect(result.success).toBe(false);
    const issues = result.error!.issues;
    expect(
      issues.some(
        (i) => i.path[0] === 'have_topic' && i.message === '最多選 10 個'
      )
    ).toBe(true);
    expect(
      issues.some(
        (i) => i.path[0] === 'have_skill' && i.message === '最多選 10 個'
      )
    ).toBe(true);
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

describe('jobSchema and educationSchema chronological period rules (#898)', () => {
  const validJob = {
    id: 1,
    job: '資深前端工程師',
    company: 'XChange',
    job_period_start: '2020',
    job_period_end: '2023',
    industry: '軟體業',
    job_location: 'TWN',
    description: '負責系統架構設計',
  };

  it('rejects work experience when start year is greater than end year', () => {
    const result = jobSchema.safeParse({
      ...validJob,
      job_period_start: '2024',
      job_period_end: '2021',
    });
    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some(
        (i) =>
          i.path[0] === 'job_period_end' &&
          i.message === '開始年份不可大於結束年份'
      )
    ).toBe(true);
  });

  it('accepts work experience when start === end or end === "now"', () => {
    expect(
      jobSchema.safeParse({
        ...validJob,
        job_period_start: '2024',
        job_period_end: '2024',
      }).success
    ).toBe(true);
    expect(
      jobSchema.safeParse({
        ...validJob,
        job_period_start: '2024',
        job_period_end: 'now',
      }).success
    ).toBe(true);
  });

  it('rejects education entry when start year is greater than end year and accepts "now"', () => {
    const invalid = educationSchema.safeParse({
      ...baseEducation,
      school: '國立臺灣大學',
      education_period_start: '2025',
      education_period_end: '2021',
    });
    expect(invalid.success).toBe(false);
    expect(
      invalid.error?.issues.some(
        (i) =>
          i.path[0] === 'education_period_end' &&
          i.message === '開始年份不可大於結束年份'
      )
    ).toBe(true);

    const ongoing = educationSchema.safeParse({
      ...baseEducation,
      school: '國立臺灣大學',
      education_period_start: '2025',
      education_period_end: 'now',
    });
    expect(ongoing.success).toBe(true);
  });

  it('requires at least one work experience and education for mentors with expected messages', () => {
    const result = createProfileFormSchema(true).safeParse({
      ...baseData,
      ...mentorRequiredFields,
      avatar: 'https://example.com/avatar.png',
      work_experiences: [],
      educations: [],
    });
    expect(result.success).toBe(false);
    const issues = result.error!.issues;
    expect(
      issues.some(
        (i) =>
          i.path[0] === 'work_experiences' &&
          i.message === '請填寫至少一項工作經歷'
      )
    ).toBe(true);
    expect(
      issues.some(
        (i) => i.path[0] === 'educations' && i.message === '請填寫至少一項學歷'
      )
    ).toBe(true);
  });
});

describe('createProfileFormSchema Option A Mentor vs Mentee rules (#959)', () => {
  it('blocks mentor with preset illustration avatar and returns 請上傳真人照片，預設頭像僅供預覽', () => {
    const result = createProfileFormSchema(true).safeParse({
      ...baseData,
      ...mentorRequiredFields,
      avatar: '/avatars/default_1.webp',
      avatarFile: undefined,
    });
    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((i) => i.path[0] === 'avatarFile');
    expect(issue?.message).toBe('請上傳真人照片，預設頭像僅供預覽');
  });

  it('allows mentor to save even when hidden Mentee want_* arrays are empty', () => {
    const result = createProfileFormSchema(true).safeParse({
      ...baseData,
      ...mentorRequiredFields,
      avatar: 'https://example.com/real-photo.jpg',
      want_position: [],
      want_skill: [],
      want_topic: [],
    });
    expect(result.success).toBe(true);
  });

  it('allows mentee to save with only name filled (location, years_of_experience, and want_* optional)', () => {
    const result = createProfileFormSchema(false).safeParse({
      ...defaultValues,
      name: '陳小華',
      avatar: '/avatars/default_3.webp',
      location: '',
      years_of_experience: '',
      want_position: [],
      want_skill: [],
      want_topic: [],
    });
    expect(result.success).toBe(true);
  });

  it('locks mentee want_position to single-select (max 1) until backend want_direction_map lands (#966)', () => {
    const result = createProfileFormSchema(false).safeParse({
      ...defaultValues,
      name: '陳小華',
      want_position: ['intl_trade', 'ad_creative'],
      want_skill: ['system_performance'],
      want_topic: ['upward_management'],
    });
    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some(
        (i) =>
          i.path[0] === 'want_position' &&
          i.message === '目前僅開放選擇 1 個職位方向'
      )
    ).toBe(true);
  });

  it('blocks mentee save when a position direction is selected (e.g. 廣告創意) without any skill or topic', () => {
    const blocked = createProfileFormSchema(false).safeParse({
      ...defaultValues,
      name: '陳小華',
      want_position: ['ad_creative'],
      want_skill: [],
      want_topic: [],
    });
    expect(blocked.success).toBe(false);
    expect(
      blocked.error?.issues.some(
        (i) =>
          i.path[0] === 'want_skill' &&
          i.message ===
            '已選擇職位方向時，請至少選擇一項想加強的技能或想了解的主題'
      )
    ).toBe(true);

    const skillOnly = createProfileFormSchema(false).safeParse({
      ...defaultValues,
      name: '陳小華',
      want_position: ['ad_creative'],
      want_skill: ['copywriting'],
      want_topic: [],
    });
    expect(skillOnly.success).toBe(true);

    const topicOnly = createProfileFormSchema(false).safeParse({
      ...defaultValues,
      name: '陳小華',
      want_position: ['ad_creative'],
      want_skill: [],
      want_topic: ['career_planning'],
    });
    expect(topicOnly.success).toBe(true);
  });
});

it('enforces agreed_guidelines === true during mentor onboarding (D-1, #961)', () => {
  const blocked = createProfileFormSchema(true, true).safeParse({
    ...baseData,
    ...mentorRequiredFields,
    avatar: 'https://example.com/real-photo.jpg',
    agreed_guidelines: false,
  });
  expect(blocked.success).toBe(false);
  expect(
    blocked.error?.issues.some(
      (i) =>
        i.path[0] === 'agreed_guidelines' &&
        i.message === '請先閱讀並勾選同意導師規範'
    )
  ).toBe(true);

  const passed = createProfileFormSchema(true, true).safeParse({
    ...baseData,
    ...mentorRequiredFields,
    avatar: 'https://example.com/real-photo.jpg',
    agreed_guidelines: true,
  });
  expect(passed.success).toBe(true);
});
