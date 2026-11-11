import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MentorSummaryBar } from './MentorSummaryBar';
import * as stories from './MentorSummaryBar.stories';

describe('MentorSummaryBar (#736)', () => {
  it('renders 4 equal-width metric columns and fixed industry pills when mentor has ratings', () => {
    const { container } = render(
      <MentorSummaryBar
        ratingAverage={8.5}
        ratingCount={12}
        completedMeetingCount={128}
        yearsOfExperience="5~10 年"
        location="台灣"
        industries={[
          { subject_group: 'software', subject: '軟體及網路相關業' },
          { subject_group: 'design', subject: '設計及創意相關業' },
        ]}
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
    expect(screen.getByText('產業')).toBeInTheDocument();
    expect(screen.getByText('軟體及網路相關業')).toBeInTheDocument();
    expect(screen.getByText('設計及創意相關業')).toBeInTheDocument();

    const grid = container.querySelector('.grid');
    expect(grid).toHaveClass('md:grid-cols-4');
  });

  it('hides rating cell when ratingCount is 0 and expands remaining 3 columns across full width', () => {
    const { container } = render(
      <MentorSummaryBar
        ratingAverage={8.5}
        ratingCount={0}
        completedMeetingCount={128}
        yearsOfExperience="5~10 年"
        location="台灣"
        industries={[
          { subject_group: 'software', subject: '軟體及網路相關業' },
        ]}
      />
    );

    expect(screen.queryByText('評分')).not.toBeInTheDocument();
    expect(screen.queryByText('/ 10')).not.toBeInTheDocument();
    expect(screen.getByText('已完成 1-on-1')).toBeInTheDocument();
    expect(screen.getByText('經驗')).toBeInTheDocument();
    expect(screen.getByText('地點')).toBeInTheDocument();

    const grid = container.querySelector('.grid');
    expect(grid).toHaveClass('sm:grid-cols-3');
    expect(grid).not.toHaveClass('md:grid-cols-4');
  });

  it('exports valid Storybook stories covering rated and zero-rating states', () => {
    expect(stories.default.component).toBe(MentorSummaryBar);
    expect(stories.FourColumnsWithRatings.args?.ratingCount).toBe(12);
    expect(stories.ThreeColumnsZeroRatings.args?.ratingCount).toBe(0);
  });
});
