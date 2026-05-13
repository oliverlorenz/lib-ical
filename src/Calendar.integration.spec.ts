import * as fs from 'fs';
import * as path from 'path';
import { Calendar } from './Calendar';
import { ICalComponent } from './types';

const icsContent = fs.readFileSync(
  path.join(__dirname, 'mocks', 'calendar.ics'),
  'utf-8',
);

// UIDs from the fixture file
const UID_TZID_VALARM = '8fcbcf89-c585-4f0a-8890-2807e1386512'; // TZID event with VALARM
const UID_ALLDAY = '003aedcd-1b68-4468-afc8-a06a69e498c7'; // all-day (VALUE=DATE)
const UID_BIWEEKLY_FRIDAY = '07d2670c-3f58-4117-9714-466ea4a32fb0'; // RRULE FREQ=WEEKLY;INTERVAL=2;BYDAY=FR
const UID_YEARLY = '0848A8D7-5708-4D39-8CBA-D8E75EB36CDE'; // RRULE FREQ=YEARLY
const UID_SINGLE = '02b5d107-db88-4c00-9000-75d321bf4d49'; // non-recurring, 20260203T090000

function findEvent(component: ICalComponent, uid: string): ICalComponent | undefined {
  return component.components.find(
    (c) => c.name === 'VEVENT' && c.properties.some((p) => p.name === 'UID' && p.value === uid),
  );
}

function eventCount(component: ICalComponent): number {
  return component.components.filter((c) => c.name === 'VEVENT').length;
}

function timezoneCount(component: ICalComponent): number {
  return component.components.filter((c) => c.name === 'VTIMEZONE').length;
}

