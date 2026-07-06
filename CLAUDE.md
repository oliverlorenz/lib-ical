# CLAUDE.md — Guidance for AI agents working on lib-ical

## Project overview

`@oliverlorenz/lib-ical` is a zero-dependency TypeScript library for parsing, manipulating, and querying iCalendar (RFC 5545) data. The public API surface is the `Calendar` class; all other classes are also exported for direct use.

## Commands

```bash
npm test              # build + jest with coverage (also runs on pre-commit)
npm run test:watch    # jest watch mode with HTML coverage
npm run build          # tsc compile → dist/
npm run lint:eslint    # ESLint (also runs on pre-push)
npm run lint:prettier  # Prettier format check (also runs on pre-push)
npm run lint:types     # tsc --noEmit + tsc-strict plugin
npm run lint:knip      # knip — unused exports, files, dependencies
npm run lint:md        # markdownlint — markdown syntax in all *.md files
npm run lint:readme    # check README.md has required sections (Installation, Quick start)
npm run lint:links     # check all links in README.md are reachable (local only, not in CI)
npm run lint:publint   # publint — package.json exports/main/types correctly configured
npm run lint:attw      # are-the-types-wrong — TypeScript types correctly exported (needs dist/)
npm run lint:audit     # audit-ci — fail on high-severity dependency vulnerabilities
npm run check:all      # run all git hooks locally
```

Git hooks: pre-commit runs `test`; pre-push runs `lint:eslint && lint:prettier && test`.

**Before every commit:** run `npm run lint:eslint && npm run lint:prettier` and fix all issues first. The pre-push hook will catch failures anyway, but fixing them before commit avoids a broken commit history.

When `npm test` fails only due to a coverage threshold, run `npm test -- --coverage 2>&1 | grep -E "Uncovered|%"` to see exactly which lines/branches are uncovered.

## Release & versioning

Releases are fully automated via `semantic-release`. No manual steps required after merging.

**The PR title is the release signal.** Because all PRs are squash-merged, the PR title becomes the commit message on `main`. `semantic-release` reads these commits to determine the version bump, generate `CHANGELOG.md`, create the GitHub Release, and publish to GitHub Packages.

| PR title prefix | Version bump | In release notes |
| --- | --- | --- |
| `feat: …` | minor (0.**x**.0) | ✅ Features |
| `fix: …` | patch (0.x.**x**) | ✅ Bug Fixes |
| `perf: …` / `revert: …` | patch (0.x.**x**) | ✅ |
| `feat!: …` or `BREAKING CHANGE:` in body | major (**x**.0.0) | ✅ Breaking |
| `refactor: …` / `docs: …` / `chore: …` / `ci: …` / `test: …` / `build: …` | no release | — |

**When writing PR titles:**

- Use imperative, lowercase: `feat: add attendee lookup` not `feat: Added attendee lookup`
- Scope is optional: `feat(linter): add rule for missing location` is fine
- Breaking change via `!` suffix: `feat!: change Calendar constructor signature`
- For breaking changes, also fill in the "Breaking changes" section of the PR template with migration instructions — this text ends up in the release notes

**Do not:**

- Create `chore(release): …` commits manually — those are written back by `semantic-release`
- Bump the version in `package.json` manually — `semantic-release` owns the version
- Edit `CHANGELOG.md` manually — it is auto-generated

## Architecture

All logic lives in `src/`. One class per file, mirroring the public API.

```text
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
CalendarBuilder.ts   — fluent builder for constructing VCALENDAR/VEVENT components
CalendarLinter.ts    — lint events for quality issues (extensible rule set)
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
- **No `test.only` / `describe.only`** in `*.spec.ts` (`no-only-tests/no-only-tests: error`).
- **Filenames starting with an uppercase letter must be PascalCase** (`check-file/filename-naming-convention: error`) — matches the one-class-per-file convention.
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

## Requirements

- Node >= 22.0.0
- Publish target: `https://npm.pkg.github.com`
