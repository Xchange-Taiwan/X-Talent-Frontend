'use client';

import type { MenteeDirectionReadGroup } from '@/lib/profile/menteeDirectionView';
import { cn } from '@/lib/utils';

export interface MenteeWatchedPositionsCardProps {
  groups: ReadonlyArray<MenteeDirectionReadGroup>;
  activeDirection?: string | null;
  onSelectDirection?: (directionKey: string) => void;
  className?: string;
}

export function MenteeWatchedPositionsCard({
  groups,
  activeDirection,
  onSelectDirection,
  className,
}: MenteeWatchedPositionsCardProps) {
  return (
    <aside
      aria-label="關注的職位"
      data-testid="mentee-watched-positions-card"
      className={cn(
        'border-background-border bg-background-white w-full rounded-2xl border p-5 shadow-sm md:max-w-[695px] xl:max-w-[414px]',
        className
      )}
    >
      <h2 className="text-text-primary mb-4 text-lg font-bold">關注的職位</h2>

      {groups.length === 0 ? (
        <p className="text-text-tertiary text-sm">尚未選擇職位</p>
      ) : (
        <div className="flex flex-col gap-2.5 p-0.5">
          {groups.map((group) => {
            const isActive = activeDirection === group.key;
            return (
              <button
                key={group.key}
                type="button"
                aria-pressed={isActive}
                onClick={() => onSelectDirection?.(group.key)}
                className={cn(
                  'focus-visible:ring-brand-500 flex w-full flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-none',
                  isActive
                    ? 'border-brand-500 bg-brand-100/40'
                    : 'border-background-border bg-background-white hover:border-brand-300'
                )}
              >
                <span className="text-text-primary text-sm font-semibold">
                  {group.label}
                </span>
                <span className="text-text-tertiary text-xs tabular-nums">
                  {group.skills.length} 項技能 · {group.topics.length} 個主題
                </span>
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
}
