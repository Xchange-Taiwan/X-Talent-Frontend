'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SlotDurationMinutes } from '@/lib/profile/bookingAvailability';
import { DURATION_OPTIONS } from '@/lib/profile/scheduleFormatters';
import { cn } from '@/lib/utils';

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, '0')
);
const MINUTE_OPTIONS = ['00', '15', '30', '45'];

export interface TimeSelectPairProps {
  hourValue: string;
  minuteValue: string;
  onHourChange: (value: string) => void;
  onMinuteChange: (value: string) => void;
}

export function TimeSelectPair({
  hourValue,
  minuteValue,
  onHourChange,
  onMinuteChange,
}: TimeSelectPairProps) {
  return (
    <div className="flex items-center gap-3">
      <Select value={hourValue} onValueChange={onHourChange}>
        <SelectTrigger className="h-12 w-24 text-base lg:w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="min-w-40">
          {HOUR_OPTIONS.map((opt) => (
            <SelectItem key={opt} value={opt} className="py-3 text-base">
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-text-tertiary text-base">:</span>
      <Select value={minuteValue} onValueChange={onMinuteChange}>
        <SelectTrigger className="h-12 w-24 text-base lg:w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="min-w-40">
          {MINUTE_OPTIONS.map((opt) => (
            <SelectItem key={opt} value={opt} className="py-3 text-base">
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export interface DurationRadioProps {
  value: SlotDurationMinutes;
  onChange: (value: SlotDurationMinutes) => void;
}

export function DurationRadio({ value, onChange }: DurationRadioProps) {
  return (
    <div className="flex gap-2">
      {DURATION_OPTIONS.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            'flex-1 rounded-lg border px-4 py-2 text-base transition-colors',
            value === opt
              ? 'border-brand-500 bg-brand-500/10 text-brand-500'
              : 'border-background-border bg-background-white hover:bg-background-bottom/50'
          )}
        >
          {opt} 分
        </button>
      ))}
    </div>
  );
}
