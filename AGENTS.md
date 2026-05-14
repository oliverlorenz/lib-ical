# AGENTS.md — Guidance for AI agents working on lib-ical

## Project overview

`@oliverlorenz/lib-ical` is a zero-dependency TypeScript library for parsing, manipulating, and querying iCalendar (RFC 5545) data. The public API surface is the `Calendar` class; all other classes are also exported for direct use.

## Self-check — run these before reporting a task as done

Run the checks in this order. Each step must pass before the next is meaningful.

```bash
# 1. Auto-fix formatting (no output = nothing changed)
npx prettier "src/**/*.ts" --write

# 2. Full lint: ESLint + Prettier check + type check
npm run lint

# 3. Build + tests + coverage thresholds
npm test
```

**What to look for:**

| Check | Pass condition |
|---|---|
| `lint:eslint` | No output (zero errors) |
| `lint:prettier` | "All matched files use Prettier code style!" |
| `lint:types` | "All files passed" |
| `test` | All test suites pass, coverage thresholds met |

When `npm test` fails only due to a threshold, run `npm test -- --coverage 2>&1 | grep -E "Uncovered|%"` to see exactly which lines/branches are uncovered.

## Architecture

All logic lives in `src/`. One class per file, mirroring the public API.

```
Calendar.ts          — facade; delegates every operation to an injected service
Parser.ts            — text → ICalComponent tree
Serializer.ts        — ICalComponent tree → text
Anonymizer.ts        — replace personal data with generic placeholders
Merger.ts            — combine multiple VCALENDAR components
RangeCleaner.ts      — remove/clip events that overlap a time range
EventFilter.ts       — filter events by property regex (filter = remove, keep = retain)
EventLister.ts       — expand events (incl. RRULE) in a time window → flat list
CalendarInverter.ts  — build "anti-calendar" (free-time events) from busy events
RecurringExpander.ts — convert RRULE events to concrete single occurrences
ConflictFinder.ts    — find overlapping event pairs
CalendarDiff.ts      — diff two calendars (added / removed / changed)
FreeSlotFinder.ts    — find free slots with optional minimum duration
BusyTimeCounter.ts   — sum up busy time in milliseconds
RRuleExpander.ts     — low-level RRULE expansion (DAILY/WEEKLY/MONTHLY/YEARLY)
datetime.ts          — parseDatetimeValue / formatUtcDatetime helpers
types.ts             — ICalComponent, ICalProperty interfaces
index.ts             — re-exports everything
```

`Calendar` wires all services together. When adding a new capability:
1. Create `src/NewService.ts` + `src/NewService.spec.ts`
2. Add a method on `Calendar` that delegates to it
3. Export from `src/index.ts`
4. Export the type from `src/Calendar.ts` if needed
5. **Update `README.md`** — add the new method to the API reference table and add a usage example

## README.md

`README.md` is the public-facing documentation. Keep it in sync with the code:

- **API table** — every public method on `Calendar` must appear with its signature and a one-line description.
- **Usage examples** — add a short code snippet for any new method that isn't obvious from its name.
- **No dead entries** — if a method is removed or renamed, update the README in the same change.

When in doubt whether a README update is needed: if `npm test` passes but the README still describes the old behaviour, the task is not done.

## Code style rules (enforced by ESLint + tsc-strict)

- **No `!` non-null assertions** (`@typescript-eslint/no-non-null-assertion: error`) in production code. Use `as Type` for array accesses that are logically guaranteed, or keep an explicit null check so the branch can be tested.  
  `!` is allowed in `*.spec.ts` files.
- **Explicit return types** on all functions and class members (`explicit-function-return-type: error`).
- **Explicit accessibility modifiers** on all class members (`explicit-member-accessibility: error`). Constructors use `no-public`.
- **No `any`** is off (allowed), but avoid it anyway.
- Prettier formats everything — run `npx prettier "src/**/*.ts" --write` after edits.

## Testing rules

- Every `src/Foo.ts` has a matching `src/Foo.spec.ts`.
- Coverage thresholds in `jest.config.js`
- Istanbul counts inline arrow functions and `??` ternary branches. When a null-guard branch (`if (!x) return`) is logically unreachable via the normal code path, cover it by injecting a mock dependency that returns a component without dates.
- Spec files import the class under test plus any mocked dependency classes. Pattern for mocking a collaborator:
  ```typescript
  const mock = { methodName: () => result } as unknown as ServiceClass;
  const instance = new MyClass(mock);
  ```
- Default constructor parameters create branches. When a function has an optional parameter with a default (e.g., `minDurationMs = 0`), test both the call with and without that parameter.

## Dependency injection pattern

`Calendar` constructor accepts all services as optional parameters with defaults. When writing a delegation test for Calendar, pass only the service under test and let the rest default to `undefined`:

```typescript
const cal = new Calendar(
  {} as Parser, {} as Serializer, {} as Anonymizer, {} as Merger, {} as RangeCleaner,
  undefined, undefined, undefined, undefined, undefined, undefined,
  { find } as unknown as FreeSlotFinder, // position 12 = freeSlotFinder
);
```

Constructor parameter order (0-indexed):
0. parser  1. serializer  2. anonymizer  3. merger  4. rangeCleaner
5. eventFilter  6. eventLister  7. calendarInverter  8. recurringExpander
9. conflictFinder  10. calendarDiff  11. freeSlotFinder  12. busyTimeCounter

## Data model

```typescript
interface ICalProperty { name: string; params: Record<string, string>; value: string; }
interface ICalComponent { name: string; properties: ICalProperty[]; components: ICalComponent[]; }
```

All methods are pure/immutable — they return new objects and never mutate inputs.

## Datetime format

iCal datetimes come in two forms:
- All-day: `YYYYMMDD` (e.g. `20240115`)
- Date-time: `YYYYMMDDTHHmmssZ` (e.g. `20240115T100000Z`)

`parseDatetimeValue(value)` returns `Date | null` (null for unrecognised formats).  
`formatUtcDatetime(date)` always outputs the date-time form.

Implied duration when DTEND is absent: all-day → +1 day, date-time → 0 ms.
