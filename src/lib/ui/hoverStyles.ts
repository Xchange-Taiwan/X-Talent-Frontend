/**
 * Shared Tailwind CSS hover-state style tiers, mirroring the focus-ring system in
 * `@/lib/ui/focusRing`. Centralizing these class strings keeps hover feedback
 * consistent in strength across the entire app, instead of each component
 * picking its own ad-hoc shade or opacity (see X-Tracker #704, #705, #706 for
 * the inconsistencies this was fixing piecemeal before this module existed).
 *
 * NOTE TO FUTURE CONTRIBUTORS:
 * Always import and use these constants (via the `@/lib/ui/hoverStyles` module)
 * instead of hand-writing individual hover classes like `hover:bg-brand-600` or
 * `hover:bg-background-bottom` etc. Pick the tier that matches the component's
 * visual importance, not its literal HTML tag - e.g. a `<button>` styled as a
 * low-emphasis action still uses the ghost tier below, not the primary one.
 *
 * Ref: https://github.com/Xchange-Taiwan/X-Talent-Tracker/issues/707
 */

/**
 * Tier 1 - Primary CTA.
 * Solid, high-emphasis actions with a filled brand background (e.g. the
 * default Button variant, primary form submits). Darkens the fill by one
 * token step for a strong, unambiguous hover signal.
 */
export const HOVER_PRIMARY_CTA_CLASSES = 'hover:bg-brand-600';

/**
 * Tier 1 - Primary CTA, destructive counterpart.
 * Same emphasis level as HOVER_PRIMARY_CTA_CLASSES, for actions on a solid
 * status-error background (e.g. delete/cancel/reject confirmations).
 */
export const HOVER_DESTRUCTIVE_CTA_CLASSES = 'hover:bg-status-error-active';

/**
 * Tier 2 - Secondary / outline buttons.
 * Bordered or white-fill buttons that are visible but not the primary action
 * on the screen (e.g. the Button `outline` and `secondary` variants). Adds a
 * light neutral fill on hover.
 */
export const HOVER_SECONDARY_OUTLINE_CLASSES =
  'hover:bg-background-bottom hover:text-text-primary';

/**
 * Tier 3 - Ghost buttons.
 * No border or fill by default (e.g. icon-only buttons, toolbar actions, the
 * Button `ghost` variant). Uses the same light neutral fill as the secondary
 * tier - the lower emphasis comes from having no visible resting state, not
 * from a weaker hover.
 */
export const HOVER_GHOST_CLASSES = HOVER_SECONDARY_OUTLINE_CLASSES;

/**
 * Tier 3 - Plain text links / nav items.
 * For text-only interactive elements with no background surface at all
 * (header nav links, inline "link"-variant buttons, footer links). Shifts
 * the text color toward brand instead of adding a background. Uses
 * brand-700, not brand-600: on the white header/page background brand-600
 * only reaches ~3.1:1 contrast, below the WCAG AA minimum of 4.5:1 for
 * normal text; brand-700 reaches ~5.1:1.
 */
export const HOVER_TEXT_LINK_CLASSES = 'hover:text-brand-700';

/**
 * Tier 4 - Clickable cards.
 * Large tappable containers (mentor cards, list items) where the hover
 * feedback should read as "this whole surface is one control" rather than a
 * color change. Lifts the card with a stronger shadow.
 */
export const HOVER_CLICKABLE_CARD_CLASSES = 'hover:shadow-card-hover';

/**
 * Tier 4 - Clickable chips / pills.
 * Small, pill-shaped clickable surfaces (filter chips, tags) on a light
 * background, where a shadow lift doesn't read well at this size. Uses the
 * same light neutral grey fill as the secondary/ghost tier, matching the
 * hover treatment of other interactive components instead of a
 * brand-tinted fill.
 */
export const HOVER_CLICKABLE_CHIP_CLASSES = 'hover:bg-background-bottom';
