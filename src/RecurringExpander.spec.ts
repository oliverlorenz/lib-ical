import { RecurringExpander } from './RecurringExpander';
import { ICalComponent } from './types';

const expander = new RecurringExpander();

const from = new Date('2024-01-01T00:00:00Z');
const to = new Date('2024-01-31T23:59:59Z');

function makeEvent(uid: string, dtstart: string, dtend: string): ICalComponent {
  return {
    name: 'VEVENT',
    properties: [
      { name: 'UID', params: {}, value: uid },
      { name: 'SUMMARY', params: {}, value: uid },
      { name: 'DTSTART', params: {}, value: dtstart },
      { name: 'DTEND', params: {}, value: dtend },
    ],
    components: [],
  };
}

function makeRecurring(uid: string, dtstart: string, dtend: string, rrule: string): ICalComponent {
  return {
    name: 'VEVENT',
    properties: [
      { name: 'UID', params: {}, value: uid },
      { name: 'SUMMARY', params: {}, value: uid },
      { name: 'DTSTART', params: {}, value: dtstart },
      { name: 'DTEND', params: {}, value: dtend },
      { name: 'RRULE', params: {}, value: rrule },
    ],
    components: [],
  };
}

function makeCalendar(...events: ICalComponent[]): ICalComponent {
  return { name: 'VCALENDAR', properties: [], components: events };
}

function vevents(result: ICalComponent): ICalComponent[] {
  return result.components.filter((c) => c.name === 'VEVENT');
}

function prop(event: ICalComponent, name: string): string | undefined {
  return event.properties.find((p) => p.name === name)?.value;
}

describe('RecurringExpander', () => {
  describe('non-recurring events', () => {
    it('passes non-recurring events through unchanged', () => {
      const cal = makeCalendar(makeEvent('a', '20240110T090000Z', '20240110T100000Z'));
      const result = expander.expand(cal, from, to);
      expect(vevents(result)).toHaveLength(1);
      expect(prop(vevents(result)[0]!, 'UID')).toBe('a');
      expect(prop(vevents(result)[0]!, 'RRULE')).toBeUndefined();
    });

    it('keeps non-recurring events outside the range', () => {
      const cal = makeCalendar(makeEvent('outside', '20230601T090000Z', '20230601T100000Z'));
      const result = expander.expand(cal, from, to);
      expect(vevents(result)).toHaveLength(1);
    });
  });

  describe('recurring events', () => {
    it('replaces a weekly event with concrete occurrences in range', () => {
      // Every Monday in January 2024: Jan 1, 8, 15, 22, 29
      const cal = makeCalendar(
        makeRecurring('weekly', '20240101T090000Z', '20240101T100000Z', 'FREQ=WEEKLY;BYDAY=MO'),
      );
      const result = expander.expand(cal, from, to);
      expect(vevents(result)).toHaveLength(5);
    });

    it('removes RRULE from expanded occurrences', () => {
      const cal = makeCalendar(
        makeRecurring('daily', '20240101T090000Z', '20240101T093000Z', 'FREQ=DAILY'),
      );
      const result = expander.expand(cal, from, to);
      vevents(result).forEach((e) => expect(prop(e, 'RRULE')).toBeUndefined());
    });

    it('sets concrete DTSTART on each occurrence', () => {
      const cal = makeCalendar(
        makeRecurring('weekly', '20240101T090000Z', '20240101T100000Z', 'FREQ=WEEKLY;BYDAY=MO'),
      );
      const starts = vevents(expander.expand(cal, from, to)).map((e) => prop(e, 'DTSTART'));
      expect(starts).toContain('20240101T090000Z');
      expect(starts).toContain('20240108T090000Z');
      expect(starts).toContain('20240115T090000Z');
    });

    it('adds RECURRENCE-ID to each occurrence', () => {
      const cal = makeCalendar(
        makeRecurring('daily', '20240101T090000Z', '20240101T093000Z', 'FREQ=DAILY'),
      );
      const result = vevents(expander.expand(cal, from, to));
      result.forEach((e) => expect(prop(e, 'RECURRENCE-ID')).toBeDefined());
    });

    it('respects EXDATE — excludes the matching occurrence', () => {
      const event: ICalComponent = {
        name: 'VEVENT',
        properties: [
          { name: 'UID', params: {}, value: 'daily' },
          { name: 'DTSTART', params: {}, value: '20240101T090000Z' },
          { name: 'DTEND', params: {}, value: '20240101T093000Z' },
          { name: 'RRULE', params: {}, value: 'FREQ=DAILY' },
          { name: 'EXDATE', params: {}, value: '20240102T090000Z' },
        ],
        components: [],
      };
      const result = vevents(expander.expand(makeCalendar(event), from, to));
      const starts = result.map((e) => prop(e, 'DTSTART'));
      expect(starts).not.toContain('20240102T090000Z');
    });

    it('produces no occurrences for a recurring event with no matches in range', () => {
      // Starts in 2025, range is January 2024
      const cal = makeCalendar(
        makeRecurring('future', '20250101T090000Z', '20250101T100000Z', 'FREQ=DAILY'),
      );
      expect(vevents(expander.expand(cal, from, to))).toHaveLength(0);
    });
  });

  describe('mixed calendar', () => {
    it('keeps non-recurring events and expands recurring ones side by side', () => {
      const cal = makeCalendar(
        makeEvent('single', '20240115T100000Z', '20240115T110000Z'),
        makeRecurring('weekly', '20240101T090000Z', '20240101T100000Z', 'FREQ=WEEKLY;BYDAY=MO'),
      );
      const result = expander.expand(cal, from, to);
      const events = vevents(result);
      expect(events.some((e) => prop(e, 'UID') === 'single')).toBe(true);
      expect(events.filter((e) => prop(e, 'UID') === 'weekly')).toHaveLength(5);
    });
  });

  describe('non-VEVENT components', () => {
    it('preserves VTIMEZONE components', () => {
      const tz: ICalComponent = {
        name: 'VTIMEZONE',
        properties: [{ name: 'TZID', params: {}, value: 'Europe/Berlin' }],
        components: [],
      };
      const result = expander.expand(makeCalendar(tz), from, to);
      expect(result.components.find((c) => c.name === 'VTIMEZONE')).toBeDefined();
    });
  });

  describe('immutability', () => {
    it('does not mutate the original component', () => {
      const event = makeRecurring('daily', '20240101T090000Z', '20240101T093000Z', 'FREQ=DAILY');
      const cal = makeCalendar(event);
      expander.expand(cal, from, to);
      expect(cal.components).toHaveLength(1);
      expect(prop(cal.components[0]!, 'RRULE')).toBe('FREQ=DAILY');
    });
  });
});