describe('Calendar integration (calendar.ics)', () => {
  const calendar = Calendar.create();
  let component: ICalComponent;

  beforeAll(() => {
    component = calendar.parse(icsContent);
  });

  // ── parse ──────────────────────────────────────────────────────────────────

  describe('parse', () => {
    it('creates a VCALENDAR root component', () => {
      expect(component.name).toBe('VCALENDAR');
    });

    it('contains 246 VEVENT components', () => {
      expect(eventCount(component)).toBe(246);
    });

    it('contains 2 VTIMEZONE components (Europe/Berlin, Europe/Rome)', () => {
      expect(timezoneCount(component)).toBe(2);
      const tzids = component.components
        .filter((c) => c.name === 'VTIMEZONE')
        .map((c) => c.properties.find((p) => p.name === 'TZID')?.value);
      expect(tzids).toContain('Europe/Berlin');
      expect(tzids).toContain('Europe/Rome');
    });

    it('preserves calendar-level properties (VERSION, PRODID, X-WR-CALNAME)', () => {
      const props = component.properties.map((p) => p.name);
      expect(props).toContain('VERSION');
      expect(props).toContain('PRODID');
      expect(props).toContain('X-WR-CALNAME');
    });

    it('parses a TZID event with VALARM correctly', () => {
      const event = findEvent(component, UID_TZID_VALARM)!;
      expect(event).toBeDefined();
      expect(event.properties.find((p) => p.name === 'DTSTART')?.value).toBe('20250307T140000');
      expect(event.properties.find((p) => p.name === 'DTSTART')?.params['TZID']).toBe('Europe/Berlin');
      expect(event.properties.find((p) => p.name === 'SUMMARY')?.value).toBe('Event');
    });

    it('parses an all-day event correctly', () => {
      const event = findEvent(component, UID_ALLDAY)!;
      expect(event).toBeDefined();
      expect(event.properties.find((p) => p.name === 'DTSTART')?.value).toBe('20260328');
      expect(event.properties.find((p) => p.name === 'DTSTART')?.params['VALUE']).toBe('DATE');
    });

    it('preserves VALARM sub-components inside events', () => {
      const event = findEvent(component, UID_TZID_VALARM)!;
      const alarm = event.components.find((c) => c.name === 'VALARM');
      expect(alarm).toBeDefined();
      expect(alarm?.properties.find((p) => p.name === 'ACTION')?.value).toBe('DISPLAY');
    });

    it('preserves RRULE on recurring events', () => {
      const biweekly = findEvent(component, UID_BIWEEKLY_FRIDAY)!;
      expect(biweekly.properties.find((p) => p.name === 'RRULE')?.value).toBe(
        'FREQ=WEEKLY;INTERVAL=2;BYDAY=FR',
      );

      const yearly = findEvent(component, UID_YEARLY)!;
      expect(yearly.properties.find((p) => p.name === 'RRULE')?.value).toBe('FREQ=YEARLY');
    });
  });

  // ── serialize ─────────────────────────────────────────────────────────────

  describe('serialize', () => {
    it('produces a string starting with BEGIN:VCALENDAR', () => {
      expect(calendar.serialize(component)).toMatch(/^BEGIN:VCALENDAR/);
    });

    it('round-trips: parse → serialize → parse yields the same event count and UIDs', () => {
      const reserialized = calendar.serialize(component);
      const reparsed = calendar.parse(reserialized);

      expect(eventCount(reparsed)).toBe(246);
      expect(findEvent(reparsed, UID_TZID_VALARM)).toBeDefined();
      expect(findEvent(reparsed, UID_BIWEEKLY_FRIDAY)?.properties.find((p) => p.name === 'RRULE')?.value).toBe(
        'FREQ=WEEKLY;INTERVAL=2;BYDAY=FR',
      );
    });

    it('preserves TZID parameters after round-trip', () => {
      const reparsed = calendar.parse(calendar.serialize(component));
      const event = findEvent(reparsed, UID_TZID_VALARM)!;
      expect(event.properties.find((p) => p.name === 'DTSTART')?.params['TZID']).toBe('Europe/Berlin');
    });

    it('preserves VALUE=DATE parameters after round-trip', () => {
      const reparsed = calendar.parse(calendar.serialize(component));
      const event = findEvent(reparsed, UID_ALLDAY)!;
      expect(event.properties.find((p) => p.name === 'DTSTART')?.params['VALUE']).toBe('DATE');
    });
  });

  // ── loadFromUrl ────────────────────────────────────────────────────────────

  describe('loadFromUrl', () => {
    afterEach(() => jest.restoreAllMocks());

    it('fetches and parses to the same structure as calendar.parse', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        text: async (): Promise<string> => icsContent,
      } as Response);

      const loaded = await calendar.loadFromUrl('https://example.com/calendar.ics');
      expect(loaded.name).toBe('VCALENDAR');
      expect(eventCount(loaded)).toBe(246);
      expect(findEvent(loaded, UID_TZID_VALARM)).toBeDefined();
    });

    it('throws when the server returns an error status', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      } as Response);

      await expect(calendar.loadFromUrl('https://example.com/calendar.ics')).rejects.toThrow(
        '401 Unauthorized',
      );
    });
  });

  // ── anonymize ──────────────────────────────────────────────────────────────

  describe('anonymize', () => {
    let anonymized: ICalComponent;

    beforeAll(() => {
      anonymized = calendar.anonymize(component);
    });

    it('replaces every VEVENT SUMMARY with "Event"', () => {
      const summaries = anonymized.components
        .filter((c) => c.name === 'VEVENT')
        .map((c) => c.properties.find((p) => p.name === 'SUMMARY')?.value)
        .filter(Boolean);
      expect(summaries.length).toBeGreaterThan(0);
      expect(summaries.every((s) => s === 'Event')).toBe(true);
    });

    it('removes X-WR-CALNAME from the calendar', () => {
      expect(anonymized.properties.find((p) => p.name === 'X-WR-CALNAME')).toBeUndefined();
    });

    it('preserves all 2 VTIMEZONE components', () => {
      expect(timezoneCount(anonymized)).toBe(2);
    });

    it('preserves UID and timing properties on events', () => {
      const event = findEvent(anonymized, UID_TZID_VALARM)!;
      expect(event).toBeDefined();
      expect(event.properties.find((p) => p.name === 'DTSTART')?.value).toBe('20250307T140000');
      expect(event.properties.find((p) => p.name === 'DTEND')?.value).toBe('20250307T160000');
    });

    it('preserves RRULE on recurring events', () => {
      const biweekly = findEvent(anonymized, UID_BIWEEKLY_FRIDAY)!;
      expect(biweekly.properties.find((p) => p.name === 'RRULE')).toBeDefined();
    });

    it('does not mutate the original component', () => {
      expect(component.properties.find((p) => p.name === 'X-WR-CALNAME')).toBeDefined();
    });
  });

  // ── merge ─────────────────────────────────────────────────────────────────

  describe('merge', () => {
    it('doubles the VEVENT count when merged with itself', () => {
      const merged = calendar.merge(component, component);
      expect(eventCount(merged)).toBe(492);
    });

    it('deduplicates VTIMEZONEs: 4 raw timezones → 2 unique after merging two copies', () => {
      const merged = calendar.merge(component, component);
      expect(timezoneCount(merged)).toBe(2);
    });

    it('takes properties from the first calendar', () => {
      const other = calendar.parse(icsContent);
      const merged = calendar.merge(component, other);
      expect(merged.properties.find((p) => p.name === 'PRODID')?.value).toBe(
        component.properties.find((p) => p.name === 'PRODID')?.value,
      );
    });
  });

  // ── cleanRange ────────────────────────────────────────────────────────────

  describe('cleanRange', () => {
    it('removes a non-recurring event that falls fully within the range', () => {
      const result = calendar.cleanRange(
        component,
        new Date('2026-02-03T09:00:00Z'),
        new Date('2026-02-03T11:00:00Z'),
      );
      expect(findEvent(result, UID_SINGLE)).toBeUndefined();
      expect(eventCount(result)).toBe(245);
    });

    it('keeps events outside the range unchanged', () => {
      const result = calendar.cleanRange(
        component,
        new Date('2026-02-03T09:00:00Z'),
        new Date('2026-02-03T11:00:00Z'),
      );
      expect(findEvent(result, UID_TZID_VALARM)).toBeDefined();
      expect(findEvent(result, UID_ALLDAY)).toBeDefined();
    });

    it('adds EXDATE for the matching occurrence of a recurring bi-weekly event', () => {
      // DTSTART;TZID=Europe/Berlin:20250110T000000 → parsed as 20250110T000000Z
      // RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=FR → first occurrence Jan 10 is in range
      const result = calendar.cleanRange(
        component,
        new Date('2025-01-10T00:00:00Z'),
        new Date('2025-01-11T00:00:00Z'),
      );
      const event = findEvent(result, UID_BIWEEKLY_FRIDAY)!;
      expect(event).toBeDefined();
      expect(event.properties.find((p) => p.name === 'RRULE')).toBeDefined();
      const exdate = event.properties.find((p) => p.name === 'EXDATE');
      expect(exdate?.value).toContain('20250110T000000Z');
    });

    it('does not mutate the original component', () => {
      calendar.cleanRange(component, new Date('2026-02-03T09:00:00Z'), new Date('2026-02-03T11:00:00Z'));
      expect(findEvent(component, UID_SINGLE)).toBeDefined();
    });
  });

  // ── cleanRanges ───────────────────────────────────────────────────────────

  describe('cleanRanges', () => {
    it('removes events in all provided ranges', () => {
      const result = calendar.cleanRanges(component, [
        [new Date('2026-02-03T09:00:00Z'), new Date('2026-02-03T11:00:00Z')],
        [new Date('2025-03-07T14:00:00Z'), new Date('2025-03-07T16:00:00Z')],
      ]);
      expect(findEvent(result, UID_SINGLE)).toBeUndefined();
      expect(findEvent(result, UID_TZID_VALARM)).toBeUndefined();
    });

    it('returns the original component unchanged when given an empty ranges array', () => {
      const result = calendar.cleanRanges(component, []);
      expect(eventCount(result)).toBe(246);
    });
  });
});
