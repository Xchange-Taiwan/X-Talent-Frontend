import { describe, expect, it } from 'vitest';

import { readIndustryTag } from './readIndustryTag';

describe('readIndustryTag', () => {
  it('returns null when industry is null', () => {
    expect(readIndustryTag(null)).toBeNull();
  });

  it('returns null when industry is undefined', () => {
    expect(readIndustryTag(undefined)).toBeNull();
  });

  it('returns null when industry is an empty string', () => {
    expect(readIndustryTag('')).toBeNull();
  });

  it('returns the same object casted to TagVO when industry is a valid object', () => {
    const mockIndustry = {
      id: 42,
      kind: 'industry',
      subject_group: 'tech',
      subject: 'Technology',
    };
    expect(readIndustryTag(mockIndustry)).toEqual(mockIndustry);
  });
});
