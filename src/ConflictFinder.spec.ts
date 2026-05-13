import { ConflictFinder } from './ConflictFinder';
import { EventLister } from './EventLister';
import { ICalComponent } from './types';

const finder = new ConflictFinder();

const from = new Date('2024-01-15T00:00:00Z');
const to = new Date('2024-01-16T00:00:00Z');

function makeEvent(uid: string, dtstart: string, dtend: string): ICalComponent {
  return {
    name: 'VEVENT',
    properties: [
      { name: 'UID', params: {}, value: uid },
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

describe('ConflictFinder', () => {
  describe('no conflicts', () => {
    it('returns empty when calendar has no events', () => {
      expect(finder.find(makeCalendar(), from, to)).toHaveLength(0);
    });

    it('returns empty for a single event', () => {
      const cal = makeCalendar(makeEvent('a', '20240115T100000Z', '20240115T110000Z'));
      expect(finder.find(cal, from, to)).toHaveLength(0);
    });

    it('returns empty for two non-overlapping events', () => {
      const cal = makeCalendar(
        makeEvent('a', '20240115T090000Z', '20240115T100000Z'),
        makeEvent('b', '20240115T110000Z', '20240115T120000Z'),
      );
      expect(finder.find(cal, from, to)).toHaveLength(0);
    });

    it('returns empty for events touching at a boundary (end = start)', () => {
      const cal = makeCalendar(
        makeEvent('a', '20240115T090000Z', '20240115T100000Z'),
        makeEvent('b', '20240115T100000Z', '20240115T110000Z'),
      );
      expect(finder.find(cal, from, to)).toHaveLength(0);
    });
  });

  describe('conflicts', () => {
    it('finds a conflict between two overlapping events', () => {
      const cal = makeCalendar(
        makeEvent('a', '20240115T090000Z', '20240115T110000Z'),
        makeEvent('b', '20240115T100000Z', '20240115T120000Z'),
      );
      const conflicts = finder.find(cal, from, to);
      expect(conflicts).toHaveLength(1);
    });

    it('returns the two conflicting events in the pair', () => {
      const cal = makeCalendar(
        makeEvent('a', '20240115T090000Z', '20240115T110000Z'),
        makeEvent('b', '20240115T100000Z', '20240115T120000Z'),
      );
      const { first, second } = finder.find(cal, from, to)[0]!;
      const uids = [first, second].map((e) => e.properties.find((p) => p.name === 'UID')!.value);
      expect(uids).toContain('a');
      expect(uids).toContain('b');
    });

    it('finds a conflict when one event fully contains another', () => {
      const cal = makeCalendar(
        makeEvent('a', '20240115T090000Z', '20240115T180000Z'),
        makeEvent('b', '20240115T100000Z', '20240115T110000Z'),
      );
      expect(finder.find(cal, from, to)).toHaveLength(1);
    });

    it('finds multiple conflicts among three overlapping events', () => {
      const cal = makeCalendar(
        makeEvent('a', '20240115T090000Z', '20240115T120000Z'),
        makeEvent('b', '20240115T100000Z', '20240115T130000Z'),
        makeEvent('c', '20240115T110000Z', '20240115T140000Z'),
      );
      expect(finder.find(cal, from, to)).toHaveLength(3);
    });
  });

  describe('recurring events', () => {
    it('finds a conflict between a recurring and a non-recurring event', () => {
      const cal = makeCalendar(
        makeRecurring('standup', '20240101T100000Z', '20240101T103000Z', 'FREQ=DAILY'),
        makeEvent('meeting', '20240115T095000Z', '20240115T110000Z'),
      );
      expect(finder.find(cal, from, to).length).toBeGreaterThan(0);
    });
  });

  describe('events without parseable dates', () => {
    it('returns no conflicts when events have no DTSTART or DTEND', () => {
      const eventWithoutDates: ICalComponent = {
        name: 'VEVENT',
        properties: [{ name: 'UID', params: {}, value: 'nodates' }],
        components: [],
      };
      const mockLister = {
        list: () => [eventWithoutDates, eventWithoutDates],
      } as unknown as EventLister;
      const finderWithMock = new ConflictFinder(mockLister);
      expect(finderWithMock.find(makeCalendar(), from, to)).toHaveLength(0);
    });
  });

  describe('events outside range', () => {
    it('ignores events outside the range', () => {
      const cal = makeCalendar(
        makeEvent('a', '20240114T100000Z', '20240114T110000Z'),
        makeEvent('b', '20240114T105000Z', '20240114T115000Z'),
      );
      expect(finder.find(cal, from, to)).toHaveLength(0);
    });
  });
});
