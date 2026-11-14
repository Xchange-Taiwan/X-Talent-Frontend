'use client';

import { Bookmark } from 'lucide-react';
import Link from 'next/link';

import { MentorCard } from '@/components/mentor-pool/mentor-card';
import { buildMentorCardTags } from '@/components/mentor-pool/mentor-card-list';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { FIND_MENTOR_HREF } from '@/lib/routes';
import type { MentorType } from '@/types/mentor';

export type FavoritesListStatus = 'loading' | 'empty' | 'success';

export interface FavoritesPageUIProps {
  mentors: MentorType[];
  mentorCount: number;
  listStatus: FavoritesListStatus;
}

export default function FavoritesPageUI({
  mentors,
  mentorCount,
  listStatus,
}: FavoritesPageUIProps) {
  return (
    <section className="px-5 py-8 md:px-10 md:py-10 xl:px-20">
      <div className="mx-auto w-full max-w-screen-xl">
        <header className="mb-6 flex flex-col gap-2 md:mb-8">
          <h1 className="text-text-primary text-2xl font-bold md:text-3xl">
            我的收藏
          </h1>
          {listStatus !== 'loading' && (
            <p className="text-text-secondary text-sm md:text-base">
              已收藏 {mentorCount} 位導師
            </p>
          )}
        </header>

        {listStatus === 'loading' && (
          <div className="flex min-h-[320px] w-full items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {listStatus === 'success' && (
          <div className="grid w-fit grid-cols-1 gap-5 max-md:mx-auto md:grid-cols-2 xl:grid-cols-3">
            {mentors.map((mentor, index) => (
              <MentorCard
                key={mentor.user_id}
                id={mentor.user_id}
                avatar={mentor.avatar}
                years={mentor.years_of_experience}
                name={mentor.name}
                job_title={mentor.job_title}
                company={mentor.company}
                about={mentor.about}
                haveTopicLabels={buildMentorCardTags(mentor)}
                ratingAverage={mentor.stats?.rating_average ?? null}
                completedMeetingCount={
                  mentor.stats?.completed_meeting_count ?? null
                }
                priority={index === 0}
                mentorSnapshot={mentor}
              />
            ))}
          </div>
        )}

        {listStatus === 'empty' && (
          <div
            role="status"
            aria-live="polite"
            className="border-background-border bg-background-white flex w-full flex-col items-center justify-center gap-4 rounded-lg border px-6 py-16 text-center"
          >
            <div className="bg-background-bottom flex size-14 items-center justify-center rounded-full">
              <Bookmark
                className="text-text-tertiary size-7"
                aria-hidden="true"
              />
            </div>
            <p className="text-text-primary text-xl font-semibold md:text-2xl">
              還沒有收藏的導師
            </p>
            <Button asChild size="lg" className="mt-2">
              <Link href={FIND_MENTOR_HREF}>尋找導師</Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
