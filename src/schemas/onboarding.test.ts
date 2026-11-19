import { describe, expect, it } from 'vitest';

import {
  formSchema,
  onboardingDefaultValues,
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
} from './onboarding';

describe('onboarding schemas', () => {
  describe('step1Schema', () => {
    it('passes with valid name, language and empty avatar/file', () => {
      const result = step1Schema.safeParse({
        name: 'John Doe',
        language: 'zh_TW',
      });
      expect(result.success).toBe(true);
    });

    it('fails if name is empty', () => {
      const result = step1Schema.safeParse({
        name: '',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('請輸入姓名');
      }
    });

    it('fails if name exceeds 20 characters', () => {
      const result = step1Schema.safeParse({
        name: 'A'.repeat(21),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('最多不可超過 20 字');
      }
    });

    it('accepts File instance for avatarFile', () => {
      const file = new File([''], 'test.png', { type: 'image/png' });
      const result = step1Schema.safeParse({
        name: 'John Doe',
        avatarFile: file,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('step2Schema', () => {
    it('passes with valid location and years of experience', () => {
      const result = step2Schema.safeParse({
        location: 'TWN',
        years_of_experience: '1_3',
        industry: 'TECH',
      });
      expect(result.success).toBe(true);
    });

    it('fails if location is missing', () => {
      const result = step2Schema.safeParse({
        years_of_experience: '1_3',
      });
      expect(result.success).toBe(false);
    });

    it('fails if years_of_experience is empty', () => {
      const result = step2Schema.safeParse({
        location: 'TWN',
        years_of_experience: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('step3Schema', () => {
    it('passes with 1 to 10 positions', () => {
      const result = step3Schema.safeParse({
        want_position: ['position1'],
      });
      expect(result.success).toBe(true);
    });

    it('fails with empty positions list', () => {
      const result = step3Schema.safeParse({
        want_position: [],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('請至少選擇一個職位');
      }
    });

    it('fails if positions list exceeds 1 item (single-select lock #966)', () => {
      const result = step3Schema.safeParse({
        want_position: ['position1', 'position2'],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe(
          '目前僅開放選擇 1 個職位方向'
        );
      }
    });
  });

  describe('step4Schema', () => {
    it('passes with 1 to 10 skills', () => {
      const result = step4Schema.safeParse({
        want_skill: ['skill1'],
      });
      expect(result.success).toBe(true);
    });

    it('fails with empty skills list', () => {
      const result = step4Schema.safeParse({
        want_skill: [],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('請至少選擇一個技能');
      }
    });

    it('fails if skills list exceeds 10 items', () => {
      const result = step4Schema.safeParse({
        want_skill: Array(11).fill('skill'),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('step5Schema', () => {
    it('passes with 1 to 10 topics', () => {
      const result = step5Schema.safeParse({
        want_topic: ['topic1'],
      });
      expect(result.success).toBe(true);
    });

    it('fails with empty topics list', () => {
      const result = step5Schema.safeParse({
        want_topic: [],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('請至少選擇一個主題');
      }
    });

    it('fails if topics list exceeds 10 items', () => {
      const result = step5Schema.safeParse({
        want_topic: Array(11).fill('topic'),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('formSchema', () => {
    it('aggregates Mentee single-page fields successfully (#836)', () => {
      const result = formSchema.safeParse({
        ...onboardingDefaultValues,
        role: 'mentee',
        name: 'John Doe',
        language: 'zh_TW',
        location: 'TWN',
        years_of_experience: '1_3',
        industry: 'TECH',
        want_position: ['pos1'],
        want_skill: ['skill1'],
        want_topic: ['topic1'],
      });
      expect(result.success).toBe(true);
    });

    it('accepts valid Mentor single-page payload with real avatar, guidelines, expertise, work experience, and education (#836)', () => {
      const mentorPass = formSchema.safeParse({
        ...onboardingDefaultValues,
        role: 'mentor',
        name: '林導師',
        avatar: 'https://s3.amazonaws.com/real-mentor.png',
        agreed_guidelines: true,
        location: 'TWN',
        years_of_experience: '3_5',
        industry: 'TECH',
        about: '十年資深後端架構師，專注分散式系統與職涯轉職指導。',
        have_topic: ['career'],
        have_skill: ['backend'],
        work_experiences: [
          {
            id: -1,
            job: 'Senior Staff Engineer',
            company: 'Acme Cloud',
            is_primary: true,
            job_period_start: '2020',
            job_period_end: 'Present',
            industry: 'TECH',
            job_location: 'TWN',
            description: '主導核心架構設計與工程團隊指導',
          },
        ],
        educations: [
          {
            id: -1,
            school: '國立臺灣大學',
            subject: '資訊工程學系',
            education_period_start: '2012',
            education_period_end: '2016',
          },
        ],
      });
      expect(mentorPass.success).toBe(true);
    });

    it('reports granular Mentor superRefine errors for missing guidelines, preset/empty avatar, industry, about, expertise, work, and education (#836)', () => {
      const mentorBlocked = formSchema.safeParse({
        ...onboardingDefaultValues,
        role: 'mentor',
        name: '林導師',
        avatar: 'default_1',
        agreed_guidelines: false,
        location: 'TWN',
        years_of_experience: '3_5',
        industry: '',
        about: '   ',
        have_topic: [],
        have_skill: [],
        work_experiences: [],
        educations: [],
      });
      expect(mentorBlocked.success).toBe(false);
      if (!mentorBlocked.success) {
        const paths = mentorBlocked.error.issues.map((i) => i.path.join('.'));
        expect(paths).toEqual(
          expect.arrayContaining([
            'agreed_guidelines',
            'avatarFile',
            'industry',
            'about',
            'have_topic',
            'have_skill',
            'work_experiences',
            'educations',
          ])
        );
      }
    });
  });
});
