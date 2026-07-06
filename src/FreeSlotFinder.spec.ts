import { FreeSlotFinder } from './FreeSlotFinder';
import { CalendarInverter } from './CalendarInverter';
import { ICalComponent } from './types';

const finder = new FreeSlotFinder();

const from = new Date('2024-01-15T08:00:00Z');
const to = new Date('2024-01-15T18:00:00Z');

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

function makeCalendar(...events: ICalComponent[]): ICalComponent {
  return { name: 'VCALENDAR', properties: [], components: events };
}

function slotDurationMs(slot: ICalComponent): number {
  const start = new Date(
    slot.properties
      .find((p) => p.name === 'DTSTART')!
      .value.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z'),
  );
  const end = new Date(
    slot.properties
      .find((p) => p.name === 'DTEND')!
      .value.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z'),
  );
  return end.getTime() - start.getTime();
}

const HOUR = 60 * 60 * 1000;

describe('FreeSlotFinder', () => {
  describe('without minDuration', () => {
    it('returns one slot spanning the full range when calendar is empty', () => {
      const slots = finder.find(makeCalendar(), from, to);
      expect(slots).toHaveLength(1);
      expect(slotDurationMs(slots[0]!)).toBe(10 * HOUR);
    });

    it('returns two slots around a single event', () => {
      const cal = makeCalendar(makeEvent('a', '20240115T100000Z', '20240115T110000Z'));
      expect(finder.find(cal, from, to)).toHaveLength(2);
    });

    it('returns no slots when an event covers the entire range', () => {
      const cal = makeCalendar(makeEvent('a', '20240115T080000Z', '20240115T180000Z'));
      expect(finder.find(cal, from, to)).toHaveLength(0);
    });
  });

  describe('with minDurationMs', () => {
    it('keeps slots at least as long as minDurationMs', () => {
      // Two events leave gaps of 2h and 7h
      const cal = makeCalendar(
        makeEvent('a', '20240115T100000Z', '20240115T110000Z'), // gap before: 2h, after: 7h
      );
      const slots = finder.find(cal, from, to, 3 * HOUR);
      expect(slots).toHaveLength(1);
      expect(slotDurationMs(slots[0]!)).toBe(7 * HOUR);
    });

    it('returns no slots when all free gaps are shorter than minDurationMs', () => {
      const cal = makeCalendar(
        makeEvent('a', '20240115T080000Z', '20240115T170000Z'), // leaves only 1h gap at end
      );
      expect(finder.find(cal, from, to, 2 * HOUR)).toHaveLength(0);
    });

    it('includes slots exactly equal to minDurationMs', () => {
      // Event from 09:00–10:00 leaves a 1h gap before it (08:00–09:00)
      const cal = makeCalendar(makeEvent('a', '20240115T090000Z', '20240115T180000Z'));
      const slots = finder.find(cal, from, to, 1 * HOUR);
      expect(slots).toHaveLength(1);
    });

    it('returns all slots when minDurationMs is 0', () => {
      const cal = makeCalendar(makeEvent('a', '20240115T100000Z', '20240115T110000Z'));
      expect(finder.find(cal, from, to, 0)).toHaveLength(2);
    });
  });

  describe('TZID-qualified datetimes', () => {
    it('produces slots around a TZID event using its correctly resolved UTC instant', () => {
      // 10:00-11:00 Europe/Berlin (CET, UTC+1) resolves to 09:00-10:00 UTC.
      const cal = makeCalendar({
        name: 'VEVENT',
        properties: [
          { name: 'UID', params: {}, value: 'zoned' },
          { name: 'DTSTART', params: { TZID: 'Europe/Berlin' }, value: '20240115T100000' },
          { name: 'DTEND', params: { TZID: 'Europe/Berlin' }, value: '20240115T110000' },
        ],
        components: [],
      });
      const slots = finder.find(cal, from, to);
      expect(slots).toHaveLength(2);
      expect(slotDurationMs(slots[0]!)).toBe(1 * HOUR);
      expect(slotDurationMs(slots[1]!)).toBe(8 * HOUR);
    });
  });

  describe('events without parseable dates', () => {
    it('skips slots returned by CalendarInverter that have no parseable DTSTART or DTEND', () => {
      const eventWithoutDates: ICalComponent = {
        name: 'VEVENT',
        properties: [{ name: 'SUMMARY', params: {}, value: 'No dates' }],
        components: [],
      };
      const mockInverter = {
        invert: (): ICalComponent => ({
          name: 'VCALENDAR',
          properties: [],
          components: [eventWithoutDates],
        }),
      } as unknown as CalendarInverter;
      const finderWithMock = new FreeSlotFinder(mockInverter);
      expect(finderWithMock.find(makeCalendar(), from, to)).toHaveLength(0);
    });
  });
});
