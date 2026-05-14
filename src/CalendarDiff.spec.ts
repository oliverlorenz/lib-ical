import { CalendarDiff } from './CalendarDiff';
import { ICalComponent } from './types';

const differ = new CalendarDiff();

function makeEvent(uid: string, summary: string, dtstart = '20240115T100000Z'): ICalComponent {
  return {
    name: 'VEVENT',
    properties: [
      { name: 'UID', params: {}, value: uid },
      { name: 'SUMMARY', params: {}, value: summary },
      { name: 'DTSTART', params: {}, value: dtstart },
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

describe('CalendarDiff', () => {
  describe('identical calendars', () => {
    it('returns empty arrays when calendars are identical', () => {
      const cal = makeCalendar(makeEvent('a', 'Meeting'));
      const result = differ.diff(cal, cal);
      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(result.changed).toHaveLength(0);
    });
  });

  describe('added events', () => {
    it('detects an event present in after but not in before', () => {
      const before = makeCalendar(makeEvent('a', 'Meeting'));
      const after = makeCalendar(makeEvent('a', 'Meeting'), makeEvent('b', 'Dentist'));
      const result = differ.diff(before, after);
      expect(uids(result.added)).toEqual(['b']);
      expect(result.removed).toHaveLength(0);
    });
  });

  describe('removed events', () => {
    it('detects an event present in before but not in after', () => {
      const before = makeCalendar(makeEvent('a', 'Meeting'), makeEvent('b', 'Dentist'));
      const after = makeCalendar(makeEvent('a', 'Meeting'));
      const result = differ.diff(before, after);
      expect(uids(result.removed)).toEqual(['b']);
      expect(result.added).toHaveLength(0);
    });
  });

  describe('changed events', () => {
    it('detects a changed SUMMARY', () => {
      const before = makeCalendar(makeEvent('a', 'Old Title'));
      const after = makeCalendar(makeEvent('a', 'New Title'));
      const result = differ.diff(before, after);
      expect(uids(result.changed)).toEqual(['a']);
      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
    });

    it('detects a changed DTSTART', () => {
      const before = makeCalendar(makeEvent('a', 'Meeting', '20240115T100000Z'));
      const after = makeCalendar(makeEvent('a', 'Meeting', '20240115T110000Z'));
      const result = differ.diff(before, after);
      expect(uids(result.changed)).toEqual(['a']);
    });

    it('reports the after version in changed', () => {
      const before = makeCalendar(makeEvent('a', 'Old Title'));
      const after = makeCalendar(makeEvent('a', 'New Title'));
      const changed = differ.diff(before, after).changed[0]!;
      expect(changed.properties.find((p) => p.name === 'SUMMARY')?.value).toBe('New Title');
    });
  });

  describe('combined changes', () => {
    it('correctly identifies added, removed and changed in one call', () => {
      const before = makeCalendar(
        makeEvent('keep', 'Keep'),
        makeEvent('change', 'Old'),
        makeEvent('remove', 'Gone'),
      );
      const after = makeCalendar(
        makeEvent('keep', 'Keep'),
        makeEvent('change', 'New'),
        makeEvent('add', 'Fresh'),
      );
      const result = differ.diff(before, after);
      expect(uids(result.added)).toEqual(['add']);
      expect(uids(result.removed)).toEqual(['remove']);
      expect(uids(result.changed)).toEqual(['change']);
    });
  });

  describe('recurring exception events (RECURRENCE-ID)', () => {
    it('treats base event and exception as separate entries', () => {
      const base: ICalComponent = {
        name: 'VEVENT',
        properties: [
          { name: 'UID', params: {}, value: 'series' },
          { name: 'SUMMARY', params: {}, value: 'Series' },
          { name: 'RRULE', params: {}, value: 'FREQ=DAILY' },
        ],
        components: [],
      };
      const exception: ICalComponent = {
        name: 'VEVENT',
        properties: [
          { name: 'UID', params: {}, value: 'series' },
          { name: 'SUMMARY', params: {}, value: 'Exception' },
          { name: 'RECURRENCE-ID', params: {}, value: '20240115T090000Z' },
        ],
        components: [],
      };
      const before = makeCalendar(base);
      const after = makeCalendar(base, exception);
      const result = differ.diff(before, after);
      expect(result.added).toHaveLength(1);
    });
  });

  describe('VEVENT without UID', () => {
    it('silently ignores a VEVENT that has no UID property', () => {
      const noUid: ICalComponent = {
        name: 'VEVENT',
        properties: [{ name: 'SUMMARY', params: {}, value: 'No UID' }],
        components: [],
      };
      const cal = makeCalendar(noUid);
      const result = differ.diff(cal, cal);
      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(result.changed).toHaveLength(0);
    });
  });

  describe('events with differing property counts', () => {
    it('reports as changed when after event has more properties than before', () => {
      const before = makeCalendar({
        name: 'VEVENT',
        properties: [
          { name: 'UID', params: {}, value: 'a' },
          { name: 'SUMMARY', params: {}, value: 'Meeting' },
        ],
        components: [],
      });
      const after = makeCalendar(makeEvent('a', 'Meeting'));
      const result = differ.diff(before, after);
      expect(result.changed).toHaveLength(1);
    });
  });

  describe('non-VEVENT components', () => {
    it('ignores VTIMEZONE components', () => {
      const tz: ICalComponent = {
        name: 'VTIMEZONE',
        properties: [{ name: 'TZID', params: {}, value: 'Europe/Berlin' }],
        components: [],
      };
      const cal = makeCalendar(tz);
      const result = differ.diff(cal, cal);
      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
    });
  });
});
