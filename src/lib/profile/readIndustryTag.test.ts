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

  it('returns null when industry is a primitive number', () => {
    expect(readIndustryTag(123)).toBeNull();
  });

  it('returns null when industry is a boolean', () => {
    expect(readIndustryTag(true)).toBeNull();
  });

  it('returns null when industry is a malformed object without tag properties', () => {
    expect(readIndustryTag({ foo: 'bar' })).toBeNull();
  });

  it('returns the same object casted to TagVO when industry is a valid object containing subject_group', () => {
    const mockIndustry = {
      subject_group: 'tech',
    };
    expect(readIndustryTag(mockIndustry)).toEqual(mockIndustry);
  });

  it('returns the same object casted to TagVO when industry is a valid object containing subject', () => {
    const mockIndustry = {
      subject: 'Technology',
    };
    expect(readIndustryTag(mockIndustry)).toEqual(mockIndustry);
  });

  it('returns the same object casted to TagVO when industry is a valid object containing id', () => {
    const mockIndustry = {
      id: 42,
    };
    expect(readIndustryTag(mockIndustry)).toEqual(mockIndustry);
  });

  it('returns the same object casted to TagVO when industry is a complete valid object', () => {
    const mockIndustry = {
      id: 42,
      kind: 'industry',
      subject_group: 'tech',
      subject: 'Technology',
    };
    expect(readIndustryTag(mockIndustry)).toEqual(mockIndustry);
  });
});
