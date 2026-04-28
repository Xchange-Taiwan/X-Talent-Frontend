import { Skeleton } from '@/components/ui/skeleton';

export function ReservationListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4 px-3 pt-4 sm:px-0">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-2xl border p-4">
          <Skeleton className="h-12 w-12 flex-shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function ReservationSkeleton() {
  return (
    <div className="flex min-h-[calc(100vh-70px)] justify-center">
      <div className="w-full max-w-[90%] overflow-hidden rounded-2xl md:max-w-[800px]">
        {/* title */}
        <div className="mx-auto mb-6 flex h-[42px] w-[251px] items-center justify-center">
          <Skeleton className="h-8 w-40" />
        </div>

        <div className="mx-auto w-full max-w-3xl px-0 sm:px-4 lg:px-6">
          {/* tab pills */}
          <div className="mb-3 flex justify-center gap-2 py-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-full" />
            ))}
          </div>

          <ReservationListSkeleton rows={4} />
        </div>
      </div>
    </div>
  );
}
