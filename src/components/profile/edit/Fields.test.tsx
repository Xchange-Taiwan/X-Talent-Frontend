import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Form } from '@/components/ui/form';

import { ComboboxField } from './Fields';

interface FormValues {
  location: string;
}

const manyOptions = Array.from({ length: 249 }, (_, i) => ({
  value: `country-${i}`,
  label: `Country ${i}`,
}));

function Harness({
  defaultValue = '',
  disabled = false,
}: {
  defaultValue?: string;
  disabled?: boolean;
}) {
  const form = useForm<FormValues>({
    defaultValues: { location: defaultValue },
    disabled,
  });
  return (
    <Form {...form}>
      <form>
        <ComboboxField
          form={form}
          name="location"
          placeholder="請選擇地區"
          searchPlaceholder="搜尋地區"
          options={manyOptions}
        />
        <span data-testid="touched">
          {String(Boolean(form.formState.touchedFields.location))}
        </span>
      </form>
    </Form>
  );
}

describe('ComboboxField', () => {
  it('does not mount any option on initial render, even with hundreds of options', () => {
    render(<Harness />);

    expect(screen.queryByText('Country 0')).not.toBeInTheDocument();
    expect(screen.queryByText('Country 248')).not.toBeInTheDocument();
    expect(document.querySelectorAll('[cmdk-item]')).toHaveLength(0);
  });

  it('shows the placeholder when nothing is selected', () => {
    render(<Harness />);

    expect(screen.getByText('請選擇地區')).toBeInTheDocument();
  });

  it('shows the selected option label without opening the popover', () => {
    render(<Harness defaultValue="country-7" />);

    expect(screen.getByText('Country 7')).toBeInTheDocument();
  });

  it('mounts the option list once opened, and lets the user pick a value', async () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(screen.getByText('Country 0')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Country 3'));

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveTextContent('Country 3');
    });
  });

  it('marks the field as touched once the popover closes, for onTouched-mode validation', async () => {
    render(<Harness />);

    expect(screen.getByTestId('touched')).toHaveTextContent('false');

    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => {
      expect(screen.getByText('Country 0')).toBeInTheDocument();
    });

    fireEvent.keyDown(screen.getByPlaceholderText('搜尋地區'), {
      key: 'Escape',
      code: 'Escape',
    });

    await waitFor(() => {
      expect(screen.getByTestId('touched')).toHaveTextContent('true');
    });
  });

  it('marks the field as touched after picking an option, not just on Escape', async () => {
    render(<Harness />);

    expect(screen.getByTestId('touched')).toHaveTextContent('false');

    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => {
      expect(screen.getByText('Country 0')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Country 3'));

    await waitFor(() => {
      expect(screen.getByTestId('touched')).toHaveTextContent('true');
    });
  });

  it('disables the trigger when the field is disabled', () => {
    render(<Harness disabled />);

    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});

// 上面那些案例走的都是桌機 popover —— src/test/setup.ts 的 matchMedia 一律回報
// 不成立。手機版改由底部面板轉譯，是這張票要修的主要路徑，表單綁定得分開驗證。
describe('ComboboxField on mobile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function useMobileViewport(): void {
    vi.stubGlobal(
      'matchMedia',
      (query: string) =>
        ({
          matches: true,
          media: query,
          onchange: null,
          addEventListener() {},
          removeEventListener() {},
          addListener() {},
          removeListener() {},
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList
    );
  }

  it('writes the picked value back to the form from inside the sheet', async () => {
    useMobileViewport();
    render(<Harness />);

    fireEvent.click(screen.getByRole('combobox'));

    // 面板是 dialog，不是 popover
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    expect(
      screen.getByRole('heading', { name: '請選擇地區' })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText('Country 3'));

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveTextContent('Country 3');
    });
  });

  it('marks the field as touched when the sheet closes', async () => {
    useMobileViewport();
    render(<Harness />);

    expect(screen.getByTestId('touched')).toHaveTextContent('false');

    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => {
      expect(screen.getByText('Country 0')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '關閉' }));

    await waitFor(() => {
      expect(screen.getByTestId('touched')).toHaveTextContent('true');
    });
  });
});
