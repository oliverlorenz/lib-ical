# @oliverlorenz/lib-ical

A lightweight TypeScript library for parsing, serializing, and manipulating iCal (`.ics`) files. Zero runtime dependencies.

## Features

- Parse iCal strings into a structured component tree
- Fetch and parse calendars directly from a URL
- Serialize the component tree back to a valid iCal string (full round-trip)
- Anonymize calendars (strip personal data, replace event titles)
- Merge multiple calendars into one (VTIMEZONE deduplication included)
- Remove or clip events within time ranges — with full recurring event support (EXDATE + exception events)
- Filter or keep events by property value
- List all event occurrences in a date range (recurring events expanded automatically)
- Expand recurring events into individual VEVENT components
- Find scheduling conflicts between overlapping events
- Diff two calendar versions to detect added, removed, and changed events
- Find free time slots in a calendar window
- Count total busy time within a window
- Invert a calendar to produce a free-time calendar
- Lint events for quality issues (missing attendees/location, extensible rule set)

## Requirements

- Node.js ≥ 22

## Installation

```bash
npm install @oliverlorenz/lib-ical
```

## Quick start

```typescript
import { Calendar } from '@oliverlorenz/lib-ical';

const calendar = Calendar.create();

// Parse from string
const component = calendar.parse(icsString);

// Or fetch directly from a URL
const component = await calendar.loadFromUrl('https://example.com/calendar.ics');

// Serialize back to iCal
const icsString = calendar.serialize(component);
```

## Examples

Runnable examples are in the [examples/](examples/) folder. Each example imports from `@oliverlorenz/lib-ical`, so build the package first (`npm run build`) before executing them.

| Example | What it shows |
| --- | --- |
| [01-parse-and-serialize.ts](examples/01-parse-and-serialize.ts) | Parse an iCal string, inspect the component tree, serialize back |
| [02-anonymize-and-merge.ts](examples/02-anonymize-and-merge.ts) | Strip personal data with `anonymize`, combine calendars with `merge` |
| [03-clean-range.ts](examples/03-clean-range.ts) | Block a holiday week in a recurring event series with `cleanRange` |
| [04-filter-events.ts](examples/04-filter-events.ts) | Remove or keep events by property pattern with `filterEvents`/`keepEvents` |
| [05-list-and-expand.ts](examples/05-list-and-expand.ts) | List occurrences in a range with `listEvents`, flatten RRULE events with `expandRecurring` |
| [06-free-slots-and-busy-time.ts](examples/06-free-slots-and-busy-time.ts) | Find open slots with `findFreeSlots`, measure load with `countBusyTime`, invert a calendar |
| [07-find-conflicts.ts](examples/07-find-conflicts.ts) | Detect overlapping events with `findConflicts` |
| [08-diff-calendars.ts](examples/08-diff-calendars.ts) | Compare two calendar versions with `diff` |
| [09-lint-calendar.ts](examples/09-lint-calendar.ts) | Flag events with missing attendees/location using `lint` |

## API

All methods are immutable — they return new component trees and never mutate their inputs.

### `Calendar.create(): Calendar`

Factory method that creates a `Calendar` instance with default dependencies. This is the recommended entry point.

```typescript
const calendar = Calendar.create();
```

### `calendar.parse(input: string): ICalComponent`

Parses an iCal string into a component tree. The root component is always a `VCALENDAR`.

```typescript
const component = calendar.parse(icsString);
console.log(component.name); // 'VCALENDAR'
console.log(component.components.filter(c => c.name === 'VEVENT').length);
```

### `calendar.loadFromUrl(url: string): Promise<ICalComponent>`

Fetches an iCal file from the given URL and parses it. Throws if the server returns a non-2xx status.

```typescript
const component = await calendar.loadFromUrl('https://example.com/calendar.ics');
```

### `calendar.serialize(component: ICalComponent): string`

Serializes a component tree back to a valid iCal string. Lines are folded at 75 octets as required by RFC 5545.

```typescript
const icsString = calendar.serialize(component);
```

### `calendar.anonymize(component: ICalComponent): ICalComponent`

Returns a new component with personal data removed. Useful for sharing or storing calendar data without exposing private information.

What gets replaced/removed:

