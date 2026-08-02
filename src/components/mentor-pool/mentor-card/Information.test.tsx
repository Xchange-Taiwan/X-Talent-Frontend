import { act, render, screen } from '@testing-library/react';
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
          return {
            width: displayWidth,
            height: 40,
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
          } as DOMRect;
        }
        return {
          width: 40,
          height: 20,
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
        } as DOMRect;
      });
  };

  beforeAll(() => {
    // Safely mock global ResizeObserver without direct contamination or any casting
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
  });

  afterAll(() => {
    // Unstub globals after all tests complete
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    resizeCallback = null;
  });

  afterEach(() => {
    // Restore all mocked spies automatically (like getBoundingClientRect)
    vi.restoreAllMocks();
  });

  it('renders basic personal information correctly', () => {
    render(<Information {...defaultProps} />);

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText(/Software Engineer/)).toBeInTheDocument();
    expect(screen.getByText(/Tech Corp/)).toBeInTheDocument();
    expect(
      screen.getByText('Passionate developer with 5 years of experience.')
    ).toBeInTheDocument();
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

    // Each tag is rendered twice: once in the measure container and once in the display container
    expect(screen.getAllByText('React')).toHaveLength(2);
    expect(screen.getAllByText('TypeScript')).toHaveLength(2);
    expect(screen.getAllByText('Node.js')).toHaveLength(2);
  });

  it('handles empty haveTopicLabels gracefully', () => {
    render(<Information {...defaultProps} haveTopicLabels={[]} />);

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    // No tag elements should be rendered on screen for tags list
    const measureContainer = screen.getByTestId('measure-container');
    expect(measureContainer).toBeEmptyDOMElement();
  });

  it('renders correct number of tags and "+N" badge when container width is small on initial mount', () => {
    setupMockClientRect(100);

    render(<Information {...defaultProps} />);

    // Under 100px width:
    // computeOverflowFit will fit 'React' (40px + reserve 52px = 92px <= 100px)
    // 'TypeScript' will overflow.
    // So 'React' and '+2' should be rendered in the displayed tag list.
    expect(screen.getAllByText('React')).toHaveLength(2); // 1 in measure, 1 in display
    expect(screen.getByText('+2')).toBeInTheDocument();

    // 'TypeScript' and 'Node.js' should only be in the measure container, NOT in the display list.
    // So they should each only have 1 instance overall (the measure instance).
    expect(screen.getAllByText('TypeScript')).toHaveLength(1);
    expect(screen.getAllByText('Node.js')).toHaveLength(1);
  });

  it('dynamically updates visible tags and "+N" badge when ResizeObserver triggers a size change', () => {
    let mockedContainerWidth = 500; // start with a wide width fitting all tags
    setupMockClientRect(mockedContainerWidth);

    render(<Information {...defaultProps} />);

    // Initially wide: fits all tags. So 2 copies of each tag are rendered, and NO "+N" extra badge.
    expect(screen.getAllByText('React')).toHaveLength(2);
    expect(screen.getAllByText('TypeScript')).toHaveLength(2);
    expect(screen.getAllByText('Node.js')).toHaveLength(2);
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();

    // Now, simulate a container resize down to 100px
    mockedContainerWidth = 100;
    expect(resizeCallback).not.toBeNull();

    act(() => {
      // Cast the mocked entry and observer using type-safe unknown casting
      resizeCallback!(
        [{ contentRect: { width: 100 } } as unknown as ResizeObserverEntry],
        {} as unknown as ResizeObserver
      );
    });

    // After resize, it should adapt dynamically and show '+2' extra tags
    expect(screen.getAllByText('React')).toHaveLength(2);
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.getAllByText('TypeScript')).toHaveLength(1);
    expect(screen.getAllByText('Node.js')).toHaveLength(1);
  });
});
