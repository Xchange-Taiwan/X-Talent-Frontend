/**
 * Shared Tailwind CSS focus-ring style definitions.
 * Centralizing these class strings ensures visual consistency across the entire app
 * and makes it easy to update focus styling in one place.
 *
 * NOTE TO FUTURE CONTRIBUTORS:
 * Always import and use these constants (via the `@/lib/ui/focusRing` module)
 * instead of hand-writing individual focus classes like `focus-visible:ring-2 focus-visible:ring-ring` etc.
 * This guarantees a unified keyboard-accessibility experience across X-Talent.
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
 * Focus-within variant.
 * Use on a parent element when a child input gets focus (e.g. search bars, custom inputs).
 */
export const FOCUS_WITHIN_RING_CLASSES =
  'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:outline-none';

/**
 * Focus-within variant without offset.
 * Use on a parent container when a child input gets focus and offset-2 would float or clip.
 * Best for textareas, inputs, or compact elements styled as a single composite field.
 */
export const FOCUS_WITHIN_RING_NO_OFFSET_CLASSES =
  'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0 focus-within:outline-none';
