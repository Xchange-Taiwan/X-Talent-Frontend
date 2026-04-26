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

  it('falls back to the first entry when no entry is primary', () => {
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
});
