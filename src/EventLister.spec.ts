import { EventLister } from './EventLister';
import { ICalComponent } from './types';

const lister = new EventLister();

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

function uids(events: ICalComponent[]): string[] {
  return events.map((e) => e.properties.find((p) => p.name === 'UID')!.value);
}

function dtstart(event: ICalComponent): string {
  return event.properties.find((p) => p.name === 'DTSTART')!.value;
}

const from = new Date('2024-01-15T00:00:00Z');
const to = new Date('2024-01-16T00:00:00Z');

describe('EventLister', () => {
  describe('non-recurring events', () => {
    it('includes an event fully within the range', () => {
      const cal = makeCalendar(makeEvent('a', '20240115T100000Z', '20240115T110000Z'));
      expect(uids(lister.list(cal, from, to))).toEqual(['a']);
    });

    it('excludes an event entirely before the range', () => {
      const cal = makeCalendar(makeEvent('a', '20240114T100000Z', '20240114T110000Z'));
      expect(lister.list(cal, from, to)).toHaveLength(0);
    });

    it('excludes an event entirely after the range', () => {
      const cal = makeCalendar(makeEvent('a', '20240116T100000Z', '20240116T110000Z'));
      expect(lister.list(cal, from, to)).toHaveLength(0);
    });

    it('includes an event that starts before and ends within the range', () => {
      const cal = makeCalendar(makeEvent('a', '20240114T230000Z', '20240115T010000Z'));
      expect(uids(lister.list(cal, from, to))).toEqual(['a']);
    });

    it('includes an event that starts within and ends after the range', () => {
      const cal = makeCalendar(makeEvent('a', '20240115T230000Z', '20240116T010000Z'));
      expect(uids(lister.list(cal, from, to))).toEqual(['a']);
    });

    it('excludes an event ending exactly at range start', () => {
      const cal = makeCalendar(makeEvent('a', '20240114T230000Z', '20240115T000000Z'));
      expect(lister.list(cal, from, to)).toHaveLength(0);
    });

    it('excludes an event starting exactly at range end', () => {
      const cal = makeCalendar(makeEvent('a', '20240116T000000Z', '20240116T010000Z'));
      expect(lister.list(cal, from, to)).toHaveLength(0);
    });

    it('includes an all-day event matching the range', () => {
      const cal = makeCalendar(makeEvent('a', '20240115', '20240116'));
      expect(uids(lister.list(cal, from, to))).toEqual(['a']);
    });
  });

  describe('recurring events', () => {
    it('returns one occurrence per matching day for a daily event', () => {
      const bigRange = {
        from: new Date('2024-01-13T00:00:00Z'),
        to: new Date('2024-01-18T00:00:00Z'),
      };
      const cal = makeCalendar(
        makeRecurring('daily', '20240101T090000Z', '20240101T093000Z', 'FREQ=DAILY'),
      );
      const results = lister.list(cal, bigRange.from, bigRange.to);
      expect(results).toHaveLength(5);
    });

    it('sets concrete DTSTART on each occurrence', () => {
      const cal = makeCalendar(
        makeRecurring('daily', '20240101T090000Z', '20240101T093000Z', 'FREQ=DAILY'),
      );
      const results = lister.list(cal, from, to);
      expect(results).toHaveLength(1);
      expect(dtstart(results[0]!)).toBe('20240115T090000Z');
    });

    it('adds RECURRENCE-ID to each occurrence', () => {
      const cal = makeCalendar(
        makeRecurring('daily', '20240101T090000Z', '20240101T093000Z', 'FREQ=DAILY'),
      );
      const results = lister.list(cal, from, to);
      const recurrenceId = results[0]!.properties.find((p) => p.name === 'RECURRENCE-ID');
      expect(recurrenceId?.value).toBe('20240115T090000Z');
    });

    it('strips RRULE from each occurrence', () => {
      const cal = makeCalendar(
        makeRecurring('daily', '20240101T090000Z', '20240101T093000Z', 'FREQ=DAILY'),
      );
      const results = lister.list(cal, from, to);
      expect(results[0]!.properties.find((p) => p.name === 'RRULE')).toBeUndefined();
    });

    it('respects EXDATE — excludes matching occurrence', () => {
      const event: ICalComponent = {
        name: 'VEVENT',
        properties: [
          { name: 'UID', params: {}, value: 'daily' },
          { name: 'DTSTART', params: {}, value: '20240101T090000Z' },
          { name: 'DTEND', params: {}, value: '20240101T093000Z' },
          { name: 'RRULE', params: {}, value: 'FREQ=DAILY' },
          { name: 'EXDATE', params: {}, value: '20240115T090000Z' },
        ],
        components: [],
      };
      const results = lister.list(makeCalendar(event), from, to);
      expect(results).toHaveLength(0);
    });

    it('includes a weekly recurring event on the matching weekday', () => {
      // Mondays, Jan 15 2024 is a Monday
      const cal = makeCalendar(
        makeRecurring('weekly', '20240101T090000Z', '20240101T100000Z', 'FREQ=WEEKLY;BYDAY=MO'),
      );
      const results = lister.list(cal, from, to);
      expect(results).toHaveLength(1);
      expect(dtstart(results[0]!)).toBe('20240115T090000Z');
    });

    it('includes a yearly event when its anniversary falls in range', () => {
      const yearRange = {
        from: new Date('2024-01-01T00:00:00Z'),
        to: new Date('2025-01-01T00:00:00Z'),
      };
      const cal = makeCalendar(
        makeRecurring('yearly', '20200115T120000Z', '20200115T130000Z', 'FREQ=YEARLY'),
      );
      const results = lister.list(cal, yearRange.from, yearRange.to);
      expect(results).toHaveLength(1);
      expect(dtstart(results[0]!)).toBe('20240115T120000Z');
    });

    it('includes a recurring occurrence that starts before range and ends within', () => {
      // Event: 23:00–01:00, daily. Jan 14 23:00 overlaps with Jan 15 range.
      const cal = makeCalendar(
        makeRecurring('overnight', '20240101T230000Z', '20240102T010000Z', 'FREQ=DAILY'),
      );
      const results = lister.list(cal, from, to);
      const starts = results.map(dtstart);
      expect(starts).toContain('20240114T230000Z');
    });
  });

  describe('mixed calendar', () => {
    it('returns both non-recurring and recurring events in range', () => {
      const cal = makeCalendar(
        makeEvent('single', '20240115T100000Z', '20240115T110000Z'),
        makeRecurring('daily', '20240101T140000Z', '20240101T150000Z', 'FREQ=DAILY'),
        makeEvent('outside', '20240120T100000Z', '20240120T110000Z'),
      );
      const results = lister.list(cal, from, to);
      expect(uids(results)).toContain('single');
      expect(uids(results)).toContain('daily');
      expect(uids(results)).not.toContain('outside');
    });
  });

  describe('events with missing or unparseable dates', () => {
    it('skips a non-recurring event with no DTSTART property', () => {
      const event: ICalComponent = {
        name: 'VEVENT',
        properties: [{ name: 'UID', params: {}, value: 'nodtstart' }],
        components: [],
      };
      expect(lister.list(makeCalendar(event), from, to)).toHaveLength(0);
    });

    it('skips a non-recurring event with unparseable DTSTART', () => {
      const event: ICalComponent = {
        name: 'VEVENT',
        properties: [
          { name: 'UID', params: {}, value: 'badstart' },
          { name: 'DTSTART', params: {}, value: 'not-a-date' },
          { name: 'DTEND', params: {}, value: '20240115T110000Z' },
        ],
        components: [],
      };
      expect(lister.list(makeCalendar(event), from, to)).toHaveLength(0);
    });

    it('skips a non-recurring event with unparseable DTEND', () => {
      const event: ICalComponent = {
        name: 'VEVENT',
        properties: [
          { name: 'UID', params: {}, value: 'badend' },
          { name: 'DTSTART', params: {}, value: '20240115T100000Z' },
          { name: 'DTEND', params: {}, value: 'not-a-date' },
        ],
        components: [],
      };
      expect(lister.list(makeCalendar(event), from, to)).toHaveLength(0);
    });

    it('includes a non-recurring all-day event with no DTEND (implied 1-day duration)', () => {
      const event: ICalComponent = {
        name: 'VEVENT',
        properties: [
          { name: 'UID', params: {}, value: 'allday-nodtend' },
          { name: 'DTSTART', params: {}, value: '20240115' },
        ],
        components: [],
      };
      expect(lister.list(makeCalendar(event), from, to)).toHaveLength(1);
    });

    it('includes a non-recurring datetime event with no DTEND (implied 0 duration)', () => {
      const event: ICalComponent = {
        name: 'VEVENT',
        properties: [
          { name: 'UID', params: {}, value: 'nodtend' },
          { name: 'DTSTART', params: {}, value: '20240115T100000Z' },
        ],
        components: [],
      };
      expect(lister.list(makeCalendar(event), from, to)).toHaveLength(1);
    });

    it('skips a recurring event with no DTSTART property', () => {
      const event: ICalComponent = {
        name: 'VEVENT',
        properties: [
          { name: 'UID', params: {}, value: 'recurring-nodtstart' },
          { name: 'RRULE', params: {}, value: 'FREQ=DAILY' },
        ],
        components: [],
      };
      expect(lister.list(makeCalendar(event), from, to)).toHaveLength(0);
    });

    it('skips a recurring event with unparseable DTSTART', () => {
      const event: ICalComponent = {
        name: 'VEVENT',
        properties: [
          { name: 'UID', params: {}, value: 'recurring-badstart' },
          { name: 'DTSTART', params: {}, value: 'invalid' },
          { name: 'DTEND', params: {}, value: '20240101T093000Z' },
          { name: 'RRULE', params: {}, value: 'FREQ=DAILY' },
        ],
        components: [],
      };
      expect(lister.list(makeCalendar(event), from, to)).toHaveLength(0);
    });

    it('expands a recurring event without DTEND as 0-duration occurrences', () => {
      const event: ICalComponent = {
        name: 'VEVENT',
        properties: [
          { name: 'UID', params: {}, value: 'recurring-nodtend' },
          { name: 'DTSTART', params: {}, value: '20240101T100000Z' },
          { name: 'RRULE', params: {}, value: 'FREQ=DAILY' },
        ],
        components: [],
      };
      const results = lister.list(makeCalendar(event), from, to);
      expect(results).toHaveLength(1);
    });

    it('expands a recurring all-day event without DTEND as 1-day occurrences', () => {
      const event: ICalComponent = {
        name: 'VEVENT',
        properties: [
          { name: 'UID', params: {}, value: 'recurring-allday-nodtend' },
          { name: 'DTSTART', params: {}, value: '20240101' },
          { name: 'RRULE', params: {}, value: 'FREQ=DAILY' },
        ],
        components: [],
      };
      const results = lister.list(makeCalendar(event), from, to);
      expect(results).toHaveLength(1);
    });
  });

  describe('unsupported RRULE fallback', () => {
    it('falls back to non-recurring logic for an unsupported RRULE FREQ', () => {
      const event: ICalComponent = {
        name: 'VEVENT',
        properties: [
          { name: 'UID', params: {}, value: 'hourly' },
          { name: 'DTSTART', params: {}, value: '20240115T100000Z' },
          { name: 'DTEND', params: {}, value: '20240115T110000Z' },
          { name: 'RRULE', params: {}, value: 'FREQ=HOURLY' },
        ],
        components: [],
      };
      const results = lister.list(makeCalendar(event), from, to);
      expect(results).toHaveLength(1);
    });
  });

  describe('non-VEVENT components', () => {
    it('ignores VTIMEZONE components', () => {
      const tz: ICalComponent = {
        name: 'VTIMEZONE',
        properties: [{ name: 'TZID', params: {}, value: 'Europe/Berlin' }],
        components: [],
      };
      const cal = makeCalendar(tz, makeEvent('a', '20240115T100000Z', '20240115T110000Z'));
      expect(uids(lister.list(cal, from, to))).toEqual(['a']);
    });
  });
});
