import { describe, expect, it, vi } from 'vitest';

import { ExperienceType } from '@/services/profile/experienceType';

import type { MentorExperiencePayload } from './experienceCodec';
import * as codec from './experienceCodec';
import { toFormValues } from './parseUserExperiences';

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

describe('parseUserExperiences.toFormValues', () => {
  it('calls experienceCodec.decode exactly once per payload', () => {
    const decodeSpy = vi.spyOn(codec, 'decode');
    const experiences = [
      payloadFor(ExperienceType.WORK, [{ job: 'Engineer' }]),
    ];

    toFormValues(experiences);

    expect(decodeSpy).toHaveBeenCalledTimes(1);
    decodeSpy.mockRestore();
  });

  it('injects a stable RHF id (array index) into work experiences and educations', () => {
    const experiences = [
      payloadFor(ExperienceType.WORK, [{ job: 'A' }, { job: 'B' }]),
      payloadFor(ExperienceType.EDUCATION, [{ subject: 'CS' }]),
    ];

    const { workExperiences, educations } = toFormValues(experiences);

    expect(workExperiences.map((w) => w.id)).toEqual([0, 1]);
    expect(educations.map((e) => e.id)).toEqual([0]);
  });

  it('groups the flat personalLinks array into a per-platform Record', () => {
    const experiences = [
      payloadFor(ExperienceType.LINK, [
        { platform: 'linkedin', url: 'https://linkedin.com/in/me' },
        { platform: 'website', url: 'https://example.com' },
      ]),
    ];

    const { links } = toFormValues(experiences);

    expect(links.linkedin).toEqual({
      id: 0,
      platform: 'linkedin',
      url: 'https://linkedin.com/in/me',
    });
    expect(links.website).toEqual({
      id: 1,
      platform: 'website',
      url: 'https://example.com',
    });
  });

  it('last-writer-wins when the same platform appears more than once', () => {
    const experiences = [
      payloadFor(ExperienceType.LINK, [
        { platform: 'linkedin', url: 'https://linkedin.com/in/first' },
        { platform: 'linkedin', url: 'https://linkedin.com/in/second' },
      ]),
    ];

    const { links } = toFormValues(experiences);

    expect(links.linkedin?.url).toBe('https://linkedin.com/in/second');
  });

  it('drops an unrecognized link platform', () => {
    const experiences = [
      payloadFor(ExperienceType.LINK, [
        { platform: 'myspace', url: 'https://myspace.com/me' },
      ]),
    ];

    const { links } = toFormValues(experiences);

    expect(links).toEqual({});
  });
});
