import { expect, test } from 'vitest';

import { cn } from '../utils';
import {
  FOCUS_CONTAINER_RING_CLASSES,
  FOCUS_RING_CLASSES,
  FOCUS_RING_NO_OFFSET_CLASSES,
  FOCUS_WITHIN_RING_CLASSES,
  GROUP_FOCUS_RING_CLASSES,
} from './focusRing';

test('focus ring constants export correct Tailwind classes', () => {
  expect(FOCUS_RING_CLASSES).toContain('focus-visible:ring-2');
  expect(FOCUS_RING_CLASSES).toContain('focus-visible:ring-ring');
  expect(FOCUS_RING_CLASSES).toContain('focus-visible:ring-offset-2');
  expect(FOCUS_RING_CLASSES).toContain('focus-visible:outline-none');

  expect(FOCUS_RING_NO_OFFSET_CLASSES).toContain('focus-visible:ring-2');
  expect(FOCUS_RING_NO_OFFSET_CLASSES).toContain('focus-visible:ring-offset-0');

  expect(GROUP_FOCUS_RING_CLASSES).toContain('group-focus-visible:ring-2');
  expect(GROUP_FOCUS_RING_CLASSES).toContain('group-focus-visible:ring-ring');

  expect(FOCUS_WITHIN_RING_CLASSES).toContain('focus-within:ring-2');
  expect(FOCUS_WITHIN_RING_CLASSES).toContain('focus-within:ring-ring');

  expect(FOCUS_CONTAINER_RING_CLASSES).toContain(
    'has-[input:focus-visible]:ring-2'
  );
  expect(FOCUS_CONTAINER_RING_CLASSES).toContain(
    'has-[input:focus-visible]:ring-ring'
  );
  expect(FOCUS_CONTAINER_RING_CLASSES).toContain(
    'has-[input:focus-visible]:ring-offset-2'
  );
});

test('cn() correctly merges focus ring classes with custom overrides', () => {
  const merged = cn(FOCUS_RING_CLASSES, 'focus-visible:ring-destructive');
  // Tailwind Merge should replace 'focus-visible:ring-ring' with 'focus-visible:ring-destructive'
  expect(merged).toContain('focus-visible:ring-destructive');
  expect(merged).not.toContain('focus-visible:ring-ring');
  expect(merged).toContain('focus-visible:ring-2');
});
