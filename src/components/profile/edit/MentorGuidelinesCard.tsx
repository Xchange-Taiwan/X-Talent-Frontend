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
    description: '在未經學員許可前，不公開對談細節到社群媒體。',
  },
  {
    title: '成長計畫',
    description: '成為導師即為 L1，累積服務時數可升級至 L5。',
  },
];

export interface MentorGuidelinesCardProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  defaultExpanded?: boolean;
  className?: string;
}

export function MentorGuidelinesCard({
  checked,
  onCheckedChange,
  defaultExpanded = false,
  className,
}: MentorGuidelinesCardProps) {
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);
  const checkboxId = useId();
  const detailsId = useId();

  return (
    <section
      aria-label="導師規範"
      data-testid="mentor-guidelines-card"
      className={cn(
        'border-background-border bg-background-white rounded-2xl border p-5 shadow-sm',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 p-0.5">
        <div className="flex items-center gap-3">
          <Checkbox
            id={checkboxId}
            checked={checked}
            onCheckedChange={(val) => onCheckedChange(val === true)}
          />
          <label
            htmlFor={checkboxId}
            className="text-text-primary cursor-pointer text-sm font-semibold select-none"
          >
            <span className="text-status-error-default mr-1" aria-hidden="true">
              *
            </span>
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
            'text-brand-700 hover:text-brand-500 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors'
          )}
        >
          <span>查看規範</span>
          {expanded ? (
            <ChevronUp className="size-4 shrink-0" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
          )}
        </button>
      </div>

      {expanded && (
        <div
          id={detailsId}
          data-testid="mentor-guidelines-details"
          className="border-background-border mt-4 border-t pt-4"
        >
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {MENTOR_GUIDELINE_ITEMS.map((item) => (
              <li
                key={item.title}
                className="bg-background-bottom-secondary/50 rounded-xl px-4 py-3"
              >
                <p className="text-text-primary mb-1 text-sm font-semibold">
                  {item.title}
                </p>
                <p className="text-text-secondary text-xs leading-relaxed">
                  {item.description}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
