import { expect, test } from 'vitest';

import { cn } from '../utils';
import {
  HOVER_CLICKABLE_CARD_CLASSES,
  HOVER_CLICKABLE_CHIP_CLASSES,
  HOVER_DESTRUCTIVE_CTA_CLASSES,
  HOVER_GHOST_CLASSES,
  HOVER_PRIMARY_CTA_CLASSES,
  HOVER_SECONDARY_OUTLINE_CLASSES,
  HOVER_TEXT_LINK_CLASSES,
} from './hoverStyles';

test('hover style constants export correct Tailwind classes', () => {
  expect(HOVER_PRIMARY_CTA_CLASSES).toBe('hover:bg-brand-600');
  expect(HOVER_DESTRUCTIVE_CTA_CLASSES).toBe('hover:bg-status-error-active');

  expect(HOVER_SECONDARY_OUTLINE_CLASSES).toContain(
    'hover:bg-background-bottom'
  );
  expect(HOVER_SECONDARY_OUTLINE_CLASSES).toContain('hover:text-text-primary');

  expect(HOVER_GHOST_CLASSES).toContain('hover:bg-background-bottom');
  expect(HOVER_GHOST_CLASSES).toContain('hover:text-text-primary');

  expect(HOVER_TEXT_LINK_CLASSES).toContain('after:bg-brand-500');
  expect(HOVER_TEXT_LINK_CLASSES).toContain('after:scale-x-0');
  expect(HOVER_TEXT_LINK_CLASSES).toContain('after:transition-transform');
  expect(HOVER_TEXT_LINK_CLASSES).toContain('hover:after:scale-x-100');
  expect(HOVER_TEXT_LINK_CLASSES).toContain('relative');

  expect(HOVER_CLICKABLE_CARD_CLASSES).toBe('hover:shadow-card-hover');
  expect(HOVER_CLICKABLE_CHIP_CLASSES).toBe('hover:bg-background-bottom');
});

test('cn() correctly merges hover style classes with custom overrides', () => {
  const merged = cn(HOVER_PRIMARY_CTA_CLASSES, 'hover:bg-status-error-active');
  // Tailwind Merge should replace 'hover:bg-brand-600' with the override
  expect(merged).toContain('hover:bg-status-error-active');
  expect(merged).not.toContain('hover:bg-brand-600');
});
