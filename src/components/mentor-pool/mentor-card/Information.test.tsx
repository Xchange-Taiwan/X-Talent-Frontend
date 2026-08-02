import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Information } from './Information';

// Mock ResizeObserver for JSDOM
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = MockResizeObserver;

describe('Information Component', () => {
  const defaultProps = {
    name: 'Jane Doe',
    job_title: 'Software Engineer',
    company: 'Tech Corp',
    about: 'Passionate developer with 5 years of experience.',
    haveTopicLabels: ['React', 'TypeScript', 'Node.js'],
  };

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
    const measureContainer = screen.getByText('Jane Doe').closest('div')
      ?.nextSibling?.nextSibling?.firstChild;
    expect(measureContainer).toBeEmptyDOMElement();
  });

  it('renders correct number of tags and "+N" badge when container width is small', () => {
    const originalGetBoundingClientRect =
      HTMLElement.prototype.getBoundingClientRect;

    try {
      // Mock widths of children and container
      HTMLElement.prototype.getBoundingClientRect = function () {
        // If this is the display container (which doesn't have pointer-events-none)
        if (
          this.className.includes('flex flex-wrap gap-2') &&
          !this.className.includes('pointer-events-none')
        ) {
          return {
            width: 100,
            height: 40,
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
          } as DOMRect;
        }
        // If these are tags
        return {
          width: 40,
          height: 20,
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
        } as DOMRect;
      };

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
    } finally {
      HTMLElement.prototype.getBoundingClientRect =
        originalGetBoundingClientRect;
    }
  });
});
