'use client';

import { Compass } from 'lucide-react';

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
        'border-background-border bg-background-white w-full rounded-2xl border p-6 shadow-xs md:max-w-[695px] xl:max-w-[414px]',
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-text-primary text-lg font-bold">關注的職位</h2>
        <Compass
          className="text-text-tertiary size-5 shrink-0"
          aria-hidden="true"
        />
      </div>

      {groups.length === 0 ? (
        <p className="text-text-tertiary text-sm">尚未選擇職位</p>
      ) : (
        <div className="divide-background-border flex flex-col divide-y">
          {groups.map((group) => {
            const isActive = activeDirection === group.key;
            return (
              <div key={group.key} className="py-3 first:pt-1 last:pb-1">
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onSelectDirection?.(group.key)}
                  className="focus-visible:ring-brand-500 -mx-2 flex w-full flex-col items-start gap-1 rounded-lg px-2 py-1 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      'text-sm transition-colors',
                      isActive
                        ? 'text-brand-700 font-bold'
                        : 'text-text-primary hover:text-brand-700 font-semibold'
                    )}
                  >
                    {group.label}
                  </span>
                  <span className="text-text-tertiary text-xs tabular-nums">
                    {group.skills.length} 項技能 · {group.topics.length} 個主題
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
