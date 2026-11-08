import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FOCUS_RING_CLASSES } from '@/lib/ui/focusRing';

import MentorFilterDropdown, {
  FilterOptions,
  SelectFilters,
} from './MentorFilterDropdown';

const mockFilterOptions: FilterOptions = {
  filter_skills: {
    name: '專業技能',
    options: [
      { label: '前端開發', value: 'frontend' },
      { label: '後端開發', value: 'backend' },
    ],
  },
  filter_topics: {
    name: '諮詢主題',
    options: [
      { label: '職涯規劃', value: 'career' },
      { label: '履歷健檢', value: 'resume' },
    ],
  },
};

const defaultProps = {
  filterOptions: mockFilterOptions,
  selectOptions: {},
  onChange: vi.fn(),
};

describe('MentorFilterDropdown', () => {
  it('renders the trigger button with the expected text and icons', () => {
    render(<MentorFilterDropdown {...defaultProps} />);

    // Check if the button with text "篩選" is rendered
    const triggerBtn = screen.getByRole('button', { name: /篩選/i });
    expect(triggerBtn).toBeInTheDocument();

    // Check that standard button classes (outline variant and focus ring classes) are present
    expect(triggerBtn).toHaveClass('border');
    expect(triggerBtn).toHaveClass('border-background-border');
    expect(triggerBtn).toHaveClass('bg-background-white');

    // Confirm that FOCUS_RING_CLASSES are integrated
    for (const cls of FOCUS_RING_CLASSES.split(' ')) {
      if (cls) {
        expect(triggerBtn).toHaveClass(cls);
      }
    }
  });

  it('opens popover on click and shows filter groups', () => {
    render(<MentorFilterDropdown {...defaultProps} />);

    const triggerBtn = screen.getByRole('button', { name: /篩選/i });
    fireEvent.click(triggerBtn);

    // Filter labels are inside the popover content
    expect(screen.getByText('專業技能')).toBeInTheDocument();
    expect(screen.getByText('諮詢主題')).toBeInTheDocument();
  });

  it('allows selecting option and calling onChange on apply', () => {
    const handleChange = vi.fn();
    render(<MentorFilterDropdown {...defaultProps} onChange={handleChange} />);

    // Open main popover
    const triggerBtn = screen.getByRole('button', { name: /篩選/i });
    fireEvent.click(triggerBtn);

    // Find the Select triggers (comboboxes) inside the popover
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBe(2);

    // Click the first select trigger (專業技能) to open its options
    fireEvent.click(selects[0]);

    // Click the option '前端開發'
    const option = screen.getByText('前端開發');
    fireEvent.click(option);

    // Click Apply button ("套用")
    const applyBtn = screen.getByRole('button', { name: '套用' });
    fireEvent.click(applyBtn);

    // Verify change is propagated with selected option
    expect(handleChange).toHaveBeenCalledWith({
      filter_skills: { name: '專業技能', value: 'frontend' },
    });
  });

  it('clears selection when "清除全部" is clicked', () => {
    const preselected: SelectFilters = {
      filter_skills: { name: '專業技能', value: 'frontend' },
    };
    const handleChange = vi.fn();
    render(
      <MentorFilterDropdown
        {...defaultProps}
        selectOptions={preselected}
        onChange={handleChange}
      />
    );

    // Open main popover
    const triggerBtn = screen.getByRole('button', { name: /篩選/i });
    fireEvent.click(triggerBtn);

    // Verify initial option is displayed on the select trigger button
    const selects = screen.getAllByRole('combobox');
    expect(selects[0]).toHaveTextContent('前端開發');

    // Click "清除全部" button
    const clearBtn = screen.getByRole('button', { name: '清除全部' });
    fireEvent.click(clearBtn);

    // Click "套用" to submit the empty pending filters
    const applyBtn = screen.getByRole('button', { name: '套用' });
    fireEvent.click(applyBtn);

    expect(handleChange).toHaveBeenCalledWith({});
  });
});
