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
- **Key Shape**: `ReservationReadKey = { userId: string; state: ReservationState }` — one cache entry per user _and_ reservation state (`MENTEE_UPCOMING`, `MENTEE_PENDING`, `MENTEE_HISTORY`, `MENTOR_UPCOMING`, `MENTOR_PENDING`, `MENTOR_HISTORY`). Callers never see or construct the underlying string cache key.
- **Contract Signature**:
  - `get(key)` — synchronous cached-snapshot read (`FetchReservationsResult | undefined`), used where a caller needs the current page/cursor without subscribing (e.g. reading `next_dtend` before a "load more" fetch).
  - `subscribe(key, fetcher, onUpdate, options?)` — the live read path: serves a cache hit synchronously, de-dupes concurrent fetches for the same key, and notifies `onUpdate` with `{ data, isLoading, error }` as the fetch resolves. `options` only ever accepts `force` and `initialData` — there is no `ttlMs` or `cache` handle for a caller to pass in.
  - `update(key, updater)` / `invalidate(key)` — the write vocabulary inherited from `AsyncReadManager` (X-Tracker #645), used for optimistic removal after a mutation, appending a "load more" page, and refetch-on-409-conflict.
  - `clear()` — test-only full reset.

By construction, callers can only interact with reservation caching through these methods — there is no way to reach the shared cache, override its TTL, or read/write a raw string key.

## Staleness Contract

- **No TTL — invalidate-driven.** A cached page never expires on its own; it is correct until a write (`update` / `invalidate`) says otherwise. Reservation state only ever changes through this app's own mutations (accept / reject / cancel / create) or a version-conflict refetch, all of which already call back into this model, so there is no unbounded-staleness window from an external actor changing data out from under an open tab.
- **Read-your-writes.** `update()` and `invalidate()` always cancel any in-flight fetch for that key before applying (inherited `AsyncReadManager` guarantee, X-Tracker #645 and its follow-up fixes), so a slow in-flight response can never clobber a more recent local write.
- **Per-(user, state) isolation.** `{ userId, state }` is the whole key — switching tabs, switching role, or a different signed-in user each land on an independent cache entry; there is no cross-key invalidation.

## Consumers

- `useReservationData` (`src/hooks/user/reservation/useReservationData.ts`) is the only consumer today. It subscribes once per tab (`upcoming` / `pending` / lazily-loaded `history`) and drives every mutation-triggered cache write through this model.
- The mentor-schedule calendar's own reservation cache (`src/services/mentor-schedule/reservationsCache.ts`) is a separate, differently-shaped cache (keyed by month, with a 30s TTL) and does not go through this model yet — moving it onto this seam is the tracked follow-up to this ticket (X-Tracker #648).
