import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it } from 'vitest';

import { FEEDBACK_FORM_URL } from '@/constant/externalLinks';
import { UNPUBLICIZED_FEEDBACK_NOTICE } from '@/lib/reservation/resolveHistoryFeedbackState';

import { ReservationFeedbackBlock } from './ReservationFeedbackBlock';

describe('ReservationFeedbackBlock', () => {
  it('renders public rating score and comment cleanly', () => {
    render(
      <ReservationFeedbackBlock
        model={{
          kind: 'public-rating',
          label: '我的評價',
          rating: 9,
          content: '導師針對履歷提供了非常具體的建議！',
        }}
      />
    );

    expect(
      screen.getByTestId('reservation-feedback-public')
    ).toBeInTheDocument();
    expect(screen.getByText('我的評價')).toBeInTheDocument();
    expect(screen.getByText('9 / 10')).toBeInTheDocument();
    expect(
      screen.getByText('導師針對履歷提供了非常具體的建議！')
    ).toBeInTheDocument();
  });

  it('renders unpublicized notice and feedback form link when kind is unpublicized', () => {
    render(
      <ReservationFeedbackBlock
        model={{
          kind: 'unpublicized',
          rating: 8,
          content: '謝謝分享',
          notice: UNPUBLICIZED_FEEDBACK_NOTICE,
        }}
      />
    );

    const block = screen.getByTestId('reservation-feedback-unpublicized');
    expect(block).toBeInTheDocument();
    expect(block.textContent).toContain(UNPUBLICIZED_FEEDBACK_NOTICE);

    const formLink = screen.getByRole('link', { name: '回饋表單' });
    expect(formLink).toHaveAttribute('href', FEEDBACK_FORM_URL);
  });
});
