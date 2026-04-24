'use client';
import { useMemo } from 'react';

export function useProfileSelectOptions({
  topics,
  expertises,
  interestedPositions,
  skills,
}: {
  topics: { subject: string | null; subject_group: string }[];
  expertises: { subject: string | null; subject_group: string }[];
  interestedPositions: { subject: string | null; subject_group: string }[];
  skills: { subject: string | null; subject_group: string }[];
}) {
  const whatIOfferTopicsList = useMemo(
    () =>
      topics.map((t) => ({ value: t.subject_group, label: t.subject ?? '' })),
    [topics]
  );
  const expertisedList = useMemo(
    () =>
      expertises.map((e) => ({
        value: e.subject_group,
        label: e.subject ?? '',
      })),
    [expertises]
  );
  const interestedPositionList = useMemo(
    () =>
      interestedPositions.map((p) => ({
        value: p.subject_group,
        label: p.subject ?? '',
      })),
    [interestedPositions]
  );
  const interestedSkillsList = useMemo(
    () =>
      skills.map((s) => ({ value: s.subject_group, label: s.subject ?? '' })),
    [skills]
  );
  const interestedTopicsList = useMemo(
    () =>
      topics.map((t) => ({ value: t.subject_group, label: t.subject ?? '' })),
    [topics]
  );

  return {
    whatIOfferTopicsList,
    expertisedList,
    interestedPositionList,
    interestedSkillsList,
    interestedTopicsList,
  };
}
