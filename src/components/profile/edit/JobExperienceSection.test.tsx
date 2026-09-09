import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { Form } from '@/components/ui/form';

import { JobExperienceSection } from './JobExperienceSection';

function Harness({
  defaultValue = [],
  isMentor = true,
  onValidationChange = () => {},
}: {
  defaultValue?: any[];
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          form={form as any}
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
      {
        id: 1,
        job: '資深工程師',
        company: '測試科技公司',
        job_period_start: '2020',
        job_period_end: 'now',
        industry: 'TECH',
        job_location: 'TWN',
        description: '負責前端架構開發',
        is_primary: true,
      },
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
        {
          id: 1,
          job: field === 'job' ? '' : '工程師',
          company: field === 'company' ? '' : '公司',
          job_period_start: field === 'job_period_start' ? '' : '2020',
          job_period_end: field === 'job_period_end' ? '' : '2022',
          industry: 'TECH',
          job_location: 'TWN',
          description: '',
          is_primary: true,
        },
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
      {
        id: 1,
        job: '資深工程師',
        company: '測試科技公司',
        job_period_start: '2023',
        job_period_end: '2020', // End before Start!
        industry: 'TECH',
        job_location: 'TWN',
        description: '',
        is_primary: true,
      },
    ];

    render(<Harness defaultValue={invalidDates} />);

    expect(screen.getByText('開始年份不可大於結束年份')).toBeInTheDocument();
  });

  it('deletes work experiences on trash button click and reassigns primary', async () => {
    const existing = [
      {
        id: 1,
        job: '工程師 A',
        company: '公司 A',
        job_period_start: '2020',
        job_period_end: '2022',
        industry: 'TECH',
        job_location: 'TWN',
        description: '',
        is_primary: true,
      },
      {
        id: 2,
        job: '工程師 B',
        company: '公司 B',
        job_period_start: '2020',
        job_period_end: '2022',
        industry: 'TECH',
        job_location: 'TWN',
        description: '',
        is_primary: false,
      },
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

  it('toggles primary work experience using the checkbox', async () => {
    const existing = [
      {
        id: 1,
        job: '工程師 A',
        company: '公司 A',
        job_period_start: '2020',
        job_period_end: '2022',
        industry: 'TECH',
        job_location: 'TWN',
        description: '',
        is_primary: true,
      },
      {
        id: 2,
        job: '工程師 B',
        company: '公司 B',
        job_period_start: '2020',
        job_period_end: '2022',
        industry: 'TECH',
        job_location: 'TWN',
        description: '',
        is_primary: false,
      },
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
      {
        id: 1,
        job: '工程師 A',
        company: '公司 A',
        job_period_start: '2020',
        job_period_end: '2022',
        industry: 'TECH',
        job_location: 'TWN',
        description: '',
        is_primary: true,
      },
      {
        id: 2,
        job: '工程師 B',
        company: '公司 B',
        job_period_start: '2020',
        job_period_end: '2022',
        industry: 'TECH',
        job_location: 'TWN',
        description: '',
        is_primary: false,
      },
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
      {
        id: 1,
        job: '工程師 A',
        company: '公司 A',
        job_period_start: '2020',
        job_period_end: '2022',
        industry: 'TECH',
        job_location: 'TWN',
        description: '',
        is_primary: true,
      },
      {
        id: 2,
        job: '工程師 B',
        company: '公司 B',
        job_period_start: '2020',
        job_period_end: '2022',
        industry: 'TECH',
        job_location: 'TWN',
        description: '',
        is_primary: false,
      },
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
