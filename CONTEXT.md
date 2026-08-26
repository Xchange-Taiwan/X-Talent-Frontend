# Context: BookingAvailabilityReadModel

This document establishes and defines the canonical domain term for the modular booking availability read model.

## Canonical Term

**`BookingAvailabilityReadModel`** (or Booking Availability Read Model)

## Context & Purpose

In the mentor scheduling domain, deriving the final calendar view is a multi-layered pure computation. It involves:

1. **Occurrence Expansion**: Expanding weekly recurrence rules (RRules) into concrete timestamps.
2. **Exdate Exclusion**: Excluding specific deleted/modified dates (exdates) from the expanded recurrence list.
3. **Past-Occurrence Filtering**: Filtering out any slots that occurred in the past relative to a given point in time.
4. **Precedence Resolution**: Layering `BOOKED` or `PENDING` states on top of free `ALLOW` slots.
5. **Deduplication**: Ensuring overlapping slots are consolidated safely into distinct selectable choices.

To ensure this pure logic can be developed, optimized, and thoroughly unit-tested without relying on the React hook rendering lifecycle, we extracted this computation into a dedicated non-React module: **`BookingAvailabilityReadModel`**.

## Module Details

- **Location**: `src/lib/profile/bookingAvailability/`
- **Main Entry Point**: `computeBookingAvailability`
- **Contract Signature**:
  - **Inputs**: Raw draft rows (`RawMentorTimeslot[]`), current reservations (`Reservation[]`), a reference current timestamp (`nowSec`), and an optional mentor viewing intent (`includeBookedDates`).
  - **Outputs**: Selected calendar view payload including `allowedDates` (selectable dates), `bookingStatusByDate` (performance-optimized per-date status dots lookup map), and a generator function `generateBookingSlots` for any given date.

By formalizing the **`BookingAvailabilityReadModel`**, downstream features (such as dialogs, detail cards, and calendar status widgets) can reuse this precise logic with a unified, predictable vocabulary.

## Domain Vocabulary & Types

The booking availability module serves as the single source of truth for all mentor-scheduling domain vocabulary. By homing these types here rather than in a React hook, we prevent layer-violation issues (e.g. non-React utilities or Storybook stories importing React state context hooks).

Key types exported from this module (`src/lib/profile/bookingAvailability/`):

- **`BookingSlot`**: Represents a single bookable timeslot occurrence (start, end, schedule ID, booking/status, mentee, reservation info).
- **`BookingStatus`**: An enum defining the booking status (`'PENDING' | 'BOOKED'`).
- **`ParsedMentorTimeslot`**: An expanded, formatted representation of a raw timeslot occurrence used directly in the schedule editor.
- **`SlotsSnapshot`**: A snapshot structure grouping the selected date's booking slots with their loading flags (`monthLoaded`, `reservationsLoaded`).
- **`SlotDurationMinutes`**: Valid slot durations (`30 | 45 | 60`).
- **`BookingCalendarReader`**: A narrow read-only interface used by mentees and visitors to view a mentor's booking schedule.
- **`MentorScheduleEditor`**: A narrow stateful interface used by the mentor to manage and sync their available slots.

## Elapsed Time Behavior (Page Open)

To ensure consistency and prevent race conditions, the **`BookingAvailabilityReadModel`** explicitly treats the reference current timestamp (`nowSec`) as a **frozen instant contract**.

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
- `useMentorSchedule` (`src/hooks/useMentorSchedule.ts`, X-Tracker #650) reads the mentor-schedule calendar's `MENTOR_UPCOMING` / `MENTOR_PENDING` reservations through this same model, scoped per viewed month via `endOfMonthUnix` and bounded by `MENTOR_SCHEDULE_RESERVATIONS_TTL_MS`. This replaced a separate, differently-shaped hand-rolled cache (`src/services/mentor-schedule/reservationsCache.ts`, now deleted) that duplicated this model's cache-first/TTL/full-wipe mechanics on its own.
