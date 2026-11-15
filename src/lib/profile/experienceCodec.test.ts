import { describe, expect, it } from 'vitest';

import { ExperienceType } from '@/services/profile/experienceType';

import {
  decode,
  encode,
  type EncodeInput,
  type MentorExperiencePayload,
  toFormValues,
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

  it('decode & encode: multiple work experiences with none marked is_primary default to the first entry', () => {
    const experiences = [
      payloadFor(ExperienceType.WORK, [
        { job: 'Lead Engineer', company: 'FirstCo', is_primary: false },
        { job: 'Engineer', company: 'SecondCo', is_primary: false },
      ]),
    ];

    const { workExperiences } = decode(experiences);

    expect(workExperiences).toHaveLength(2);
    expect(workExperiences[0].is_primary).toBe(true);
    expect(workExperiences[1].is_primary).toBe(false);

    const encoded = encode({
      workExperiences: [
        { job: 'Lead Engineer', company: 'FirstCo', is_primary: false },
        { job: 'Engineer', company: 'SecondCo', is_primary: false },
      ],
      educations: [],
      personalLinks: [],
    });

    expect(encoded.job_title).toBe('Lead Engineer');
    expect(encoded.company).toBe('FirstCo');
  });

  it('decode: merges multiple payloads of the same category without dropping later items', () => {
    const experiences = [
      payloadFor(ExperienceType.WORK, [{ job: 'First Job', company: 'Co A' }]),
      payloadFor(ExperienceType.WORK, [{ job: 'Second Job', company: 'Co B' }]),
      payloadFor(ExperienceType.LINK, [
        { platform: 'linkedin', url: 'https://linkedin.com/in/me' },
      ]),
      payloadFor(ExperienceType.LINK, [
        { platform: 'website', url: 'https://example.com' },
      ]),
    ];

    const decoded = decode(experiences);

    expect(decoded.workExperiences).toHaveLength(2);
    expect(decoded.workExperiences[0].job).toBe('First Job');
    expect(decoded.workExperiences[0].is_primary).toBe(true);
    expect(decoded.workExperiences[1].job).toBe('Second Job');
    expect(decoded.workExperiences[1].is_primary).toBe(false);
    expect(decoded.personalLinks).toEqual([
      { platform: 'linkedin', url: 'https://linkedin.com/in/me' },
      { platform: 'website', url: 'https://example.com' },
    ]);
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

  it('toFormValues: normalizes legacy casing, applies last-writer-wins per platform, and drops lookalike hosts or malformed entries', () => {
    const experiences = [
      payloadFor(ExperienceType.WORK, [
        null,
        { job: 'Engineer', company: 'Acme' },
      ]),
      payloadFor(ExperienceType.LINK, [
        null,
        { url: 'https://example.com/missing-platform' },
        { platform: 'LinkedIn', url: 'https://linkedin.com/in/first' },
        { platform: 'linkedin', url: 'https://www.linkedin.com/in/latest' },
        { platform: 'linkedin', url: 'https://evil-linkedin.com/in/ignored' },
        { platform: 'website', url: 'https://portfolio.example.com' },
      ]),
    ];

    const formValues = toFormValues(experiences);

    expect(formValues.workExperiences).toHaveLength(1);
    expect(formValues.workExperiences[0]).toMatchObject({
      id: 0,
      job: 'Engineer',
      company: 'Acme',
      is_primary: true,
    });
    expect(formValues.links).toEqual({
      linkedin: 'https://www.linkedin.com/in/latest',
      facebook: '',
      instagram: '',
      twitter: '',
      youtube: '',
      website: 'https://portfolio.example.com',
    });
  });
});
