'use client';

import { Check, HeartHandshake, Info, UserRound } from 'lucide-react';
import React from 'react';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { FOCUS_RING_NO_OFFSET_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';
import type { OnboardingRole } from '@/schemas/onboarding';

export interface RoleSelectorCardsProps {
  value: OnboardingRole;
  onChange: (next: OnboardingRole) => void;
  disabled?: boolean;
}

const ROLE_OPTIONS: ReadonlyArray<{
  role: OnboardingRole;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}> = [
  {
    role: 'mentee',
    title: 'Mentee',
    subtitle: '想深入了解某個職涯',
    icon: <UserRound className="size-6" aria-hidden="true" />,
  },
  {
    role: 'mentor',
    title: 'Mentor',
    subtitle: '想用經驗回饋他人',
    icon: <HeartHandshake className="size-6" aria-hidden="true" />,
  },
];

export function RoleSelectorCards({
  value,
  onChange,
  disabled = false,
}: RoleSelectorCardsProps): React.ReactElement {
  return (
    <section aria-labelledby="onboarding-role-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <h2
          id="onboarding-role-heading"
          className="text-text-primary text-lg font-semibold"
        >
          你想先以哪個身分開始？
        </h2>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="雙軌身分說明"
              className={cn(
                FOCUS_RING_NO_OFFSET_CLASSES,
                'text-text-tertiary hover:text-text-primary inline-flex size-6 cursor-pointer items-center justify-center rounded-full transition-colors'
              )}
            >
              <Info className="size-4" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-72 p-3.5 text-xs leading-relaxed"
          >
            同一個帳號可同時作為 Mentee 探索職涯，也能成為 Mentor
            分享經驗。完成導師資料後即為 L1 導師，未來可隨時切換身分。
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-1 gap-4 p-0.5 sm:grid-cols-2">
        {ROLE_OPTIONS.map((option) => {
          const selected = value === option.role;
          return (
            <button
              key={option.role}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              data-testid={`onboarding-role-${option.role}`}
              onClick={() => onChange(option.role)}
              className={cn(
                FOCUS_RING_NO_OFFSET_CLASSES,
                'flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl border p-4 text-left transition-colors disabled:pointer-events-none disabled:opacity-50',
                selected
                  ? 'border-brand-500 bg-brand-50/75'
                  : 'border-background-border bg-background-white hover:bg-background-bottom-secondary/50'
              )}
            >
              <span className="flex items-center gap-3.5">
                <span
                  className={cn(
                    'grid size-10 shrink-0 place-items-center rounded-full',
                    selected
                      ? 'bg-brand-100/80 text-brand-700'
                      : 'bg-background-bottom-secondary text-text-secondary'
                  )}
                >
                  {option.icon}
                </span>
                <span className="flex flex-col">
                  <strong className="text-text-primary text-base font-semibold">
                    {option.title}
                  </strong>
                  <span className="text-text-secondary mt-0.5 text-xs">
                    {option.subtitle}
                  </span>
                </span>
              </span>

              <span
                aria-hidden="true"
                className={cn(
                  'grid size-5 shrink-0 place-items-center rounded-full border transition-colors',
                  selected
                    ? 'border-brand-700 bg-brand-700 text-background-white'
                    : 'border-background-border bg-background-white'
                )}
              >
                {selected && <Check className="size-3 stroke-[2.5]" />}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
