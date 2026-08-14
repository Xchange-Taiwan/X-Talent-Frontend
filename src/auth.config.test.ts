import { fromPartial } from '@total-typescript/shoehorn';
import { describe, expect,it } from 'vitest';

import {
  type MentorExperience,
  REFRESH_SKEW_SECONDS,
  resolveMentorExperienceLinks,
} from './auth.config';

describe('auth.config', () => {
  describe('REFRESH_SKEW_SECONDS', () => {
    it('should be set to 300 seconds', () => {
      expect(REFRESH_SKEW_SECONDS).toBe(300);
    });
  });

  describe('resolveMentorExperienceLinks', () => {
    it('should return empty array if experiences is undefined, null, or empty', () => {
      expect(resolveMentorExperienceLinks(undefined)).toEqual([]);
      expect(resolveMentorExperienceLinks(null)).toEqual([]);
      expect(resolveMentorExperienceLinks([])).toEqual([]);
    });

    it('should filter out non-LINK experiences', () => {
      const experiences: MentorExperience[] = [
        {
          category: 'WORK',
          mentor_experiences_metadata: {
            data: [
              { platform: 'LinkedIn', url: 'https://linkedin.com/in/test' },
            ],
          },
        },
      ];
      expect(resolveMentorExperienceLinks(experiences)).toEqual([]);
    });

    it('should extract experiences with category LINK', () => {
      const experiences: MentorExperience[] = [
        {
          category: 'LINK',
          mentor_experiences_metadata: {
            data: [
              { platform: 'LinkedIn', url: 'https://linkedin.com/in/test' },
            ],
          },
        },
      ];
      expect(resolveMentorExperienceLinks(experiences)).toEqual([
        { platform: 'LinkedIn', url: 'https://linkedin.com/in/test' },
      ]);
    });

    it('should handle missing mentor_experiences_metadata or data safely', () => {
      const experiences: MentorExperience[] = [
        {
          category: 'LINK',
        },
        {
          category: 'LINK',
          mentor_experiences_metadata: {},
        },
      ];
      expect(resolveMentorExperienceLinks(experiences)).toEqual([]);
    });

    it('should filter out links with empty or falsy url using Shoehorn', () => {
      const experiences: MentorExperience[] = [
        fromPartial({
          category: 'LINK',
          mentor_experiences_metadata: {
            data: [
              { platform: 'LinkedIn', url: '' },
              { platform: 'GitHub', url: 'https://github.com/test' },
              fromPartial({ platform: 'Medium', url: undefined }),
            ],
          },
        }),
      ];
      expect(resolveMentorExperienceLinks(experiences)).toEqual([
        { platform: 'GitHub', url: 'https://github.com/test' },
      ]);
    });

    it('should flatMap multiple LINK experiences', () => {
      const experiences: MentorExperience[] = [
        {
          category: 'LINK',
          mentor_experiences_metadata: {
            data: [
              { platform: 'LinkedIn', url: 'https://linkedin.com/in/test' },
            ],
          },
        },
        {
          category: 'LINK',
          mentor_experiences_metadata: {
            data: [{ platform: 'GitHub', url: 'https://github.com/test' }],
          },
        },
      ];
      expect(resolveMentorExperienceLinks(experiences)).toEqual([
        { platform: 'LinkedIn', url: 'https://linkedin.com/in/test' },
        { platform: 'GitHub', url: 'https://github.com/test' },
      ]);
    });

    it('should safely handle non-object, null, or primitive values in metadata data array', () => {
      const experiences: MentorExperience[] = [
        fromPartial({
          category: 'LINK',
          mentor_experiences_metadata: {
            data: [
              null,
              undefined,
              'not-an-object',
              123,
              { platform: 'GitHub', url: 'https://github.com/test' },
            ],
          },
        }),
      ];
      expect(resolveMentorExperienceLinks(experiences)).toEqual([
        { platform: 'GitHub', url: 'https://github.com/test' },
      ]);
    });
  });
});
