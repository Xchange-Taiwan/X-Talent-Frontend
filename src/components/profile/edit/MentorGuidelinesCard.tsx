'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import React, { useId, useState } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { FOCUS_RING_NO_OFFSET_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';

export interface MentorGuidelineItem {
  title: string;
  description: string;
}

export const MENTOR_GUIDELINE_ITEMS: ReadonlyArray<MentorGuidelineItem> = [
  {
    title: '真實身分',
    description: '使用真人照片與真實經歷。',
  },
  {
    title: '準時出席',
    description: '無法出席時，請於開始前 24 小時取消。',
  },
  {
    title: '尊重隱私',
    description: '未經學員許可，不公開對談細節到社群媒體。',
  },
  {
    title: '成長計畫',
    description: '成為導師即為 L1，累積服務時數可升級至 L5。',
  },
];

export interface MentorGuidelinesCardProps {
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  errorMessage?: string;
  defaultExpanded?: boolean;
  className?: string;
}

export function MentorGuidelinesCard({
  id = 'agreed_guidelines',
  checked,
  onCheckedChange,
  errorMessage,
  defaultExpanded = false,
  className,
}: MentorGuidelinesCardProps) {
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);
  const checkboxId = useId();
  const detailsId = useId();

  return (
    <section
      id={id}
      aria-label="導師規範"
      data-testid="mentor-guidelines-card"
      className={cn('bg-background-hover rounded-[10px] px-4 py-3', className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Checkbox
            id={checkboxId}
            checked={checked}
            onCheckedChange={(val) => onCheckedChange(val === true)}
          />
          <label
            htmlFor={checkboxId}
            className="text-text-primary cursor-pointer text-sm font-semibold select-none"
          >
            我已閱讀並同意導師規範
          </label>
        </div>

        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setExpanded((prev) => !prev)}
          className={cn(
            FOCUS_RING_NO_OFFSET_CLASSES,
            'text-brand-700 hover:text-brand-500 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors'
          )}
        >
          <span>查看規範</span>
          {expanded ? (
            <ChevronUp className="size-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
          )}
        </button>
      </div>

      {errorMessage && (
        <p
          role="alert"
          className="text-status-error-default mt-2 text-xs font-medium"
        >
          {errorMessage}
        </p>
      )}

      {expanded && (
        <div
          id={detailsId}
          data-testid="mentor-guidelines-details"
          className="border-background-border/80 mt-3.5 border-t pt-3.5"
        >
          <ul className="space-y-2">
            {MENTOR_GUIDELINE_ITEMS.map((item) => (
              <li
                key={item.title}
                className="flex flex-col gap-0.5 text-xs sm:flex-row sm:items-baseline sm:gap-4"
              >
                <span className="text-text-primary shrink-0 font-bold sm:w-16">
                  {item.title}
                </span>
                <span className="text-text-secondary leading-relaxed">
                  {item.description}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
