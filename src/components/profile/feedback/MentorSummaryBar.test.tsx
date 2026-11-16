import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MentorSummaryBar } from './MentorSummaryBar';
import * as stories from './MentorSummaryBar.stories';

describe('MentorSummaryBar (#736)', () => {
  it('renders 4 equal-width metric columns without standalone industry row when mentor has ratings and completed sessions', () => {
    render(
      <MentorSummaryBar
        ratingAverage={8.5}
        ratingCount={12}
        completedMeetingCount={128}
        yearsOfExperience="5~10 年"
        location="台灣"
      />
    );

    expect(screen.getByText('評分')).toBeInTheDocument();
    expect(screen.getByText('8.5')).toBeInTheDocument();
    expect(screen.getByText('/ 10')).toBeInTheDocument();
    expect(screen.getByText('已完成 1-on-1')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
    expect(screen.getByText('經驗')).toBeInTheDocument();
    expect(screen.getByText('5–10')).toBeInTheDocument();
    expect(screen.getByText('地點')).toBeInTheDocument();
    expect(screen.getByText('台灣')).toBeInTheDocument();
    expect(screen.queryByText('產業')).not.toBeInTheDocument();

    const grid = screen.getByTestId('mentor-summary-grid');
    expect(grid).toHaveClass('md:grid-cols-4');
    expect(grid.children).toHaveLength(4);
  });

  it('hides rating cell when ratingCount is 0 and expands remaining 3 columns across full width', () => {
    render(
      <MentorSummaryBar
        ratingAverage={8.5}
        ratingCount={0}
        completedMeetingCount={128}
        yearsOfExperience="5~10 年"
        location="台灣"
      />
    );

    expect(screen.queryByText('評分')).not.toBeInTheDocument();
    expect(screen.queryByText('/ 10')).not.toBeInTheDocument();
    expect(screen.getByText('已完成 1-on-1')).toBeInTheDocument();
    expect(screen.getByText('經驗')).toBeInTheDocument();
    expect(screen.getByText('地點')).toBeInTheDocument();

    const grid = screen.getByTestId('mentor-summary-grid');
    expect(grid).toHaveClass('sm:grid-cols-3');
    expect(grid).not.toHaveClass('md:grid-cols-4');
    expect(grid.children).toHaveLength(3);
  });

  it('hides completed 1-on-1 cell when completedMeetingCount is 0 while keeping rating cell in a 3-column grid', () => {
    render(
      <MentorSummaryBar
        ratingAverage={9.1}
        ratingCount={5}
        completedMeetingCount={0}
        yearsOfExperience="5~10 年"
        location="台灣"
      />
    );

    expect(screen.getByText('評分')).toBeInTheDocument();
    expect(screen.getByText('9.1')).toBeInTheDocument();
    expect(screen.queryByText('已完成 1-on-1')).not.toBeInTheDocument();
    expect(screen.getByText('經驗')).toBeInTheDocument();
    expect(screen.getByText('地點')).toBeInTheDocument();

    const grid = screen.getByTestId('mentor-summary-grid');
    expect(grid).toHaveClass('sm:grid-cols-3');
    expect(grid.children).toHaveLength(3);
  });

  it('hides both rating and completed 1-on-1 cells when both are 0 in a 2-column grid', () => {
    render(
      <MentorSummaryBar
        ratingAverage={null}
        ratingCount={0}
        completedMeetingCount={0}
        yearsOfExperience="3~5 年"
        location="台灣"
      />
    );

    expect(screen.queryByText('評分')).not.toBeInTheDocument();
    expect(screen.queryByText('已完成 1-on-1')).not.toBeInTheDocument();
    expect(screen.queryByText('產業')).not.toBeInTheDocument();
    expect(screen.getByText('經驗')).toBeInTheDocument();
    expect(screen.getByText('地點')).toBeInTheDocument();

    const grid = screen.getByTestId('mentor-summary-grid');
    expect(grid).toHaveClass('grid-cols-2');
    expect(grid).not.toHaveClass('sm:grid-cols-3');
    expect(grid).not.toHaveClass('md:grid-cols-4');
    expect(grid.children).toHaveLength(2);
  });

  it('exports valid Storybook stories covering 4-column, 3-column, and 2-column states', () => {
    expect(stories.default.component).toBe(MentorSummaryBar);
    expect(stories.FourColumnsWithRatings.args?.ratingCount).toBe(12);
    expect(stories.ThreeColumnsZeroRatings.args?.ratingCount).toBe(0);
    expect(stories.ThreeColumnsZeroSessions.args?.completedMeetingCount).toBe(
      0
    );
    expect(
      stories.NewMentorZeroSessionsAndZeroRatings.args?.completedMeetingCount
    ).toBe(0);
  });
});
