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
