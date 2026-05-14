import { EventFilter } from './EventFilter';
import { ICalComponent } from './types';

const filter = new EventFilter();

function makeEvent(uid: string, summary: string, location = ''): ICalComponent {
  const props = [
    { name: 'UID', params: {}, value: uid },
    { name: 'SUMMARY', params: {}, value: summary },
  ];
  if (location) props.push({ name: 'LOCATION', params: {}, value: location });
  return { name: 'VEVENT', properties: props, components: [] };
}

function makeCalendar(...events: ICalComponent[]): ICalComponent {
  return { name: 'VCALENDAR', properties: [], components: events };
}

function uids(result: ICalComponent): string[] {
  return result.components
    .filter((c) => c.name === 'VEVENT')
    .map((c) => c.properties.find((p) => p.name === 'UID')!.value);
}

describe('EventFilter', () => {
  describe('no criteria', () => {
    it('returns the component unchanged when no criteria are given', () => {
      const cal = makeCalendar(makeEvent('a', 'Meeting'), makeEvent('b', 'Birthday'));
      expect(uids(filter.filter(cal, []))).toEqual(['a', 'b']);
    });
  });

  describe('with property specified', () => {
    it('removes events whose SUMMARY matches', () => {
      const cal = makeCalendar(makeEvent('a', 'Team Meeting'), makeEvent('b', 'Birthday'));
      expect(uids(filter.filter(cal, [{ property: 'SUMMARY', pattern: /meeting/i }]))).toEqual([
        'b',
      ]);
    });

    it('does not remove events where a different property matches but not the specified one', () => {
      // LOCATION matches but we only check SUMMARY
      const cal = makeCalendar(makeEvent('a', 'Appointment', 'Berlin HQ'), makeEvent('b', 'Call'));
      expect(uids(filter.filter(cal, [{ property: 'SUMMARY', pattern: /Berlin/ }]))).toEqual([
        'a',
        'b',
      ]);
    });

    it('removes events whose LOCATION matches', () => {
      const cal = makeCalendar(
        makeEvent('a', 'Appointment', 'Berlin HQ'),
        makeEvent('b', 'Remote Call'),
      );
      expect(uids(filter.filter(cal, [{ property: 'LOCATION', pattern: /Berlin/ }]))).toEqual([
        'b',
      ]);
    });

    it('removes events matching any of multiple criteria', () => {
      const cal = makeCalendar(
        makeEvent('a', 'Team Meeting'),
        makeEvent('b', 'Birthday Party', 'Park'),
        makeEvent('c', 'Dentist'),
      );
      const result = filter.filter(cal, [
        { property: 'SUMMARY', pattern: /meeting/i },
        { property: 'LOCATION', pattern: /Park/ },
      ]);
      expect(uids(result)).toEqual(['c']);
    });
  });

  describe('without property (matches all values)', () => {
    it('removes an event when any property value matches', () => {
      const cal = makeCalendar(
        makeEvent('dead-beef', 'Some Event'),
        makeEvent('cafe-1234', 'Other'),
      );
      expect(uids(filter.filter(cal, [{ pattern: /dead-beef/ }]))).toEqual(['cafe-1234']);
    });

    it('removes events matching SUMMARY or LOCATION indiscriminately', () => {
      const cal = makeCalendar(
        makeEvent('a', 'Berlin Summit', ''),
        makeEvent('b', 'Call', 'Berlin Office'),
        makeEvent('c', 'Dentist', 'Munich'),
      );
      expect(uids(filter.filter(cal, [{ pattern: /Berlin/ }]))).toEqual(['c']);
    });
  });

  describe('non-VEVENT components', () => {
    it('leaves VTIMEZONE components untouched', () => {
      const tz: ICalComponent = {
        name: 'VTIMEZONE',
        properties: [{ name: 'TZID', params: {}, value: 'Europe/Berlin' }],
        components: [],
      };
      const result = filter.filter(makeCalendar(tz, makeEvent('a', 'Meeting')), [
        { property: 'SUMMARY', pattern: /Meeting/ },
      ]);
      expect(result.components).toHaveLength(1);
      expect(result.components[0]!.name).toBe('VTIMEZONE');
    });
  });

  describe('immutability', () => {
    it('does not mutate the original component', () => {
      const cal = makeCalendar(makeEvent('a', 'Meeting'));
      filter.filter(cal, [{ property: 'SUMMARY', pattern: /Meeting/ }]);
      expect(cal.components).toHaveLength(1);
    });
  });

  describe('keep', () => {
    it('returns the component unchanged when no criteria are given', () => {
      const cal = makeCalendar(makeEvent('a', 'Meeting'), makeEvent('b', 'Birthday'));
      expect(uids(filter.keep(cal, []))).toEqual(['a', 'b']);
    });

    it('keeps only events whose SUMMARY matches', () => {
      const cal = makeCalendar(makeEvent('a', 'Team Meeting'), makeEvent('b', 'Birthday'));
      expect(uids(filter.keep(cal, [{ property: 'SUMMARY', pattern: /meeting/i }]))).toEqual(['a']);
    });

    it('keeps events matching any of multiple criteria', () => {
      const cal = makeCalendar(
        makeEvent('a', 'Team Meeting'),
        makeEvent('b', 'Birthday Party', 'Park'),
        makeEvent('c', 'Dentist'),
      );
      const result = filter.keep(cal, [
        { property: 'SUMMARY', pattern: /meeting/i },
        { property: 'LOCATION', pattern: /Park/ },
      ]);
      expect(uids(result)).toEqual(['a', 'b']);
    });

    it('preserves non-VEVENT components regardless of criteria', () => {
      const tz: ICalComponent = {
        name: 'VTIMEZONE',
        properties: [{ name: 'TZID', params: {}, value: 'Europe/Berlin' }],
        components: [],
      };
      const result = filter.keep(
        makeCalendar(tz, makeEvent('a', 'Meeting'), makeEvent('b', 'Dentist')),
        [{ property: 'SUMMARY', pattern: /Meeting/ }],
      );
      expect(result.components.find((c) => c.name === 'VTIMEZONE')).toBeDefined();
      expect(uids(result)).toEqual(['a']);
    });

    it('is the inverse of filter for the same criteria', () => {
      const cal = makeCalendar(
        makeEvent('a', 'Meeting'),
        makeEvent('b', 'Birthday'),
        makeEvent('c', 'Dentist'),
      );
      const criteria = [{ property: 'SUMMARY', pattern: /meeting/i }];
      const filtered = uids(filter.filter(cal, criteria));
      const kept = uids(filter.keep(cal, criteria));
      expect(new Set([...filtered, ...kept])).toEqual(new Set(['a', 'b', 'c']));
      expect(filtered).not.toEqual(expect.arrayContaining(kept));
    });
  });
});