| Property | Action |
| --- | --- |
| `SUMMARY` | Replaced with `"Event"` |
| `DESCRIPTION` | Removed |
| `LOCATION` | Removed |
| `ORGANIZER` | Removed |
| `ATTENDEE` | Removed |
| `COMMENT`, `CONTACT` | Removed |
| `URL`, `GEO` | Removed |
| `CATEGORIES` | Removed |
| `X-WR-CALNAME` | Removed |

All sub-components (e.g. `VALARM`) are processed recursively.

```typescript
const anonymous = calendar.anonymize(component);
```

### `calendar.merge(first: ICalComponent, ...rest: ICalComponent[]): ICalComponent`

Combines two or more calendars into one. Calendar-level properties (VERSION, PRODID, etc.) are taken from the first calendar. Duplicate `VTIMEZONE` components are deduplicated by TZID.

```typescript
const merged = calendar.merge(calA, calB, calC);
```

### `calendar.cleanRange(component, start: Date, end: Date): ICalComponent`

Removes or clips all events that overlap the given time range. The range is half-open: `[start, end)`.

| Event overlap | Result |
| --- | --- |
| No overlap | Kept unchanged |
| Fully inside range | Removed |
| Starts before range, ends inside | DTEND clipped to `start` |
| Starts inside range, ends after | DTSTART clipped to `end` |
| Spans entire range | Split into two events (`UID` and `UID-split`) |

**Recurring events** (those with `RRULE`) are handled specially: matching occurrences are excluded via `EXDATE`, and clipped/split occurrences produce exception `VEVENT` components. The base event with its `RRULE` is always preserved so the series continues outside the range.

```typescript
const cleaned = calendar.cleanRange(
  component,
  new Date('2025-06-01T00:00:00Z'),
  new Date('2025-06-08T00:00:00Z'),
);
```

### `calendar.cleanRanges(component, ranges: ReadonlyArray<[Date, Date]>): ICalComponent`

Applies `cleanRange` for each range in sequence. Ranges are processed in order, so the output of each step feeds into the next.

```typescript
const cleaned = calendar.cleanRanges(component, [
  [new Date('2025-06-01T00:00:00Z'), new Date('2025-06-08T00:00:00Z')],
  [new Date('2025-12-24T00:00:00Z'), new Date('2025-12-27T00:00:00Z')],
]);
```

### `calendar.filterEvents(component, ...criteria: EventFilterCriteria[]): ICalComponent`

Returns a new calendar with all `VEVENT` components that match **any** of the given criteria removed. Non-VEVENT components (VTIMEZONE, VALARM, etc.) are always kept.

```typescript
// Remove all events whose SUMMARY contains "Meeting"
const filtered = calendar.filterEvents(component, {
  property: 'SUMMARY',
  pattern: /Meeting/,
});
```

### `calendar.keepEvents(component, ...criteria: EventFilterCriteria[]): ICalComponent`

The inverse of `filterEvents` — keeps only `VEVENT` components that match at least one criterion.

```typescript
// Keep only events categorised as WORK
const workOnly = calendar.keepEvents(component, {
  property: 'CATEGORIES',
  pattern: /WORK/,
});
```

`EventFilterCriteria`:

```typescript
interface EventFilterCriteria {
  property?: string; // which property to test (omit to test all properties)
  pattern: RegExp;   // matched against the property value
}
```

### `calendar.listEvents(component, from: Date, to: Date): ICalComponent[]`

Returns all event occurrences that fall within `[from, to]`. Recurring events are automatically expanded — each occurrence is returned as a separate `ICalComponent` with concrete `DTSTART`/`DTEND` values. The list is sorted by `DTSTART` ascending.

```typescript
const events = calendar.listEvents(
  component,
  new Date('2025-01-01T00:00:00Z'),
  new Date('2025-01-31T23:59:59Z'),
);
for (const event of events) {
  const start = event.properties.find((p) => p.name === 'DTSTART')?.value;
  const summary = event.properties.find((p) => p.name === 'SUMMARY')?.value;
  console.log(`${start}  ${summary}`);
}
```

### `calendar.expandRecurring(component, from: Date, to: Date): ICalComponent`

