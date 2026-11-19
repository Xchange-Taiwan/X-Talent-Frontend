'use client';

import { ArrowDownUp } from 'lucide-react';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { FOCUS_RING_NO_OFFSET_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';

export interface ExperienceReorderHeaderProps {
  index: number;
  total: number;
  itemLabel: string;
  onMove: (from: number, to: number) => void;
}

export function ExperienceReorderHeader({
  index,
  total,
  itemLabel,
  onMove,
}: ExperienceReorderHeaderProps): React.ReactElement {
  const [open, setOpen] = useState(false);

  const runMove = (to: number) => {
    if (to < 0 || to >= total || to === index) return;
    onMove(index, to);
    setOpen(false);
  };

  return (
    <div className="border-background-border mb-5 flex items-center justify-between gap-3 border-b pb-3">
      <span className="text-text-tertiary text-xs font-medium tabular-nums">
        第 {index + 1} 筆／共 {total} 筆
      </span>

      {total > 1 && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`調整第 ${index + 1} 筆${itemLabel}順序`}
              className={cn(
                FOCUS_RING_NO_OFFSET_CLASSES,
                'text-text-secondary hover:bg-background-bottom hover:text-text-primary h-8 gap-1.5 rounded-md px-2.5 text-xs font-medium'
              )}
            >
              <ArrowDownUp className="size-3.5" aria-hidden="true" />
              調整順序
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-40 p-1.5">
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => runMove(0)}
                className={cn(
                  FOCUS_RING_NO_OFFSET_CLASSES,
                  'text-text-primary hover:bg-background-bottom rounded-md px-3 py-2 text-left text-xs font-medium disabled:pointer-events-none disabled:opacity-40'
                )}
              >
                移到最前
              </button>
              <button
                type="button"
                disabled={index === 0}
                onClick={() => runMove(index - 1)}
                className={cn(
                  FOCUS_RING_NO_OFFSET_CLASSES,
                  'text-text-primary hover:bg-background-bottom rounded-md px-3 py-2 text-left text-xs font-medium disabled:pointer-events-none disabled:opacity-40'
                )}
              >
                移到上一筆
              </button>
              <button
                type="button"
                disabled={index === total - 1}
                onClick={() => runMove(index + 1)}
                className={cn(
                  FOCUS_RING_NO_OFFSET_CLASSES,
                  'text-text-primary hover:bg-background-bottom rounded-md px-3 py-2 text-left text-xs font-medium disabled:pointer-events-none disabled:opacity-40'
                )}
              >
                移到下一筆
              </button>
              <button
                type="button"
                disabled={index === total - 1}
                onClick={() => runMove(total - 1)}
                className={cn(
                  FOCUS_RING_NO_OFFSET_CLASSES,
                  'text-text-primary hover:bg-background-bottom rounded-md px-3 py-2 text-left text-xs font-medium disabled:pointer-events-none disabled:opacity-40'
                )}
              >
                移到最後
              </button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
