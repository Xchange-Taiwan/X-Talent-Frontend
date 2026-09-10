import { expect, test } from 'vitest';

import {
  FOCUS_RING_CLASSES,
  FOCUS_RING_NO_OFFSET_CLASSES,
  FOCUS_WITHIN_RING_CLASSES,
  FOCUS_WITHIN_RING_NO_OFFSET_CLASSES,
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

  expect(FOCUS_WITHIN_RING_CLASSES).toContain('has-[:focus-visible]:ring-2');
  expect(FOCUS_WITHIN_RING_CLASSES).toContain('has-[:focus-visible]:ring-ring');
  expect(FOCUS_WITHIN_RING_CLASSES).toContain(
    'has-[:focus-visible]:ring-offset-2'
  );
  expect(FOCUS_WITHIN_RING_CLASSES).not.toContain('focus-within:');

  expect(FOCUS_WITHIN_RING_NO_OFFSET_CLASSES).toContain(
    'has-[:focus-visible]:ring-2'
  );
  expect(FOCUS_WITHIN_RING_NO_OFFSET_CLASSES).toContain(
    'has-[:focus-visible]:ring-ring'
  );
  expect(FOCUS_WITHIN_RING_NO_OFFSET_CLASSES).toContain(
    'has-[:focus-visible]:ring-offset-0'
  );
  expect(FOCUS_WITHIN_RING_NO_OFFSET_CLASSES).not.toContain('focus-within:');
});