Returns a new `VCALENDAR` where each recurring `VEVENT` (those with an `RRULE`) is replaced by individual occurrence `VEVENT` components for the given window. Non-recurring events and non-VEVENT components are kept as-is.

```typescript
const expanded = calendar.expandRecurring(
  component,
  new Date('2025-01-01T00:00:00Z'),
  new Date('2025-03-31T23:59:59Z'),
);
// expanded.components contains individual VEVENTs, no RRULE properties
```

### `calendar.findConflicts(component, from: Date, to: Date): ConflictPair[]`

Returns all pairs of events within the window whose time intervals overlap (`aStart < bEnd && bStart < aEnd`).

```typescript
const conflicts = calendar.findConflicts(component, from, to);
for (const { first, second } of conflicts) {
  const a = first.properties.find((p) => p.name === 'SUMMARY')?.value;
  const b = second.properties.find((p) => p.name === 'SUMMARY')?.value;
  console.log(`Conflict: "${a}" overlaps "${b}"`);
}
```

`ConflictPair`:

```typescript
interface ConflictPair {
  first: ICalComponent;
  second: ICalComponent;
}
```

### `calendar.diff(before, after: ICalComponent): CalendarDiffResult`

Compares two calendar snapshots and returns which events were added, removed, or changed. Events are matched by `UID` (and `RECURRENCE-ID` for exception events). An event is considered changed when any property value differs.

```typescript
const { added, removed, changed } = calendar.diff(before, after);
console.log('New events:', added.length);
console.log('Deleted events:', removed.length);
console.log('Modified events:', changed.length);
```

`CalendarDiffResult`:

```typescript
interface CalendarDiffResult {
  added: ICalComponent[];
  removed: ICalComponent[];
  changed: ICalComponent[];
}
```

### `calendar.findFreeSlots(component, from: Date, to: Date, minDurationMs?: number): ICalComponent[]`

Returns `VEVENT` components representing the gaps between booked events within `[from, to]`. Optionally filters out slots shorter than `minDurationMs`.

```typescript
const ONE_HOUR = 60 * 60 * 1000;
const slots = calendar.findFreeSlots(
  component,
  new Date('2025-06-02T08:00:00Z'),
  new Date('2025-06-02T18:00:00Z'),
  ONE_HOUR,
);
for (const slot of slots) {
  const start = slot.properties.find((p) => p.name === 'DTSTART')?.value;
  const end = slot.properties.find((p) => p.name === 'DTEND')?.value;
  console.log(`Free: ${start} → ${end}`);
}
```

### `calendar.countBusyTime(component, from: Date, to: Date): number`

Returns the total number of milliseconds occupied by events within `[from, to]`. Overlapping events are merged before counting so time is never double-counted.

```typescript
const busyMs = calendar.countBusyTime(component, from, to);
console.log(`Busy: ${busyMs / 3_600_000} h`);
```

### `calendar.invert(component, from: Date, to: Date): ICalComponent`

Returns a new `VCALENDAR` whose `VEVENT` components represent the free gaps between booked events in the window — the complement of the calendar within `[from, to]`. This is the primitive that `findFreeSlots` and `countBusyTime` are built on.

```typescript
const freeCal = calendar.invert(component, from, to);
// freeCal.components contains VEVENT entries for each unbooked interval
```

### `calendar.lint(component, rules?: ReadonlyArray<LintRule>): LintIssue[]`

Checks every `VEVENT` in the component tree against a set of rules and returns one `LintIssue` per violation. Defaults to the built-in rules `missing-attendees` (no `ATTENDEE` property) and `missing-location` (no `LOCATION` property, or an empty/whitespace value). Pass a custom `rules` array to replace or extend the defaults with further checks.

```typescript
const issues = calendar.lint(component);
for (const issue of issues) {
  console.log(`${issue.uid}: [${issue.rule}] ${issue.message}`);
}
```

`LintRule` / `LintIssue`:

```typescript
interface LintRule {
  name: string;
  check(event: ICalComponent): boolean; // true = rule violated
  message: string;
}

interface LintIssue {
  uid: string;
  summary?: string;
  rule: string;
  message: string;
}
```

## Data types

