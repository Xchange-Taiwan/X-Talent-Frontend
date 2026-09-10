/**
 * Shared Tailwind CSS focus-ring style definitions.
 * Centralizing these class strings ensures visual consistency across the entire app
 * and makes it easy to update focus styling in one place.
 */

/**
 * Standard focus ring variant.
 * Standard case: ring-2, ring-ring color, ring-offset-2, outline-none.
 * Best for most standalone buttons, links, checkbox, select, and separate elements.
 */
export const FOCUS_RING_CLASSES =
  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none';

/**
 * Focus ring variant without offset.
 * Standard ring-2 and outline-none, but ring-offset-0.
 * Best for inputs, textareas, and other text fields where offset is undesirable or clips.
 */
export const FOCUS_RING_NO_OFFSET_CLASSES =
  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 focus-visible:outline-none';

/**
 * Group focus-ring variant.
 * Standard group-focus-visible style.
 * Use on elements nested inside a parent container with the 'group' class.
 */
export const GROUP_FOCUS_RING_CLASSES =
  'group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:outline-none';

/**
 * Focus-within variant, scoped to focus-visible.
 * Use on a parent element when a child input gets focus (e.g. search bars, custom inputs).
 * Uses `has-[:focus-visible]` rather than `focus-within` so mouse clicks on the child
 * don't trigger the parent's ring - only keyboard focus does.
 */
export const FOCUS_WITHIN_RING_CLASSES =
  'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:outline-none';

/**
 * Focus-within variant without offset, scoped to focus-visible.
 * Use on a parent container when a child input gets focus and offset-2 would float or clip.
 * Best for textareas, inputs, or compact elements styled as a single composite field.
 * Uses `has-[:focus-visible]` rather than `focus-within` so mouse clicks on the child
 * don't trigger the parent's ring - only keyboard focus does.
 */
export const FOCUS_WITHIN_RING_NO_OFFSET_CLASSES =
  'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-0 has-[:focus-visible]:outline-none';

/**
 * Focus container ring variant using has-[input:focus-visible].
 * Use on a parent container when a child input is focused via keyboard (focus-visible).
 * This avoids showing focus rings on mouse clicks and prevents double-ring visual clutter.
 */
export const FOCUS_CONTAINER_RING_CLASSES =
  'has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring has-[input:focus-visible]:ring-offset-2 has-[input:focus-visible]:outline-none';
