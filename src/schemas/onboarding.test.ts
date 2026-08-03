import { describe, expect, it } from 'vitest';

import {
  formSchema,
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
        expect(result.error.issues[0].message).toBe('請輸入姓名');
      }
    });

    it('fails if name exceeds 20 characters', () => {
      const result = step1Schema.safeParse({
        name: 'A'.repeat(21),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('最多不可超過 20 字');
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
        expect(result.error.issues[0].message).toBe('請至少選擇一個職位');
      }
    });

    it('fails if positions list exceeds 10 items', () => {
      const result = step3Schema.safeParse({
        want_position: Array(11).fill('position'),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('最多選 10 個');
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
        expect(result.error.issues[0].message).toBe('請至少選擇一個技能');
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
        expect(result.error.issues[0].message).toBe('請至少選擇一個主題');
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
    it('aggregates all step schemas successfully', () => {
      const result = formSchema.safeParse({
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
  });
});
