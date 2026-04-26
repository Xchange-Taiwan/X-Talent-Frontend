import { describe, expect, it } from 'vitest';

import { parseCurrentJob } from './parseUserExperiences';

const makeWorkBlock = (
  data: {
    job?: string;
    company?: string;
    jobPeriodStart?: string;
    jobPeriodEnd?: string;
    isPrimary?: boolean;
  }[]
) => ({
  category: 'WORK' as const,
  mentor_experiences_metadata: { data },
});

describe('parseCurrentJob', () => {
  it('returns empty strings when there are no work experiences', () => {
    expect(parseCurrentJob([])).toEqual({ job_title: '', company: '' });
    expect(parseCurrentJob(undefined)).toEqual({ job_title: '', company: '' });
  });

  it('prefers the entry with isPrimary=true over the latest job', () => {
    const result = parseCurrentJob([
      makeWorkBlock([
        {
          job: 'Engineer',
          company: 'Acme',
          jobPeriodStart: '2024',
          jobPeriodEnd: '',
        },
        {
          job: 'Senior Engineer',
          company: 'Dell',
          jobPeriodStart: '2018',
          jobPeriodEnd: '2023',
          isPrimary: true,
        },
      ]),
    ]);

    expect(result).toEqual({ job_title: 'Senior Engineer', company: 'Dell' });
  });

  it('falls back to the current job (no jobPeriodEnd) when no entry is primary', () => {
    const result = parseCurrentJob([
      makeWorkBlock([
        {
          job: 'Engineer',
          company: 'Acme',
          jobPeriodStart: '2024',
          jobPeriodEnd: '',
        },
        {
          job: 'Senior Engineer',
          company: 'Dell',
          jobPeriodStart: '2018',
          jobPeriodEnd: '2023',
        },
      ]),
    ]);

    expect(result).toEqual({ job_title: 'Engineer', company: 'Acme' });
  });

  it('falls back to the latest jobPeriodEnd when no current job and no primary', () => {
    const result = parseCurrentJob([
      makeWorkBlock([
        {
          job: 'Junior',
          company: 'Old Co',
          jobPeriodStart: '2015',
          jobPeriodEnd: '2017',
        },
        {
          job: 'Senior',
          company: 'New Co',
          jobPeriodStart: '2018',
          jobPeriodEnd: '2023',
        },
      ]),
    ]);

    expect(result).toEqual({ job_title: 'Senior', company: 'New Co' });
  });
});
