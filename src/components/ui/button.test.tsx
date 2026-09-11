import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { Button } from './button';

test('default variant keeps its brand fill and darkens on hover', () => {
  render(<Button variant="default">Default</Button>);
  const button = screen.getByRole('button', { name: 'Default' });

  expect(button).toHaveClass('bg-brand-500');
  expect(button).toHaveClass('text-text-primary');
  expect(button).toHaveClass('hover:bg-brand-600');
});

test('destructive variant keeps its error fill and darkens on hover', () => {
  render(<Button variant="destructive">Destructive</Button>);
  const button = screen.getByRole('button', { name: 'Destructive' });

  expect(button).toHaveClass('bg-status-error-default');
  expect(button).toHaveClass('text-text-white');
  expect(button).toHaveClass('hover:bg-status-error-active');
});

test('outline variant keeps its border/background and gains a neutral hover fill', () => {
  render(<Button variant="outline">Outline</Button>);
  const button = screen.getByRole('button', { name: 'Outline' });

  expect(button).toHaveClass('border');
  expect(button).toHaveClass('bg-background-white');
  expect(button).toHaveClass('hover:bg-background-bottom');
  expect(button).toHaveClass('hover:text-text-primary');
});

test('secondary variant keeps its muted fill and hover opacity', () => {
  render(<Button variant="secondary">Secondary</Button>);
  const button = screen.getByRole('button', { name: 'Secondary' });

  expect(button).toHaveClass('bg-background-bottom');
  expect(button).toHaveClass('hover:bg-background-bottom/80');
});

test('ghost variant has no resting fill but gains the same neutral hover fill as outline', () => {
  render(<Button variant="ghost">Ghost</Button>);
  const button = screen.getByRole('button', { name: 'Ghost' });

  expect(button).toHaveClass('hover:bg-background-bottom');
  expect(button).toHaveClass('hover:text-text-primary');
  expect(button).not.toHaveClass('bg-background-white');
});

test('link variant stays text-only and underlines on hover', () => {
  render(<Button variant="link">Link</Button>);
  const button = screen.getByRole('button', { name: 'Link' });

  expect(button).toHaveClass('text-brand-500');
  expect(button).toHaveClass('hover:underline');
});
