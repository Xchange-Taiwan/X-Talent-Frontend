import { act, render, screen } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import React from 'react';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { Information } from './Information';

// Global variable to hold the registered ResizeObserver callback
let resizeCallback: ResizeObserverCallback | null = null;

// Mock ResizeObserver for JSDOM
class MockResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback;
  }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

describe('Information Component', () => {
  const defaultProps = {
    name: 'Jane Doe',
    job_title: 'Software Engineer',
    company: 'Tech Corp',
    about: 'Passionate developer with 5 years of experience.',
    haveTopicLabels: ['React', 'TypeScript', 'Node.js'],
  };

  // Helper to mock client rect dimensions cleanly and DRY-ly
  const setupMockClientRect = (displayWidth: number) => {
    return vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        if (this.getAttribute('data-testid') === 'display-container') {
          return fromPartial<DOMRect>({
            width: displayWidth,
            height: 40,
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
          });
        }
        return fromPartial<DOMRect>({
          width: 40,
          height: 20,
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
        });
      });
  };

  beforeAll(() => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    resizeCallback = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders basic personal information correctly', () => {
    render(<Information {...defaultProps} />);

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText(/Software Engineer/)).toBeInTheDocument();
    expect(screen.getByText(/Tech Corp/)).toBeInTheDocument();
    const aboutEl = screen.getByText(
      'Passionate developer with 5 years of experience.'
    );
    expect(aboutEl).toBeInTheDocument();
    expect(aboutEl).toHaveClass('min-h-[40px]');
    expect(screen.getByTestId('display-container').parentElement).toHaveClass(
      'mt-auto'
    );
  });

  it('renders "at" company separator when both title and company are provided', () => {
    render(<Information {...defaultProps} />);
    expect(screen.getByText('at')).toBeInTheDocument();
  });

  it('does not render "at" separator when company is missing', () => {
    render(<Information {...defaultProps} company="" />);
    expect(screen.queryByText('at')).not.toBeInTheDocument();
  });

  it('renders all tag labels on initial mount (both measurement and display copies)', () => {
    render(<Information {...defaultProps} />);

    expect(screen.getAllByText('React')).toHaveLength(2);
    expect(screen.getAllByText('TypeScript')).toHaveLength(2);
    expect(screen.getAllByText('Node.js')).toHaveLength(2);
  });

  it('handles empty haveTopicLabels gracefully', () => {
    render(<Information {...defaultProps} haveTopicLabels={[]} />);

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    const measureContainer = screen.getByTestId('measure-container');
    expect(measureContainer).toBeEmptyDOMElement();
  });

  it('renders correct number of tags and "+N" badge when container width is small on initial mount', () => {
    setupMockClientRect(100);

    render(<Information {...defaultProps} />);

    expect(screen.getAllByText('React')).toHaveLength(2);
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.getAllByText('TypeScript')).toHaveLength(1);
    expect(screen.getAllByText('Node.js')).toHaveLength(1);
  });

  it('dynamically updates visible tags and "+N" badge when ResizeObserver triggers a size change', () => {
    let mockedContainerWidth = 500;
    setupMockClientRect(mockedContainerWidth);

    render(<Information {...defaultProps} />);

    expect(screen.getAllByText('React')).toHaveLength(2);
    expect(screen.getAllByText('TypeScript')).toHaveLength(2);
    expect(screen.getAllByText('Node.js')).toHaveLength(2);
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();

    mockedContainerWidth = 100;
    expect(resizeCallback).not.toBeNull();

    act(() => {
      resizeCallback!(
        [
          fromPartial<ResizeObserverEntry>({
            contentRect: fromPartial({ width: 100 }),
          }),
        ],
        fromPartial<ResizeObserver>({})
      );
    });

    expect(screen.getAllByText('React')).toHaveLength(2);
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.getAllByText('TypeScript')).toHaveLength(1);
    expect(screen.getAllByText('Node.js')).toHaveLength(1);
  });

  it('renders projected ratingLabel on name row right without star or review count, and completedMeetingsLabel below job title (#737, #896)', () => {
    render(
      <Information
        {...defaultProps}
        ratingLabel="9.8 / 10"
        completedMeetingsLabel="已完成 12 場 1-on-1"
      />
    );

    const ratingEl = screen.getByText('9.8 / 10');
    expect(ratingEl).toBeInTheDocument();
    expect(ratingEl).toHaveAttribute('aria-label', '平均評分 9.8 / 10');
    expect(ratingEl).toHaveClass('shrink-0', 'whitespace-nowrap');

    const nameHeading = screen.getByRole('heading', { name: 'Jane Doe' });
    expect(nameHeading).toHaveClass('min-w-0', 'truncate');
    expect(nameHeading.parentElement).toContainElement(ratingEl);

    expect(screen.getByText('已完成 12 場 1-on-1')).toBeInTheDocument();
    expect(screen.queryByText(/則/)).not.toBeInTheDocument();
    expect(screen.queryByText(/[★⭐]/)).not.toBeInTheDocument();
  });

  it('hides rating block and completed sessions when projected labels are null (#737, #896)', () => {
    const { rerender } = render(
      <Information
        {...defaultProps}
        ratingLabel={null}
        completedMeetingsLabel={null}
      />
    );

    expect(screen.queryByText(/\/ 10/)).not.toBeInTheDocument();
    expect(screen.queryByText(/已完成/)).not.toBeInTheDocument();

    rerender(
      <Information
        {...defaultProps}
        ratingLabel={null}
        completedMeetingsLabel="已完成 5 場 1-on-1"
      />
    );
    expect(screen.queryByText(/\/ 10/)).not.toBeInTheDocument();
    expect(screen.getByText('已完成 5 場 1-on-1')).toBeInTheDocument();
  });
});
