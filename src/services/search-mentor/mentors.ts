import { getInterestsCached } from '@/hooks/user/interests/useInterests';
import { apiClient } from '@/lib/apiClient';

import {
  mapMentor,
  type MentorExperienceBlock,
  type MentorListResponse,
  type MentorRequest,
  type MentorsType,
  type MentorType,
  type WorkExperienceMetadata,
} from './mapMentor';

export type {
  MentorExperienceBlock,
  MentorListResponse,
  MentorRequest,
  MentorsType,
  MentorType,
  WorkExperienceMetadata,
};

export async function fetchMentors(
  param: MentorRequest
): Promise<MentorType[]> {
  try {
    const result = await apiClient.get<MentorListResponse>('/v1/mentors', {
      auth: false,
      params: param as unknown as Record<string, string | number | undefined>,
    });

    if (result.code !== '0') {
      console.error(`API Error: ${result.msg}`);
      return [];
    }
    return (result.data?.mentors ?? []).map(mapMentor);
  } catch (error) {
    console.error('Fetch Mentors Error:', error);
    return [];
  }
}

export async function fetchMentorsEnriched(
  param: MentorRequest
): Promise<MentorType[]> {
  const [searchResults, interests] = await Promise.all([
    fetchMentors(param),
    getInterestsCached('zh_TW'),
  ]);

  if (searchResults.length === 0) return [];

  const skillLabelMap: Record<string, string> = {};
  interests.skills.forEach((s) => {
    skillLabelMap[s.subject_group] = s.subject ?? '';
  });

  const topicLabelMap: Record<string, string> = {};
  interests.topics.forEach((t) => {
    topicLabelMap[t.subject_group] = t.subject ?? '';
  });

  const whatIOfferLabelMap: Record<string, string> = {};
  interests.whatIOffers.forEach((w) => {
    whatIOfferLabelMap[w.subject_group] = w.subject ?? '';
  });

  return searchResults.map((mentor) => ({
    ...mentor,
    skills: mentor.skills
      .map((subjectGroup) => skillLabelMap[subjectGroup] ?? subjectGroup)
      .filter(Boolean),
    topics: mentor.topics
      .map((subjectGroup) => topicLabelMap[subjectGroup] ?? subjectGroup)
      .filter(Boolean),
    what_i_offers: mentor.what_i_offers
      .map((subjectGroup) => whatIOfferLabelMap[subjectGroup] ?? subjectGroup)
      .filter(Boolean),
  }));
}
