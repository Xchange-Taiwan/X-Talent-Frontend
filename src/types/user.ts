import type {
  EducationExperienceMetadata,
  PersonalLinkMetadata,
  WorkExperienceMetadata,
} from '@/lib/profile/experienceCodec';
import type { components } from '@/types/api';
import type { MentorStats, RawMentorStats } from '@/types/mentor';
import type { TagVO } from '@/types/tag';

export type MentorIndustryVO = Partial<TagVO> | Record<string, never>;

export type MentorProfileVO = Omit<
  components['schemas']['MentorProfileVO'],
  'industry'
> & {
  industry?: MentorIndustryVO | null;
  stats?: RawMentorStats | null;
  completed_meeting_count?: number | null;
  total_rating_count?: number | null;
  rating_count?: number | null;
  rating_average?: number | null;
  updated_at?: string | number | null;
};

export interface TagDisplay {
  subject_group: string;
  subject: string;
}

export interface UserType {
  user_id: number;
  name: string;
  avatar: string;
  job_title: string;
  company: string;
  is_mentor: boolean;
  about?: string;
  personal_statement?: string;
  years_of_experience?: string;
  seniority_level?: string;
  location?: string;
  industry?: string;
  industries?: TagDisplay[];
  updated_at?: string | null;
  stats?: MentorStats | null;
  want_position: TagDisplay[];
  want_skill: TagDisplay[];
  want_topic: TagDisplay[];
  have_skill: TagDisplay[];
  have_topic: TagDisplay[];
  workExperiences?: WorkExperienceMetadata[];
  educations?: EducationExperienceMetadata[];
  personalLinks?: PersonalLinkMetadata[];
}
