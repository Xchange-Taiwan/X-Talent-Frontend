import { AlertCircle, Star } from 'lucide-react';
import * as React from 'react';

import { FEEDBACK_FORM_URL } from '@/components/layout/Header/constants';
import type { HistoryFeedbackBlockModel } from '@/lib/reservation/resolveHistoryFeedbackState';

export interface ReservationFeedbackBlockProps {
  model: HistoryFeedbackBlockModel;
}

export function ReservationFeedbackBlock({
  model,
}: ReservationFeedbackBlockProps) {
  if (model.kind === 'unpublicized') {
    return (
      <div
        data-testid="reservation-feedback-unpublicized"
        className="border-background-border bg-background-bottom mt-3 space-y-2 rounded-xl border p-3 sm:p-3.5"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-text-secondary text-xs font-medium">
            我的評價
          </span>
          <span className="text-text-secondary inline-flex items-center gap-1 text-xs font-semibold tabular-nums sm:text-sm">
            <Star
              className="fill-text-tertiary text-text-tertiary size-3.5"
              aria-hidden="true"
            />
            <span>{model.rating} / 10</span>
          </span>
        </div>

        {model.content ? (
          <p className="text-text-secondary text-xs leading-relaxed whitespace-pre-line sm:text-sm">
            {model.content}
          </p>
        ) : null}

        <div
          role="note"
          className="border-background-border bg-background-white text-text-secondary flex items-start gap-2 rounded-lg border p-2.5 text-xs leading-relaxed"
        >
          <AlertCircle
            className="text-text-tertiary mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <p>
            這場會談已被標註沒有進行，因此評價不會公開；如有疑問可以透過
            <a
              href={FEEDBACK_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-700 font-medium underline underline-offset-2 hover:opacity-80"
            >
              回饋表單
            </a>
            聯繫我們。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="reservation-feedback-public"
      className="border-background-border/70 bg-background-bottom-secondary mt-3 rounded-xl border p-3 sm:p-3.5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-text-secondary text-xs font-medium">
          {model.label}
        </span>
        <span className="text-brand-700 inline-flex items-center gap-1 text-xs font-semibold tabular-nums sm:text-sm">
          <Star
            className="fill-brand-700 text-brand-700 size-3.5"
            aria-hidden="true"
          />
          <span>{model.rating} / 10</span>
        </span>
      </div>

      {model.content ? (
        <p className="text-text-primary mt-1.5 text-xs leading-relaxed whitespace-pre-line sm:text-sm">
          {model.content}
        </p>
      ) : null}
    </div>
  );
}
