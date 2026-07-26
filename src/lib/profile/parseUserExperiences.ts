import * as z from 'zod';

import {
  educationSchema,
  jobSchema,
  personLinkSchema,
} from '@/schemas/profileSchema';

import { decode, type MentorExperiencePayload } from './experienceCodec';

export type { MentorExperiencePayload };

type PersonalLinkFormValue = z.infer<typeof personLinkSchema>;
type WorkExperienceFormValue = z.infer<typeof jobSchema>;
type EducationFormValue = z.infer<typeof educationSchema>;

const LINK_PLATFORMS = [
  'linkedin',
  'facebook',
  'instagram',
  'twitter',
  'youtube',
  'website',
] as const;
type LinkPlatform = (typeof LINK_PLATFORMS)[number];

function isLinkPlatform(platform: string): platform is LinkPlatform {
  return (LINK_PLATFORMS as readonly string[]).includes(platform);
}

export interface ExperienceFormValues {
  workExperiences: WorkExperienceFormValue[];
  educations: EducationFormValue[];
  links: Partial<Record<LinkPlatform, PersonalLinkFormValue>>;
}

// Thin RHF adapter over experienceCodec.decode(). The codec owns the wire
// <-> domain transform (including is_primary fallback and URL safety
// filtering); this adapter only adds what RHF specifically needs: a stable
// per-form-item `id` from array index, and packing the flat personalLinks
// array into the per-platform Record the form schema expects. Decodes once
// and derives all three form pieces from that single result.
export function toFormValues(
  experiences: MentorExperiencePayload[]
): ExperienceFormValues {
  const { workExperiences, educations, personalLinks } = decode(experiences);

  const links: Partial<Record<LinkPlatform, PersonalLinkFormValue>> = {};
  personalLinks.forEach((link, idx) => {
    if (isLinkPlatform(link.platform)) {
      // Last-writer-wins on duplicate platforms, matching Object assignment
      // order — same as the pre-codec implementation.
      links[link.platform] = {
        id: idx,
        platform: link.platform,
        url: link.url,
      };
    }
  });

  return {
    workExperiences: workExperiences.map((item, idx) => ({ id: idx, ...item })),
    educations: educations.map((item, idx) => ({ id: idx, ...item })),
    links,
  };
}
