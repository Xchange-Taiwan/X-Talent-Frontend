'use client';

import { MessageSquarePlus } from 'lucide-react';
import * as React from 'react';

import { Textarea } from '@/components/ui/textarea';
import {
  FOCUS_RING_CLASSES,
  FOCUS_WITHIN_RING_CLASSES,
} from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';

interface ReplyMessageFieldProps {
  open: boolean;
  onOpen: () => void;
  disabled?: boolean;
  error?: string;
  textareaProps: React.ComponentProps<typeof Textarea>;
  toggleLabel?: string;
  fieldLabel?: string;
  placeholder?: string;
}

/**
 * Toggle button + textarea for an optional reply message, shared by
 * AcceptReservationDialog (plain useState) and QuickReplyDialog
 * (react-hook-form). Open/close state stays owned by the caller since each
 * caller resets it differently on its own dialog's open/close lifecycle.
 */
export function ReplyMessageField({
  open,
  onOpen,
  disabled,
  error,
  textareaProps,
  toggleLabel = '附上回覆訊息（選填）',
  fieldLabel = '給學員的回覆（選填）',
  placeholder = '例如：屆時於 Google Meet 見,請先準備一份履歷。',
}: ReplyMessageFieldProps) {
  if (!open) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex items-center gap-1.5 rounded-sm text-sm text-text-tertiary hover:text-text-primary',
          FOCUS_RING_CLASSES
        )}
        disabled={disabled}
      >
        <MessageSquarePlus className="size-4" aria-hidden />
        {toggleLabel}
      </button>
    );
  }

  return (
    <div>
      <div className="mb-2 text-sm font-medium">{fieldLabel}</div>
      <div
        className={cn(
          'rounded-2xl border p-2 transition-shadow',
          FOCUS_WITHIN_RING_CLASSES
        )}
      >
        <Textarea
          placeholder={placeholder}
          className="min-h-[96px] resize-y border-0 shadow-none focus-visible:ring-0 focus-visible:outline-none"
          {...textareaProps}
          disabled={disabled || textareaProps.disabled}
        />
      </div>
      {error ? (
        <p className="mt-1 text-sm text-status-error-default">{error}</p>
      ) : null}
    </div>
  );
}
