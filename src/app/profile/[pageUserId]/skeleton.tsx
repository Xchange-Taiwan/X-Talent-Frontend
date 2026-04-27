import { Skeleton } from '@/components/ui/skeleton';

export function ProfileHeaderSkeleton() {
  return (
    <div className="flex h-auto -translate-y-10 flex-col justify-between sm:relative sm:h-[160px] sm:flex-row lg:static">
      <div className="flex flex-col items-center gap-6 sm:flex-row">
        <Skeleton className="h-[160px] w-[160px] flex-shrink-0 rounded-full" />
        <div className="flex flex-col gap-3 sm:mb-6 lg:mb-0">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    </div>
  );
}

export function ProfileContentSkeleton() {
  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-24" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-20 rounded-full" />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-20" />
        <div className="flex flex-col gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ScheduleSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-64 w-full rounded-lg" />
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-10 w-full rounded-full" />
    </div>
  );
}

export function ProfilePageSkeleton() {
  return (
    <div>
      <div className="relative h-[111px] bg-gradient-to-br from-[#92e7e7] to-[#e7a0d4] sm:h-[100px]" />

      <div className="container mb-20 max-w-[1024px] 2xl:max-w-[1280px]">
        <ProfileHeaderSkeleton />

        <div className="flex flex-col gap-8 2xl:flex-row 2xl:gap-12">
          <div className="w-full 2xl:w-3/5">
            <ProfileContentSkeleton />
          </div>
          <div className="w-full 2xl:w-2/5">
            <ScheduleSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}
