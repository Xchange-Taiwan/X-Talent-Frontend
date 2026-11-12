import { fireEvent, render, screen, within } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

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

  it('renders amber 評價未公開 badge, expandable/collapsible notice with bold title and feedback form link (no icon), and preserves Mentee rating & comment (#734)', () => {
    render(
      <ReservationFeedbackBlock
        model={{
          kind: 'unpublicized',
          rating: 8,
          content: '謝謝分享',
          notice: UNPUBLICIZED_FEEDBACK_NOTICE,
          canEdit: true,
        }}
      />
    );

    const block = screen.getByTestId('reservation-feedback-unpublicized');
    expect(block).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('評價未公開');
    const notice = screen.getByTestId('unpublicized-feedback-notice');
    expect(within(notice).getByText('評價未公開')).toBeInTheDocument();
    expect(notice.querySelector('svg')).toBeNull();
    expect(block.textContent).toContain(UNPUBLICIZED_FEEDBACK_NOTICE);
    expect(screen.getByText('8 / 10')).toBeInTheDocument();
    expect(screen.getByText('謝謝分享')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '編輯' })).toBeInTheDocument();

    const formLink = screen.getByRole('link', { name: '回饋表單' });
    expect(formLink).toHaveAttribute('href', FEEDBACK_FORM_URL);

    // Collapse the unpublicized explanation notice -> Mentee rating, comment, and 編輯 button remain visible
    const collapseBtn = screen.getByRole('button', {
      name: '收合評價未公開說明',
    });
    expect(collapseBtn).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(collapseBtn);

    expect(
      screen.queryByTestId('unpublicized-feedback-notice')
    ).not.toBeInTheDocument();
    expect(screen.getByText('8 / 10')).toBeInTheDocument();
    expect(screen.getByText('謝謝分享')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '編輯' })).toBeInTheDocument();

    // Expand the unpublicized explanation notice back
    const expandBtn = screen.getByRole('button', {
      name: '展開評價未公開說明',
    });
    expect(expandBtn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(expandBtn);

    expect(
      screen.getByTestId('unpublicized-feedback-notice')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '回饋表單' })).toHaveAttribute(
      'href',
      FEEDBACK_FORM_URL
    );
  });

  it('renders 編輯 button (and never 刪除) for Mentee rated blocks when canEdit is true (#731)', () => {
    const onEditPublic = vi.fn();
    const { rerender } = render(
      <ReservationFeedbackBlock
        model={{
          kind: 'public-rating',
          label: '我的評價',
          rating: 9,
          content: '公開評論',
          canEdit: true,
        }}
        onEdit={onEditPublic}
      />
    );

    const editBtn = screen.getByRole('button', { name: '編輯' });
    expect(editBtn).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /刪除/ })
    ).not.toBeInTheDocument();
    fireEvent.click(editBtn);
    expect(onEditPublic).toHaveBeenCalledTimes(1);

    const onEditUnpublicized = vi.fn();
    rerender(
      <ReservationFeedbackBlock
        model={{
          kind: 'unpublicized',
          rating: 8,
          content: '未公開評論',
          notice: UNPUBLICIZED_FEEDBACK_NOTICE,
          canEdit: true,
        }}
        onEdit={onEditUnpublicized}
      />
    );

    const unpubEditBtn = screen.getByRole('button', { name: '編輯' });
    expect(unpubEditBtn).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /刪除/ })
    ).not.toBeInTheDocument();
    fireEvent.click(unpubEditBtn);
    expect(onEditUnpublicized).toHaveBeenCalledTimes(1);
  });

  it('does not render 編輯 button when canEdit is false (Mentor view)', () => {
    render(
      <ReservationFeedbackBlock
        model={{
          kind: 'public-rating',
          label: '學員評價',
          rating: 10,
          content: '學員好評',
          canEdit: false,
        }}
        editAction={<button type="button">編輯</button>}
      />
    );

    expect(
      screen.queryByRole('button', { name: '編輯' })
    ).not.toBeInTheDocument();
  });
});
