import { RangeCleaner } from './RangeCleaner';
import { ICalComponent } from './types';

const cleaner = new RangeCleaner();

const rangeStart = new Date('2024-01-15T10:00:00Z');
const rangeEnd = new Date('2024-01-15T12:00:00Z');

function makeEvent(uid: string, dtstart: string, dtend: string): ICalComponent {
  return {
    name: 'VEVENT',
    properties: [
      { name: 'UID', params: {}, value: uid },
      { name: 'DTSTART', params: {}, value: dtstart },
      { name: 'DTEND', params: {}, value: dtend },
      { name: 'SUMMARY', params: {}, value: uid },
    ],
    components: [],
  };
}

function makeCalendar(...events: ICalComponent[]): ICalComponent {
  return { name: 'VCALENDAR', properties: [], components: events };
}

function uids(result: ICalComponent): string[] {
  return result.components
    .filter((c) => c.name === 'VEVENT')
    .map((c) => c.properties.find((p) => p.name === 'UID')!.value);
}

function dtstart(result: ICalComponent, uid: string): string {
  const event = result.components.find(
    (c) => c.properties.find((p) => p.name === 'UID')?.value === uid,
  )!;
  return event.properties.find((p) => p.name === 'DTSTART')!.value;
}

function dtend(result: ICalComponent, uid: string): string {
  const event = result.components.find(
    (c) => c.properties.find((p) => p.name === 'UID')?.value === uid,
  )!;
  return event.properties.find((p) => p.name === 'DTEND')!.value;
}

