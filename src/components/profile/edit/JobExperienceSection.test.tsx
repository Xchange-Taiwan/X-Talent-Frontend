import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import React from 'react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import { Form } from '@/components/ui/form';
import type { ProfileFormContext } from '@/hooks/user/profile/useEditProfileForm';
import type { jobSchema } from '@/schemas/profileSchema';

import { JobExperienceSection } from './JobExperienceSection';

type JobExperience = z.infer<typeof jobSchema>;

/**
 * The work-experience shape reused across nearly every test below - a
 * factory keeps each test focused on the one field it's actually varying
 * instead of restating the whole object.
 */
function createMockExperience(
  overrides: Partial<JobExperience> = {}
): JobExperience {
  return {
    id: 1,
    job: '工程師 A',
    company: '公司 A',
    job_period_start: '2020',
    job_period_end: '2022',
    industry: 'TECH',
    job_location: 'TWN',
    description: '',
    is_primary: true,
    ...overrides,
  };
}

function Harness({
  defaultValue = [],
  isMentor = true,
  onValidationChange = () => {},
}: {
  defaultValue?: JobExperience[];
  isMentor?: boolean;
  onValidationChange?: (hasError: boolean) => void;
}) {
  const form = useForm({
    defaultValues: {
      work_experiences: defaultValue,
    },
  });

  const industries = [{ subject: '科技業', subject_group: 'TECH' }];
  const locations = [{ value: 'TWN', text: '台灣' }];

  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()}>
        <JobExperienceSection
          industries={industries}
          locations={locations}
          form={fromPartial<ProfileFormContext>(form)}
          isMentor={isMentor}
          onValidationChange={onValidationChange}
        />
      </form>
    </Form>
  );
}

