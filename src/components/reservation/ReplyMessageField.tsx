'use client';

import { MessageSquarePlus } from 'lucide-react';
import * as React from 'react';

import { Textarea } from '@/components/ui/textarea';

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
        className="text-text-tertiary hover:text-text-primary flex items-center gap-1.5 text-sm"
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
      <div className="rounded-2xl border p-2">
        <Textarea
          placeholder={placeholder}
          className="min-h-[96px] resize-y border-0 shadow-none focus-visible:ring-0"
          {...textareaProps}
          disabled={disabled || textareaProps.disabled}
        />
      </div>
      {error ? (
        <p className="text-status-error-default mt-1 text-sm">{error}</p>
      ) : null}
    </div>
  );
}