```typescript
interface ICalComponent {
  name: string;               // e.g. 'VCALENDAR', 'VEVENT', 'VTIMEZONE', 'VALARM'
  properties: ICalProperty[];
  components: ICalComponent[]; // nested components
}

interface ICalProperty {
  name: string;                      // e.g. 'DTSTART', 'SUMMARY', 'RRULE'
  params: Record<string, string>;    // e.g. { TZID: 'Europe/Berlin' }, { VALUE: 'DATE' }
  value: string;                     // e.g. '20250307T140000', 'FREQ=WEEKLY;BYDAY=MO'
}
```

## Advanced: dependency injection

All components are injectable via the `Calendar` constructor, which is useful for custom behaviour or testing.

```typescript
import {
  Calendar,
  Parser,
  Serializer,
  Anonymizer,
  Merger,
  RangeCleaner,
  EventFilter,
  EventLister,
  CalendarInverter,
  RecurringExpander,
  ConflictFinder,
  CalendarDiff,
  FreeSlotFinder,
  BusyTimeCounter,
} from '@oliverlorenz/lib-ical';

const calendar = new Calendar(
  new Parser(),
  new Serializer(),
  new Anonymizer('Termin'),   // custom summary replacement
  new Merger(),
  new RangeCleaner(),
  new EventFilter(),
  new EventLister(),
  new CalendarInverter(),
  new RecurringExpander(),
  new ConflictFinder(),
  new CalendarDiff(),
  new FreeSlotFinder(),
  new BusyTimeCounter(),
);
```

`Anonymizer` constructor signature:

```typescript
new Anonymizer(
  summaryReplacement: string = 'Event',
  propertiesToRemove: ReadonlySet<string> = DEFAULT_SET,
)
```

## Supported RRULE frequencies

`cleanRange`, `listEvents`, `expandRecurring`, and `RRuleExpander` support the following `FREQ` values:

| FREQ | INTERVAL | BYDAY | BYMONTHDAY | COUNT | UNTIL |
| --- | --- | --- | --- | --- | --- |
| `DAILY` | ✓ | — | — | ✓ | ✓ |
| `WEEKLY` | ✓ | ✓ | — | ✓ | ✓ |
| `MONTHLY` | ✓ | — | ✓ | ✓ | ✓ |
| `YEARLY` | ✓ | — | — | ✓ | ✓ |

Positional `BYDAY` values (e.g. `1MO`, `-1FR`) are treated as plain day-of-week (`MO`, `FR`). Events with unsupported frequencies (e.g. `HOURLY`) fall back to non-recurring logic.

## Known limitations

- **Timezone handling**: `DTSTART`/`DTEND` values with a `TZID` parameter (e.g. `DTSTART;TZID=Europe/Berlin:20250115T100000`) are resolved to the correct UTC instant using `Intl.DateTimeFormat`, including DST, wherever datetime arithmetic happens (`cleanRange`, `listEvents`, `findFreeSlots`, and related methods). `VTIMEZONE` `STANDARD`/`DAYLIGHT` sub-components are not parsed — resolution relies on `TZID` being (or resolving to) a valid IANA zone name. "Globally unique" `TZID`s with a leading slash (e.g. `/freeassociation.sourceforge.net/Europe/Berlin`, as emitted by some older calendar clients) are normalized by stripping the vendor domain prefix before resolution. A `TZID` that still can't be resolved falls back to UTC (0 offset) rather than throwing. Values with no `TZID` and no trailing `Z` are still treated as floating/UTC, unchanged from before.
- **RRULE with TZID near local midnight**: `RRuleExpander`'s `BYDAY`/`BYMONTHDAY` alignment is derived from `dtstart`'s UTC calendar day. For a recurring event whose local start time is close enough to midnight that its UTC offset crosses a day boundary, the generated occurrences can land a day off from the local day the rule was authored against. Non-recurring events and recurring events with daytime local start times are unaffected.
- **RRULE**: BYSECOND, BYMINUTE, BYHOUR, BYYEARDAY, BYWEEKNO, BYSETPOS, and positional BYDAY (`1MO`) are not fully implemented.

## Development

```bash
npm test          # build + run all tests with coverage
npm run lint      # eslint + prettier + type checks
npm run test:watch
```
