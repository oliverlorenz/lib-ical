# @oliverlorenz/lib-ical

A lightweight TypeScript library for parsing, serializing, and manipulating iCal (`.ics`) files. Zero runtime dependencies.

## Features

- Parse iCal strings into a structured component tree
- Fetch and parse calendars directly from a URL
- Serialize the component tree back to a valid iCal string (full round-trip)
- Anonymize calendars (strip personal data, replace event titles)
- Merge multiple calendars into one (VTIMEZONE deduplication included)
- Remove or clip events within time ranges — with full recurring event support (EXDATE + exception events)

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
|---|---|
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
|---|---|
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
import { Calendar, Parser, Serializer, Anonymizer, Merger, RangeCleaner } from '@oliverlorenz/lib-ical';

const calendar = new Calendar(
  new Parser(),
  new Serializer(),
  new Anonymizer('Termin'),   // custom summary replacement
  new Merger(),
  new RangeCleaner(),
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

`cleanRange` and `RRuleExpander` support the following `FREQ` values:

| FREQ | INTERVAL | BYDAY | BYMONTHDAY | COUNT | UNTIL |
|---|---|---|---|---|---|
| `DAILY` | ✓ | — | — | ✓ | ✓ |
| `WEEKLY` | ✓ | ✓ | — | ✓ | ✓ |
| `MONTHLY` | ✓ | — | ✓ | ✓ | ✓ |
| `YEARLY` | ✓ | — | — | ✓ | ✓ |

Positional `BYDAY` values (e.g. `1MO`, `-1FR`) are treated as plain day-of-week (`MO`, `FR`). Events with unsupported frequencies (e.g. `HOURLY`) fall back to non-recurring logic.

## Known limitations

- **Timezone handling**: TZID parameters on `DTSTART`/`DTEND` are preserved as-is during parse/serialize, but datetime arithmetic in `cleanRange` treats all values as UTC/floating. Timezone-aware expansion is not supported.
- **RRULE**: BYSECOND, BYMINUTE, BYHOUR, BYYEARDAY, BYWEEKNO, BYSETPOS, and positional BYDAY (`1MO`) are not fully implemented.

## Development

```bash
npm test          # build + run all tests with coverage
npm run lint      # eslint + prettier + type checks
npm run test:watch
```
