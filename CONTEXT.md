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
