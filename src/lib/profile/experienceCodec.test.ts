import { describe, expect, it } from 'vitest';

import { ExperienceType } from '@/services/profile/experienceType';

import {
  decode,
  encode,
  type EncodeInput,
  type MentorExperiencePayload,
} from './experienceCodec';

function payloadFor(
  category: ExperienceType,
  data: unknown[]
): MentorExperiencePayload {
  return {
    category,
    order: 1,
    mentor_experiences_metadata: { data },
  };
}

describe('experienceCodec', () => {
  it('round-trips a representative fixture through encode then decode', () => {
    const input: EncodeInput = {
      workExperiences: [
        {
          job: 'Engineer',
          company: 'Acme',
          job_period_start: '2020',
          job_period_end: 'now',
          industry: 'tech',
          job_location: 'TWN',
          description: 'building things',
          is_primary: true,
        },
        {
          job: 'Junior Engineer',
          company: 'OldCo',
          job_period_start: '2015',
          job_period_end: '2019',
          industry: 'tech',
          job_location: 'TWN',
          description: 'learning things',
          is_primary: false,
        },
      ],
      educations: [
        {
          subject: 'CS',
          school: 'NTU',
          education_period_start: '2011',
          education_period_end: '2015',
        },
      ],
      personalLinks: [
        { platform: 'linkedin', url: 'https://linkedin.com/in/me' },
      ],
    };

    const { experiences, job_title, company } = encode(input);
    const decoded = decode(experiences);

    expect(decoded).toEqual(input);
    expect(job_title).toBe('Engineer');
    expect(company).toBe('Acme');
  });

  it('decode: single work experience with no is_primary falls back to marking it primary', () => {
    const experiences = [
      payloadFor(ExperienceType.WORK, [{ job: 'Engineer', company: 'Acme' }]),
    ];

    const { workExperiences } = decode(experiences);

    expect(workExperiences).toHaveLength(1);
    expect(workExperiences[0].is_primary).toBe(true);
  });

  it('decode: filters out unsafe URLs (e.g. javascript:) from personal links', () => {
    const experiences = [
      payloadFor(ExperienceType.LINK, [
        { platform: 'website', url: 'javascript:alert(1)' },
        { platform: 'linkedin', url: 'https://linkedin.com/in/me' },
      ]),
    ];

    const { personalLinks } = decode(experiences);

    expect(personalLinks).toEqual([
      { platform: 'linkedin', url: 'https://linkedin.com/in/me' },
    ]);
  });

  it('decode: missing fields across categories fall back to safe defaults without throwing', () => {
    const experiences = [
      payloadFor(ExperienceType.WORK, [{}]),
      payloadFor(ExperienceType.EDUCATION, [{}]),
      payloadFor(ExperienceType.LINK, [{ platform: 'website' }]),
    ];

    const decoded = decode(experiences);

    expect(decoded.workExperiences[0]).toEqual({
      job: '',
      company: '',
      job_period_start: '',
      job_period_end: '',
      industry: '',
      job_location: '',
      description: '',
      is_primary: true,
    });
    expect(decoded.educations[0]).toEqual({
      subject: '',
      school: '',
      education_period_start: '',
      education_period_end: '',
    });
    // Missing url fails isSafeUrl and is dropped.
    expect(decoded.personalLinks).toEqual([]);
  });

  it('decode: unknown category is silently ignored', () => {
    const experiences = [
      payloadFor('SOMETHING_NEW' as ExperienceType, [{ foo: 'bar' }]),
    ];

    expect(decode(experiences)).toEqual({
      workExperiences: [],
      educations: [],
      personalLinks: [],
    });
  });

  it('decode: undefined experiences returns empty arrays', () => {
    expect(decode(undefined)).toEqual({
      workExperiences: [],
      educations: [],
      personalLinks: [],
    });
  });

  it('encode: multiple work experiences flagged is_primary mirrors the first match (Array.find semantics)', () => {
    const input: EncodeInput = {
      workExperiences: [
        { job: 'First Primary', company: 'A', is_primary: true },
        { job: 'Second Primary', company: 'B', is_primary: true },
      ],
      educations: [],
      personalLinks: [],
    };

    const { job_title, company } = encode(input);

    expect(job_title).toBe('First Primary');
    expect(company).toBe('A');
  });

  it('encode: no work experiences mirrors job_title/company as empty strings, not undefined', () => {
    const input: EncodeInput = {
      workExperiences: [],
      educations: [],
      personalLinks: [],
    };

    const { job_title, company, experiences } = encode(input);

    expect(job_title).toBe('');
    expect(company).toBe('');
    expect(
      experiences.find((e) => e.category === ExperienceType.WORK)
        ?.mentor_experiences_metadata.data
    ).toEqual([]);
  });
});