describe('RangeCleaner', () => {
  describe('no overlap', () => {
    it('keeps an event entirely before the range', () => {
      const cal = makeCalendar(makeEvent('a', '20240115T080000Z', '20240115T090000Z'));
      expect(uids(cleaner.clean(cal, rangeStart, rangeEnd))).toEqual(['a']);
    });

    it('keeps an event entirely after the range', () => {
      const cal = makeCalendar(makeEvent('a', '20240115T130000Z', '20240115T140000Z'));
      expect(uids(cleaner.clean(cal, rangeStart, rangeEnd))).toEqual(['a']);
    });

    it('keeps an event ending exactly at range start', () => {
      const cal = makeCalendar(makeEvent('a', '20240115T090000Z', '20240115T100000Z'));
      expect(uids(cleaner.clean(cal, rangeStart, rangeEnd))).toEqual(['a']);
    });

    it('keeps an event starting exactly at range end', () => {
      const cal = makeCalendar(makeEvent('a', '20240115T120000Z', '20240115T130000Z'));
      expect(uids(cleaner.clean(cal, rangeStart, rangeEnd))).toEqual(['a']);
    });
  });

  describe('fully within range', () => {
    it('removes an event fully within the range', () => {
      const cal = makeCalendar(makeEvent('a', '20240115T103000Z', '20240115T110000Z'));
      expect(uids(cleaner.clean(cal, rangeStart, rangeEnd))).toEqual([]);
    });

    it('removes an event matching the range exactly', () => {
      const cal = makeCalendar(makeEvent('a', '20240115T100000Z', '20240115T120000Z'));
      expect(uids(cleaner.clean(cal, rangeStart, rangeEnd))).toEqual([]);
    });
  });

  describe('partial overlap at start', () => {
    it('clips DTEND when event starts before range and ends within', () => {
      const cal = makeCalendar(makeEvent('a', '20240115T090000Z', '20240115T110000Z'));
      const result = cleaner.clean(cal, rangeStart, rangeEnd);
      expect(uids(result)).toEqual(['a']);
      expect(dtend(result, 'a')).toBe('20240115T100000Z');
    });
  });

  describe('partial overlap at end', () => {
    it('clips DTSTART when event starts within range and ends after', () => {
      const cal = makeCalendar(makeEvent('a', '20240115T110000Z', '20240115T130000Z'));
      const result = cleaner.clean(cal, rangeStart, rangeEnd);
      expect(uids(result)).toEqual(['a']);
      expect(dtstart(result, 'a')).toBe('20240115T120000Z');
    });
  });

  describe('spans entire range', () => {
    it('splits the event into before and after parts', () => {
      const cal = makeCalendar(makeEvent('a', '20240115T080000Z', '20240115T140000Z'));
      const result = cleaner.clean(cal, rangeStart, rangeEnd);
      expect(uids(result)).toEqual(['a', 'a-split']);
    });

    it('clips the before part to range start', () => {
      const cal = makeCalendar(makeEvent('a', '20240115T080000Z', '20240115T140000Z'));
      const result = cleaner.clean(cal, rangeStart, rangeEnd);
      expect(dtend(result, 'a')).toBe('20240115T100000Z');
    });

    it('clips the after part to range end', () => {
      const cal = makeCalendar(makeEvent('a', '20240115T080000Z', '20240115T140000Z'));
      const result = cleaner.clean(cal, rangeStart, rangeEnd);
      expect(dtstart(result, 'a-split')).toBe('20240115T120000Z');
    });
  });

  describe('non-VEVENT components', () => {
    it('leaves VTIMEZONE components untouched', () => {
      const tz: ICalComponent = {
        name: 'VTIMEZONE',
        properties: [{ name: 'TZID', params: {}, value: 'Europe/Berlin' }],
        components: [],
      };
      const result = cleaner.clean(makeCalendar(tz), rangeStart, rangeEnd);
      expect(result.components).toHaveLength(1);
      expect(result.components[0]!.name).toBe('VTIMEZONE');
    });
  });

  describe('all-day events', () => {
    it('removes an all-day event whose implied range is fully within the clean range', () => {
      const fullDayRange = { start: new Date('2024-01-15T00:00:00Z'), end: new Date('2024-01-16T00:00:00Z') };
      const cal = makeCalendar(makeEvent('a', '20240115', '20240116'));
      expect(uids(cleaner.clean(cal, fullDayRange.start, fullDayRange.end))).toEqual([]);
    });
  });

  describe('immutability', () => {
    it('does not mutate the original component', () => {
      const event = makeEvent('a', '20240115T090000Z', '20240115T110000Z');
      const cal = makeCalendar(event);
      cleaner.clean(cal, rangeStart, rangeEnd);
      expect(event.properties.find((p) => p.name === 'DTEND')!.value).toBe('20240115T110000Z');
      expect(cal.components).toHaveLength(1);
    });
  });

  describe('multiple events', () => {
    it('processes all events independently', () => {
      const cal = makeCalendar(
        makeEvent('before', '20240115T080000Z', '20240115T090000Z'),
        makeEvent('inside', '20240115T103000Z', '20240115T110000Z'),
        makeEvent('after', '20240115T130000Z', '20240115T140000Z'),
        makeEvent('clip-start', '20240115T090000Z', '20240115T110000Z'),
        makeEvent('clip-end', '20240115T110000Z', '20240115T130000Z'),
      );
      const result = cleaner.clean(cal, rangeStart, rangeEnd);
      expect(uids(result)).toEqual(['before', 'after', 'clip-start', 'clip-end']);
    });
  });

  describe('cleanRanges', () => {
    it('removes events in all provided ranges', () => {
      const cal = makeCalendar(
        makeEvent('morning', '20240115T083000Z', '20240115T090000Z'),
        makeEvent('lunch', '20240115T120000Z', '20240115T123000Z'),
        makeEvent('afternoon', '20240115T150000Z', '20240115T160000Z'),
      );
      const result = cleaner.cleanRanges(cal, [
        [new Date('2024-01-15T08:00:00Z'), new Date('2024-01-15T10:00:00Z')],
        [new Date('2024-01-15T12:00:00Z'), new Date('2024-01-15T13:00:00Z')],
      ]);
      expect(uids(result)).toEqual(['afternoon']);
    });

    it('returns the component unchanged when ranges is empty', () => {
      const cal = makeCalendar(makeEvent('a', '20240115T100000Z', '20240115T110000Z'));
      const result = cleaner.cleanRanges(cal, []);
      expect(uids(result)).toEqual(['a']);
    });

    it('applies ranges sequentially so clipped events can be removed by a later range', () => {
      // Event 09:00–11:00 gets clipped to 09:00–10:00 by first range,
      // then that 09:00–10:00 remainder is removed by the second range.
      const cal = makeCalendar(makeEvent('a', '20240115T090000Z', '20240115T110000Z'));
      const result = cleaner.cleanRanges(cal, [
        [new Date('2024-01-15T10:00:00Z'), new Date('2024-01-15T12:00:00Z')],
        [new Date('2024-01-15T08:00:00Z'), new Date('2024-01-15T10:00:00Z')],
      ]);
      expect(uids(result)).toEqual([]);
    });
  });

  describe('recurring events (RRULE)', () => {
    function makeRecurring(uid: string, dtstart: string, dtend: string, rrule: string): ICalComponent {
      return {
        name: 'VEVENT',
        properties: [
          { name: 'UID', params: {}, value: uid },
          { name: 'DTSTART', params: {}, value: dtstart },
          { name: 'DTEND', params: {}, value: dtend },
          { name: 'RRULE', params: {}, value: rrule },
          { name: 'SUMMARY', params: {}, value: uid },
        ],
        components: [],
      };
    }

    function exdates(result: ICalComponent, uid: string): string[] {
      const event = result.components.find(
        (c) => c.properties.find((p) => p.name === 'UID')?.value === uid,
      );
      const prop = event?.properties.find((p) => p.name === 'EXDATE');
      return prop ? prop.value.split(',') : [];
    }

    it('adds EXDATE for an occurrence fully within the range', () => {
      // Daily standup at 11:00; one occurrence on Jan 15 falls in 10:00–12:00
      const cal = makeCalendar(makeRecurring('standup', '20240101T110000Z', '20240101T113000Z', 'FREQ=DAILY'));
      const result = cleaner.clean(cal, rangeStart, rangeEnd);
      expect(exdates(result, 'standup')).toContain('20240115T110000Z');
    });

    it('keeps the base VEVENT with RRULE intact (series continues outside range)', () => {
      const cal = makeCalendar(makeRecurring('standup', '20240101T110000Z', '20240101T113000Z', 'FREQ=DAILY'));
      const result = cleaner.clean(cal, rangeStart, rangeEnd);
      const base = result.components.find((c) => c.properties.find((p) => p.name === 'UID')?.value === 'standup');
      expect(base?.properties.find((p) => p.name === 'RRULE')).toBeDefined();
    });

    it('does not add EXDATE for occurrences outside the range', () => {
      // Occurrence on Jan 14 and Jan 16 are outside the Jan 15 10:00–12:00 range
      const cal = makeCalendar(makeRecurring('standup', '20240101T080000Z', '20240101T083000Z', 'FREQ=DAILY'));
      const result = cleaner.clean(cal, rangeStart, rangeEnd);
      expect(exdates(result, 'standup')).toHaveLength(0);
    });

    it('clips occurrence that starts before range and ends within — adds EXDATE + exception', () => {
      // Occurrence on Jan 15: 09:00–11:00, range is 10:00–12:00
      const cal = makeCalendar(makeRecurring('meeting', '20240101T090000Z', '20240101T110000Z', 'FREQ=WEEKLY;BYDAY=MO'));
      const result = cleaner.clean(cal, rangeStart, rangeEnd);
      expect(exdates(result, 'meeting')).toContain('20240115T090000Z');
      // Exception event ends at rangeStart
      const exception = result.components.find(
        (c) => c.properties.find((p) => p.name === 'DTEND')?.value === '20240115T100000Z',
      );
      expect(exception).toBeDefined();
      expect(exception?.properties.find((p) => p.name === 'RRULE')).toBeUndefined();
    });

    it('clips occurrence that starts within range and ends after — adds EXDATE + exception', () => {
      // Occurrence on Jan 15: 11:00–13:00, range is 10:00–12:00
      const cal = makeCalendar(makeRecurring('meeting', '20240101T110000Z', '20240101T130000Z', 'FREQ=WEEKLY;BYDAY=MO'));
      const result = cleaner.clean(cal, rangeStart, rangeEnd);
      expect(exdates(result, 'meeting')).toContain('20240115T110000Z');
      const exception = result.components.find(
        (c) => c.properties.find((p) => p.name === 'DTSTART')?.value === '20240115T120000Z',
      );
      expect(exception).toBeDefined();
    });

    it('splits occurrence spanning entire range — adds EXDATE + two exceptions', () => {
      // Occurrence on Jan 15: 08:00–14:00, range is 10:00–12:00
      const cal = makeCalendar(makeRecurring('block', '20240101T080000Z', '20240101T140000Z', 'FREQ=WEEKLY;BYDAY=MO'));
      const result = cleaner.clean(cal, rangeStart, rangeEnd);
      expect(exdates(result, 'block')).toContain('20240115T080000Z');
      const before = result.components.find(
        (c) => c.properties.find((p) => p.name === 'DTEND')?.value === '20240115T100000Z',
      );
      const after = result.components.find(
        (c) => c.properties.find((p) => p.name === 'DTSTART')?.value === '20240115T120000Z',
      );
      expect(before).toBeDefined();
      expect(after).toBeDefined();
    });

    it('handles multiple occurrences in range', () => {
      // Daily event 11:00–11:30, range spans Jan 13–17
      const bigRange = { start: new Date('2024-01-13T00:00:00Z'), end: new Date('2024-01-17T23:59:59Z') };
      const cal = makeCalendar(makeRecurring('daily', '20240101T110000Z', '20240101T113000Z', 'FREQ=DAILY'));
      const result = cleaner.clean(cal, bigRange.start, bigRange.end);
      expect(exdates(result, 'daily')).toHaveLength(5);
    });

    it('falls back to non-recurring logic for unsupported RRULE FREQ', () => {
      const event: ICalComponent = {
        name: 'VEVENT',
        properties: [
          { name: 'UID', params: {}, value: 'hourly' },
          { name: 'DTSTART', params: {}, value: '20240115T110000Z' },
          { name: 'DTEND', params: {}, value: '20240115T113000Z' },
          { name: 'RRULE', params: {}, value: 'FREQ=HOURLY' },
        ],
        components: [],
      };
      const cal = makeCalendar(event);
      // Hourly is unsupported → falls back to non-recurring → occurrence at 11:00 is within range → removed
      const result = cleaner.clean(cal, rangeStart, rangeEnd);
      expect(uids(result)).toEqual([]);
    });
  });
});
