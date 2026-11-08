const SKELETON_COUNT = 9;

function CardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="border-background-border bg-background-white w-[334px] animate-pulse overflow-hidden rounded-lg border xl:h-[480px] xl:w-[413px]"
    >
      <div className="bg-background-bottom h-[200px] w-full xl:h-[260px]" />
      <div className="px-4 pt-4 pb-6">
        <div className="bg-background-bottom mb-3 h-5 w-2/3 rounded" />
        <div className="bg-background-bottom mb-2 h-4 w-1/2 rounded" />
        <div className="bg-background-bottom mb-4 h-3 w-full rounded" />
        <div className="flex gap-2">
          <div className="bg-background-bottom h-6 w-16 rounded-full" />
          <div className="bg-background-bottom h-6 w-20 rounded-full" />
          <div className="bg-background-bottom h-6 w-14 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default function MentorGridSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="導師清單載入中"
      className="mt-[132px] px-5 pb-10 md:px-10 xl:px-20"
    >
      <div className="mx-auto w-full max-w-screen-xl">
        <div className="bg-background-bottom mb-5 h-6 w-32 animate-pulse rounded" />
        <div className="flex flex-col items-center gap-6">
          <div className="grid min-w-max grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
