import { fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { FEEDBACK_FORM_URL } from '@/constant/externalLinks';
import { UNPUBLICIZED_FEEDBACK_NOTICE } from '@/lib/reservation/resolveHistoryFeedbackState';

import {
  EMPTY_FEEDBACK_CONTENT_TEXT,
  ReservationFeedbackBlock,
  ReservationFeedbackHeaderToggle,
} from './ReservationFeedbackBlock';

describe('ReservationFeedbackBlock & HeaderToggle', () => {
  it('renders public rating score, 我的回饋 title, and comment cleanly', () => {
    render(
      <ReservationFeedbackBlock
        model={{
          kind: 'public-rating',
          label: '我的回饋',
          rating: 9,
          content: '導師針對履歷提供了非常具體的建議！',
        }}
      />
    );

    expect(
      screen.getByTestId('reservation-feedback-public')
    ).toBeInTheDocument();
    expect(screen.getByText('我的回饋')).toBeInTheDocument();
    expect(screen.getByText('9 / 10')).toBeInTheDocument();
    expect(
      screen.getByText('導師針對履歷提供了非常具體的建議！')
    ).toBeInTheDocument();
  });

  it('displays 沒有留下文字回饋。 when comment content is empty or whitespace-only', () => {
    const { rerender } = render(
      <ReservationFeedbackBlock
        model={{
          kind: 'public-rating',
          label: '我的回饋',
          rating: 10,
          content: '',
        }}
      />
    );

    expect(screen.getByText(EMPTY_FEEDBACK_CONTENT_TEXT)).toBeInTheDocument();

    rerender(
      <ReservationFeedbackBlock
        model={{
          kind: 'unpublicized',
          rating: 8,
          content: '   ',
          notice: UNPUBLICIZED_FEEDBACK_NOTICE,
        }}
      />
    );

    expect(screen.getByText('我的回饋')).toBeInTheDocument();
    expect(screen.getByText(EMPTY_FEEDBACK_CONTENT_TEXT)).toBeInTheDocument();
  });

  it('renders warm-yellow #734 unpublicized notice and feedback form link when kind is unpublicized', () => {
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
    expect(block.textContent).toContain('評價未公開');
    expect(block.textContent).toContain('我的回饋');
    expect(block.textContent).toContain(UNPUBLICIZED_FEEDBACK_NOTICE);

    const formLink = screen.getByRole('link', { name: '回饋表單' });
    expect(formLink).toHaveAttribute('href', FEEDBACK_FORM_URL);
  });

  it('renders ReservationFeedbackHeaderToggle with warm-yellow badge and hover/focus tooltip (#734)', () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <ReservationFeedbackHeaderToggle
        action={{
          kind: 'unpublicized-toggle',
          badgeLabel: '評價未公開',
          expandTooltip: '展開評價未公開說明',
          collapseTooltip: '收合評價未公開說明',
        }}
        isExpanded={false}
        onToggle={onToggle}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('評價未公開');
    const toggleBtn = screen.getByRole('button', {
      name: '展開評價未公開說明',
    });
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');

    fireEvent.mouseEnter(toggleBtn);
    expect(screen.getByTestId('unpublicized-toggle-tooltip')).toHaveTextContent(
      '展開評價未公開說明'
    );
    fireEvent.click(toggleBtn);
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(
      <ReservationFeedbackHeaderToggle
        action={{
          kind: 'unpublicized-toggle',
          badgeLabel: '評價未公開',
          expandTooltip: '展開評價未公開說明',
          collapseTooltip: '收合評價未公開說明',
        }}
        isExpanded={true}
        onToggle={onToggle}
      />
    );
    expect(
      screen.getByRole('button', { name: '收合評價未公開說明' })
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('unpublicized-toggle-tooltip')).toHaveTextContent(
      '收合評價未公開說明'
    );
  });

  it('renders 編輯 button (and never 刪除) for Mentee rated blocks when canEdit is true (#731)', () => {
    const onEditPublic = vi.fn();
    const { rerender } = render(
      <ReservationFeedbackBlock
        model={{
          kind: 'public-rating',
          label: '我的回饋',
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

  it('does not render 編輯 or 刪除 buttons when canEdit is false and displays 遮罩姓名 · 分數 / 10 · 日期 for Mentor view (#735)', () => {
    render(
      <ReservationFeedbackBlock
        model={{
          kind: 'public-rating',
          label: '學員評價',
          rating: 10,
          content: '學員好評',
          authorMaskedName: '王＊明',
          formattedDate: '2026/10/28',
          mentorAttendanceLabel: '已回報：有進行',
          canEdit: false,
        }}
        editAction={<button type="button">編輯</button>}
      />
    );

    expect(screen.getByText('學員評價')).toBeInTheDocument();
    expect(screen.getByTestId('mentor-attendance-record')).toHaveTextContent(
      '已回報：有進行'
    );
    const metaRow = screen.getByTestId('mentor-feedback-meta');
    expect(metaRow).toHaveTextContent('王＊明');
    expect(metaRow).toHaveTextContent('10 / 10');
    expect(metaRow).toHaveTextContent('2026/10/28');
    expect(screen.getByText('學員好評')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '編輯' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /刪除/ })
    ).not.toBeInTheDocument();
  });

  it('renders Mentor attendance-only record block without leaking Mentee attendance state (#735)', () => {
    render(
      <ReservationFeedbackBlock
        model={{
          kind: 'mentor-record',
          attendanceLabel: '已回報：有進行',
        }}
      />
    );

    expect(
      screen.getByTestId('reservation-feedback-mentor-record')
    ).toBeInTheDocument();
    expect(screen.getByText('會談紀錄')).toBeInTheDocument();
    expect(screen.getByTestId('mentor-attendance-record')).toHaveTextContent(
      '已回報：有進行'
    );
    expect(screen.queryByText(/目前尚無|等待|尚未/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '編輯' })
    ).not.toBeInTheDocument();
  });
});