describe('JobExperienceSection', () => {
  it('renders the "工作經驗" title', () => {
    render(<Harness />);
    expect(screen.getByText('工作經驗')).toBeInTheDocument();
  });

  it('renders correctly for mentee (isMentor = false)', () => {
    render(<Harness isMentor={false} />);
    expect(screen.getByText('工作經驗')).toBeInTheDocument();
  });

  it('renders existing work experiences correctly', () => {
    const existing = [
      createMockExperience({
        job: '資深工程師',
        company: '測試科技公司',
        job_period_end: 'now',
        description: '負責前端架構開發',
      }),
    ];

    render(<Harness defaultValue={existing} />);

    expect(screen.getByLabelText('職稱')).toHaveValue('資深工程師');
    expect(screen.getByLabelText('公司名稱')).toHaveValue('測試科技公司');
    expect(screen.getByLabelText('描述')).toHaveValue('負責前端架構開發');
  });

  it('adds a new empty work experience when clicking the plus button', async () => {
    render(<Harness defaultValue={[]} />);

    // Click add button
    const addButton = screen.getByRole('button', { name: '新增' });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByLabelText('職稱')).toHaveValue('');
      expect(screen.getByLabelText('公司名稱')).toHaveValue('');
    });
  });

  it('prevents adding a new work experience with various incomplete fields', () => {
    const fields = ['job', 'company', 'job_period_start', 'job_period_end'];
    fields.forEach((field) => {
      const incomplete = [
        createMockExperience({
          job: field === 'job' ? '' : '工程師',
          company: field === 'company' ? '' : '公司',
          job_period_start: field === 'job_period_start' ? '' : '2020',
          job_period_end: field === 'job_period_end' ? '' : '2022',
          description: '',
        }),
      ];

      const { unmount } = render(<Harness defaultValue={incomplete} />);
      const addButton = screen.getByRole('button', { name: '新增' });
      fireEvent.click(addButton);

      // Verify that no new item was added
      const jobFields = screen.getAllByLabelText('職稱');
      expect(jobFields).toHaveLength(1);
      unmount();
    });
  });

  it('checks chronological logical date ranges validation (starts after ends)', async () => {
    const invalidDates = [
      createMockExperience({
        job_period_start: '2023',
        job_period_end: '2020', // End before Start!
        description: '',
      }),
    ];

    render(<Harness defaultValue={invalidDates} />);

    expect(screen.getByText('開始年份不可大於結束年份')).toBeInTheDocument();
  });

  it('does not flag a "至今" (ongoing) position as an invalid date range, regardless of start year', () => {
    const ongoing = [
      createMockExperience({
        job_period_start: '2023',
        job_period_end: 'now',
        description: '',
      }),
    ];

    render(<Harness defaultValue={ongoing} />);

    expect(
      screen.queryByText('開始年份不可大於結束年份')
    ).not.toBeInTheDocument();
  });

  it('deletes work experiences on trash button click and reassigns primary', async () => {
    const existing = [
      createMockExperience({ job: '工程師 A', company: '公司 A' }),
      createMockExperience({
        id: 2,
        job: '工程師 B',
        company: '公司 B',
        is_primary: false,
      }),
    ];

    render(<Harness defaultValue={existing} />);

    // Click "移除" on the first experience (index 0)
    const removeButtons = screen.getAllByRole('button', { name: '移除' });
    fireEvent.click(removeButtons[0]);

    // Click "確認" inside the Dialog
    const confirmButton = screen.getByRole('button', { name: '確認' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      // Index 1 (Engineer B) should be kept, and should now be primary and first in list
      expect(screen.getByLabelText('職稱')).toHaveValue('工程師 B');
    });
  });

  it('hides the remove button for the sole remaining experience, so it can never be deleted down to an empty (broken) state', () => {
    const existing = [createMockExperience()];

    render(<Harness defaultValue={existing} />);

    expect(
      screen.queryByRole('button', { name: '移除' })
    ).not.toBeInTheDocument();
    // The field itself is still there and usable.
    expect(screen.getByLabelText('職稱')).toHaveValue('工程師 A');
  });

  it('shows the remove button again once a second experience exists', () => {
    const existing = [
      createMockExperience({ job: '工程師 A', company: '公司 A' }),
      createMockExperience({
        id: 2,
        job: '工程師 B',
        company: '公司 B',
        is_primary: false,
      }),
    ];

    render(<Harness defaultValue={existing} />);

    expect(screen.getAllByRole('button', { name: '移除' })).toHaveLength(2);
  });

  it('toggles primary work experience using the checkbox', async () => {
    const existing = [
      createMockExperience({ job: '工程師 A', company: '公司 A' }),
      createMockExperience({
        id: 2,
        job: '工程師 B',
        company: '公司 B',
        is_primary: false,
      }),
    ];

    render(<Harness defaultValue={existing} />);

    const checkboxes = screen.getAllByRole('checkbox');

    // Toggle primary off from index 0 directly to trigger false/onChange branch
    fireEvent.click(checkboxes[0]);
    await waitFor(() => {
      expect(checkboxes[0]).not.toBeChecked();
    });

    // Toggle primary to index 1 (Engineer B)
    fireEvent.click(checkboxes[1]);
    await waitFor(() => {
      expect(checkboxes[1]).toBeChecked();
      expect(checkboxes[0]).not.toBeChecked();
    });
  });

  it('can reorder items up and down', async () => {
    const existing = [
      createMockExperience({ job: '工程師 A', company: '公司 A' }),
      createMockExperience({
        id: 2,
        job: '工程師 B',
        company: '公司 B',
        is_primary: false,
      }),
    ];

    render(<Harness defaultValue={existing} />);

    const buttons = screen.getAllByRole('button');
    // Filter out buttons without text content (the icon-only Up/Down move buttons)
    const iconButtons = buttons.filter((b) => !b.textContent);

    // For first item (index 0): Up is iconButtons[0] (disabled), Down is iconButtons[1] (enabled)
    // For second item (index 1): Up is iconButtons[2] (enabled), Down is iconButtons[3] (disabled)
    expect(iconButtons[0]).toBeDisabled();
    expect(iconButtons[1]).toBeEnabled();
    expect(iconButtons[2]).toBeEnabled();
    expect(iconButtons[3]).toBeDisabled();

    // Click the down button on first item
    fireEvent.click(iconButtons[1]);
    await waitFor(() => {
      expect(screen.getAllByLabelText('職稱')[0]).toHaveValue('工程師 B');
    });

    const updatedButtons = screen.getAllByRole('button');
    const updatedIconButtons = updatedButtons.filter((b) => !b.textContent);

    // Click the up button on second item (which is now Engineer A)
    fireEvent.click(updatedIconButtons[2]);
    await waitFor(() => {
      expect(screen.getAllByLabelText('職稱')[0]).toHaveValue('工程師 A');
    });
  });

  it('deletes a non-primary experience directly without primary reassign', async () => {
    const existing = [
      createMockExperience({ job: '工程師 A', company: '公司 A' }),
      createMockExperience({
        id: 2,
        job: '工程師 B',
        company: '公司 B',
        is_primary: false,
      }),
    ];

    render(<Harness defaultValue={existing} />);

    // Click "移除" on the second experience (index 1) which is not primary
    const removeButtons = screen.getAllByRole('button', { name: '移除' });
    fireEvent.click(removeButtons[1]);

    const confirmButton = screen.getByRole('button', { name: '確認' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      // Only Engineer A should remain
      expect(screen.getByLabelText('職稱')).toHaveValue('工程師 A');
    });
  });
});
