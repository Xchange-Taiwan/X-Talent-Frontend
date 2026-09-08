# Context: BookingAvailabilityModel

This document establishes and defines the canonical domain terms for the modular booking availability computation.

## Canonical Terms

**`computeBookingAvailability`** (the function, module's main entry point) and **`BookingAvailabilityModel`** (its return type)

## Context & Purpose

In the mentor scheduling domain, deriving the final calendar view is a multi-layered pure computation. It involves:

1. **Occurrence Expansion**: Expanding weekly recurrence rules (RRules) into concrete timestamps.
2. **Exdate Exclusion**: Excluding specific deleted/modified dates (exdates) from the expanded recurrence list.
3. **Past-Occurrence Filtering**: Filtering out any slots that occurred in the past relative to a given point in time.
4. **Precedence Resolution**: Layering `BOOKED` or `PENDING` states on top of free `ALLOW` slots.
5. **Deduplication**: Ensuring overlapping slots are consolidated safely into distinct selectable choices.

To ensure this pure logic can be developed, optimized, and thoroughly unit-tested without relying on the React hook rendering lifecycle, we extracted this computation into a dedicated non-React module built around **`computeBookingAvailability`**.

## Module Details

- **Location**: `src/lib/profile/bookingAvailability/`
- **Main Entry Point**: `computeBookingAvailability`
- **Contract Signature**:
  - **Inputs**: Raw draft rows (`RawMentorTimeslot[]`), current reservations (`Reservation[]`), a reference current timestamp (`nowSec`), and an optional mentor viewing intent (`includeBookedDates`).
  - **Outputs**: A `BookingAvailabilityModel` payload including `allowedDates` (selectable dates), `bookingStatusByDate` (performance-optimized per-date status dots lookup map), and a generator function `generateBookingSlots` for any given date.
- **Naming note**: this module predates the `ReservationReadModel` naming convention below, so its exports don't carry a `ReadModel` suffix - but the shape is the same: `computeBookingAvailability` is a pure function that derives a read-only, computed view (`BookingAvailabilityModel`) over draft rows and reservations, with no ties to the React rendering lifecycle.

By formalizing **`computeBookingAvailability`** and its **`BookingAvailabilityModel`** output type, downstream features (such as dialogs, detail cards, and calendar status widgets) can reuse this precise logic with a unified, predictable vocabulary.

## Domain Vocabulary & Types

The booking availability module serves as the single source of truth for all mentor-scheduling domain vocabulary. By homing these types here rather than in a React hook, we prevent layer-violation issues (e.g. non-React utilities or Storybook stories importing React state context hooks).

Key types exported from this module (`src/lib/profile/bookingAvailability/`):

- **`BookingSlot`**: Represents a single bookable timeslot occurrence (start, end, schedule ID, booking/status, mentee, reservation info).
- **`BookingStatus`**: An enum defining the booking status (`'PENDING' | 'BOOKED'`).
- **`ParsedMentorTimeslot`**: An expanded, formatted representation of a raw timeslot occurrence. Used directly in the schedule editor (`MentorScheduleEditor.draftForSelectedDate`), and also exposed unfiltered at the top level of `useMentorSchedule`'s return value as `parsedDraft` - so a reader-side consumer of the hook can reach it too, not only the editor.
- **`SlotsSnapshot`**: A snapshot structure grouping the selected date's booking slots with their loading flags (`monthLoaded`, `reservationsLoaded`).
- **`SlotDurationMinutes`**: Valid slot durations (`30 | 45 | 60`).
- **`BookingCalendarReader`**: A narrow read-only interface used by mentees and visitors to view a mentor's booking schedule.
- **`MentorScheduleEditor`**: A narrow stateful interface used by the mentor to manage and sync their available slots.

## Elapsed Time Behavior (Page Open)

To ensure consistency and prevent race conditions, **`computeBookingAvailability`** explicitly treats the reference current timestamp (`nowSec`) as a **frozen instant contract**.

- **No Clock Tick (Frozen Instant)**: Both `allowedDates` (selectable dates on the calendar) and `generateBookingSlots` (the slot generator) are derived against the exact same timestamp frozen when the read model was computed. As time passes with the page open, the view remains stable and self-consistent.
- **Why this design**:
  1. **Aesthetic Consistency**: A slot that expires after the page has loaded will not disappear from the slot list while its calendar date remains selectable. Both answers are always derived from the same instant.
  2. **Performance (Stable Calculations)**: This design avoids running heavy recurrence rule expansions on every clock tick (preventing performance degradation on rendering-heavy calendar grids).
  3. **Predictable Interface**: User interactions are completely deterministic.

---

# Context: ReservationReadModel

This document establishes and defines the canonical domain term for the reservation dashboard's async read model.

## Canonical Term

**`ReservationReadModel`** (or Reservation Read Model)

## Context & Purpose

The reservation dashboard (`upcoming` / `pending` / `history` tabs, for both mentor and mentee roles) needs the same reservation pages cached, invalidated, and kept in sync across three tabs and two roles, backed by a paginated `GET /v1/users/:id/reservations` endpoint. Before this module existed, the dashboard hook reached directly into a shared `AsyncReadManager` instance and a raw `KeyedCache`, building its own string cache keys (`${userId}_${state}`) and free to call the manager's cache-mechanics methods directly. That left no single place owning the key shape or the cache policy, and nothing stopped a future caller from reaching around it.

`ReservationReadModel` is that single place: one module, keyed by `{ userId, state }`, that owns the read path (cache-first, de-duplicated, subscribable) built on top of `AsyncReadManager`'s write vocabulary (`set` / `update` / `invalidate`, established in X-Tracker #645), and hides the underlying `AsyncReadManager` / `KeyedCache` instances as a private implementation detail. Nothing outside this module imports them.

## Module Details

- **Location**: `src/lib/reservation/reservationReadModel.ts`
- **Main Export**: `reservationReadModel`
- **Key Shape**: `ReservationReadKey = { userId: string; state: ReservationState; endOfMonthUnix?: number }` — one cache entry per user _and_ reservation state (`MENTEE_UPCOMING`, `MENTEE_PENDING`, `MENTEE_HISTORY`, `MENTOR_UPCOMING`, `MENTOR_PENDING`, `MENTOR_HISTORY`), with an optional month-boundary scope for a caller that needs a bounded TTL window per calendar month instead of the default permanent slot (see Staleness Contract below). Callers never see or construct the underlying string cache key.
- **Contract Signature**:
  - `get(key)` — synchronous cached-snapshot read (`FetchReservationsResult | undefined`), used where a caller needs the current page/cursor without subscribing (e.g. reading `next_dtend` before a "load more" fetch, or a cache-first check before fetching a calendar month).
  - `set(key, value, ttlMs?)` — direct write. `ttlMs` is only for an `endOfMonthUnix`-scoped key; the default unscoped slot ignores it and stays permanent/invalidate-driven.
  - `subscribe(key, fetcher, onUpdate, options?)` — the live read path: serves a cache hit synchronously, de-dupes concurrent fetches for the same key, and notifies `onUpdate` with `{ data, isLoading, error }` as the fetch resolves. `options` only ever accepts `force` and `initialData` — there is no `cache` handle for a caller to pass in.
  - `update(key, updater)` / `invalidate(key)` — the write vocabulary inherited from `AsyncReadManager` (X-Tracker #645), used for optimistic removal after a mutation, appending a "load more" page, and refetch-on-409-conflict.
  - `clear()` — full reset of every cached entry, listener, and in-flight fetch. Used in tests, and in production for an account switch or a reservation mutation whose effects can be embedded in slots the caller doesn't otherwise know how to address individually (e.g. every other cached calendar month) — see the mentor-schedule calendar consumer below.

By construction, callers can only interact with reservation caching through these methods — there is no way to reach the shared cache or read/write a raw string key.

## Staleness Contract

- **Default: no TTL — invalidate-driven.** A cached page at the default unscoped `{ userId, state }` slot never expires on its own; it is correct until a write (`update` / `invalidate`) says otherwise. Reservation state only ever changes through this app's own mutations (accept / reject / cancel / create) or a version-conflict refetch, all of which already call back into this model, so there is no unbounded-staleness window from an external actor changing data out from under an open tab.
- **Exception: `endOfMonthUnix`-scoped slots carry a TTL.** The mentor-schedule calendar's slots can go stale from the _other_ party's action (a mentee books a new slot, or a pending request gets accepted/rejected from another tab) with no local write to catch it, so those slots are written with `MENTOR_SCHEDULE_RESERVATIONS_TTL_MS` (30s) and expire on their own. This is a caller-selected policy, not a manager-wide default — passing no `endOfMonthUnix` and no `ttlMs` still gets the permanent, invalidate-driven behavior above.
- **Read-your-writes.** `update()` and `invalidate()` always cancel any in-flight fetch for that key before applying (inherited `AsyncReadManager` guarantee, X-Tracker #645 and its follow-up fixes), so a slow in-flight response can never clobber a more recent local write.
- **Per-(user, state[, month]) isolation.** `{ userId, state }` (plus `endOfMonthUnix` when a caller opts in) is the whole key — switching tabs, switching role, switching calendar month, or a different signed-in user each land on an independent cache entry; there is no cross-key invalidation. `clear()` is the escape hatch when a caller needs to drop everything at once instead.

## Consumers

- `useReservationData` (`src/hooks/user/reservation/useReservationData.ts`) subscribes once per tab (`upcoming` / `pending` / lazily-loaded `history`) and drives every mutation-triggered cache write through this model, using the default unscoped, permanent slot.
- `useMentorSchedule` (`src/hooks/useMentorSchedule.ts`, X-Tracker #650) reads the mentor-schedule calendar's `MENTOR_UPCOMING` / `MENTOR_PENDING` reservations through this same model, scoped per viewed month via `endOfMonthUnix` and bounded by `MENTOR_SCHEDULE_RESERVATIONS_TTL_MS`. This replaced a separate, differently-shaped hand-rolled cache (`src/services/mentor-schedule/reservationsCache.ts`, now deleted) that duplicated this model's cache-first/TTL/full-wipe mechanics on its own. Since X-Tracker #669 it binds through `useAsyncRead` (one subscription per state) rather than a mount effect writing into local state, so the hook holds no fetch-generation counter of its own.

---

# Context: MentorScheduleReadModel

This document establishes and defines the canonical domain term for the mentor schedule's per-month async read model.

## Canonical Term

**`MentorScheduleReadModel`** (or Mentor Schedule Read Model)

## Context & Purpose

The mentor-schedule calendar reads one month of a mentor's timeslots at a time, and the user moves between months (and occasionally accounts) faster than the network answers. Before this module existed (X-Tracker #669), `useMentorSchedule` owned that problem itself: a `scheduleCache` module that was little more than a keyed cache plus a template-string key, wrapped in a hand-rolled set of refs in the hook - `isStale()`, `isMountedRef`, a reservation fetch-generation counter - that every async path had to remember to consult. Whether a late response was allowed to win was a rule spread across seventeen call sites instead of a property of the module that owned the data.

`MentorScheduleReadModel` is that single place: one module, keyed by `{ userId, year, month }`, that owns the read path (cache-first, de-duplicated, cancellable, subscribable) on top of `AsyncReadManager`, and hides the underlying `AsyncReadManager` / `KeyedCache` instances as a private implementation detail. Because every read and write is addressed by that key, a response can only ever land on the month and account it was asked for - staleness stops being something a caller has to check for.

## Module Details

- **Location**: `src/lib/mentor-schedule/scheduleReadModel.ts`
- **Main Export**: `scheduleReadModel`
- **Key Shape**: `ScheduleReadKey = { userId: string; year: number; month: number }` (month is 1-12) - one cache entry per mentor _and_ calendar month. Callers never see or construct the underlying string cache key.
- **Contract Signature**:
  - `get(key)` — synchronous cached-snapshot read (`RawMentorTimeslot[] | undefined`); never triggers a fetch. Used where a caller needs an already-loaded month without subscribing (a cross-month draft edit needs the target month's rows, and is blocked when they aren't there).
  - `set(key, value)` — direct write for a save/discard that already fetched the month itself. Cancels any fetch in flight for that key and publishes to every live subscriber.
  - `subscribe(key, fetcher, onUpdate, options?)` — the live read path: serves a cache hit synchronously, de-dupes concurrent fetches for the same key, cancels the fetch when the last subscriber leaves (unmount, or a month/account switch), and notifies `onUpdate` with `{ data, isLoading, error }`.
  - `refresh(key, fetcher)` — an awaitable forced re-read that publishes to every live subscriber. Resolves with the published `{ data, isLoading, error }`, or `null` when the refresh was superseded before publishing (its key was cleared or overwritten mid-flight), which is precisely the case where a caller should stay quiet rather than report a failure.
  - `prefetch(key, fetcher)` — fire-and-forget warm-up for a month nothing is mounted on. A cache hit or an already in-flight fetch is a no-op, and failures are swallowed.
  - `clear()` — full reset of every cached month, listener, and in-flight fetch. Used in tests, and in production on an account switch.

The fetcher is passed in rather than owned by the model, so `src/services/mentor-schedule` stays the only place that knows the schedule endpoint. `subscribe` / `refresh` / `prefetch` are the only ways a fetch ever starts.

## Staleness Contract

- **No TTL — invalidate-driven.** A cached month never expires on its own. A mentor's schedule only changes through this app's own writes (save, discard, explicit reload), all of which come back through `set()` or `refresh()`, so swiping back to a month already viewed is a cache hit with no second request. This differs from the calendar's _reservation_ slots, which can change from the other party's action and therefore carry a TTL (see `MENTOR_SCHEDULE_RESERVATIONS_TTL_MS` above).
- **Read-your-writes.** `set()` cancels any in-flight fetch for that key before applying (inherited `AsyncReadManager` guarantee), so a slower response can never clobber a more recent local write.
- **Cancellation is ownership-driven.** A month's request lives exactly as long as something is reading it. When the calendar swipes away or the component unmounts, the last subscriber leaves and the request is aborted; its response is never cached and never notified. `prefetch` and `refresh` hold their own listener for the life of one request precisely so they are not cut short by that rule.
- **Per-(user, month) isolation.** `{ userId, year, month }` is the whole key; there is no cross-key invalidation, so a response for the month or account the user has moved on from has nowhere to land. `clear()` is the escape hatch on an account switch, which additionally aborts the outgoing user's in-flight reads.

## Consumers

- `useMentorSchedule` (`src/hooks/useMentorSchedule.ts`) binds the viewed month through `useAsyncRead` and mirrors what the model publishes into `MonthDraftStore`. `MonthDraftStore` itself takes `get` as an injected `getCachedMonthScheduleFn` so it stays a pure, non-React unit under test.
- `src/services/mentor-schedule/sync.ts` publishes through the model from `loadMonthScheduleFresh` (save / discard) and `prefetchMonthSchedule` (next-month warm-up); `loadMonthSchedule` is the raw network read and touches no cache at all.

---

# Context: ReservationIdentity

This document establishes and defines the canonical domain term for the shared reservation-surface identity block.

## Canonical Term

**`ReservationIdentity`** (or Reservation Identity), together with its extracted sub-component **`ReservationIdentityHeader`**

## Context & Purpose

Every surface that shows a reservation to a mentor - `ConfirmedReservationDialog`, `QuickReplyDialog`, `AcceptReservationDialog`, and `ReservationCard` - needs the same avatar + name + role line (+ optional status badge) block for the counterparty, but each surface's padding, spacing, and surrounding layout (date/time row, message previews, actions) differs enough that they can't share one rigid component. `ReservationIdentity` (and its inner `ReservationIdentityHeader`) was extracted (commit `30846066`, "extract ReservationIdentity module, adopt in confirmed/quick-reply dialogs") to own that shared identity layout once, while leaving each caller free to control what surrounds it.

## Module Details

- **Location**: `src/components/reservation/ReservationIdentity.tsx`
- **Main Exports**: `ReservationIdentity` (identity block + date/time row + optional message preview) and `ReservationIdentityHeader` (just the avatar/name/role/badge block, for a caller whose surrounding layout diverges too far to share, e.g. `ReservationCard`).
- **Domain Vocabulary**:
  - **`ReservationIdentityDensity`**: `'default' | 'compact'` - controls the identity card's padding.
  - **`ReservationIdentityHeaderVariant`**: `'dialog' | 'compact' | 'card'` - controls the header block's layout/styling (avatar size, whether the role line sits inside or below the name link, badge placement).
  - **`ReservationIdentityVariant`**: `'dialog' | 'accept'` - controls `ReservationIdentity`'s outer layout (date/time row styling, default `showMessages`), and maps onto one of the header variants above.

## What It Owns vs. What Callers Supply

`ReservationIdentity` / `ReservationIdentityHeader` own only the **layout** for these three variant axes - sizing, spacing, and which elements render where. They explicitly do **not** own, and always take as caller-supplied props instead:

- **Viewer role**: `sourceRole` (`'mentor' | 'mentee'`) is a required prop with no default, so a caller reusing the `'dialog'` variant for a mentee-facing surface can't silently inherit the wrong role.
- **Whether a profile link exists**: `profileHref` and `linkToProfile` are caller-supplied; when `profileHref` is absent (or `linkToProfile` is `false`), the avatar and name render as plain, non-link elements.
- **Which actions are available**: `ReservationIdentityHeader`'s `children` slot (e.g. `ReservationCard`'s date/time row and action buttons) and `ReservationIdentity`'s `showMessages` / `showStatusBadge` flags are all caller-decided; the module itself renders no reservation actions.

## Consumers

- `ConfirmedReservationDialog` and `QuickReplyDialog` (`src/components/profile/reservation/`) use `ReservationIdentity` with the `'dialog'` variant.
- `AcceptReservationDialog` (`src/components/reservation/AcceptReservationDialog.tsx`) uses `ReservationIdentity` with the `'accept'` variant.
- `ReservationCard` (`src/components/reservation/ReservationCard.tsx`) uses `ReservationIdentityHeader` directly (the `'card'` header variant), since its date/time and message layout diverges too far from the dialogs to share the outer `ReservationIdentity` wrapper.
