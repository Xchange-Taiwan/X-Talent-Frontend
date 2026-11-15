'use client';

import { AlertCircle, Bookmark } from 'lucide-react';
import Link from 'next/link';

import { MentorCard } from '@/components/mentor-pool/mentor-card';
import { buildMentorCardTags } from '@/components/mentor-pool/mentor-card-list';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { FIND_MENTOR_HREF } from '@/lib/routes';
import type { MentorType } from '@/types/mentor';

export type FavoritesListStatus = 'loading' | 'error' | 'empty' | 'success';

export interface FavoritesPageUIProps {
  mentors: MentorType[];
  mentorCount: number;
  listStatus: FavoritesListStatus;
  onRetry?: () => void;
}

export default function FavoritesPageUI({
  mentors,
  mentorCount,
  listStatus,
  onRetry,
}: FavoritesPageUIProps) {
  const showMentorCount = listStatus === 'success' || listStatus === 'empty';

  return (
    <section className="px-5 py-8 md:px-10 md:py-10 xl:px-20">
      <div className="mx-auto w-full max-w-screen-xl">
        <header className="mb-6 flex flex-col gap-2 md:mb-8">
          <h1 className="text-text-primary text-2xl font-bold md:text-3xl">
            我的收藏
          </h1>
          {showMentorCount && (
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
          <div className="grid w-full grid-cols-1 justify-items-center gap-6 md:grid-cols-2 md:justify-items-start md:gap-5 lg:grid-cols-3">
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
                feature="favorites"
                analyticsLocation="favorites_list"
              />
            ))}
          </div>
        )}

        {listStatus === 'error' && (
          <div
            role="alert"
            className="border-background-border bg-background-white flex w-full flex-col items-center justify-center gap-4 rounded-lg border px-6 py-16 text-center"
          >
            <div className="bg-background-bottom flex size-14 items-center justify-center rounded-full">
              <AlertCircle
                className="text-text-tertiary size-7"
                aria-hidden="true"
              />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-text-primary text-xl font-semibold md:text-2xl">
                載入收藏清單時發生連線錯誤
              </p>
              <p className="text-text-secondary text-sm md:text-base">
                請檢查網路連線狀態後再試一次
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="mt-2"
              onClick={onRetry}
            >
              重新載入
            </Button>
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
            <p className="text-text-secondary text-base font-medium">
              還沒有收藏的導師
            </p>
            <Button asChild size="lg" className="mt-2">
              <Link
                href={FIND_MENTOR_HREF}
                data-analytics-click="favorites_empty_explore_mentors"
                data-analytics-feature="favorites"
                data-analytics-location="favorites_empty_state"
              >
                尋找導師
              </Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
