import { CalendarInverter } from './CalendarInverter';
import { EventLister } from './EventLister';
import { ICalComponent } from './types';

const inverter = new CalendarInverter();

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

function freeEvents(result: ICalComponent): ICalComponent[] {
  return result.components.filter((c) => c.name === 'VEVENT');
}

function dtstart(e: ICalComponent): string {
  return e.properties.find((p) => p.name === 'DTSTART')!.value;
}

function dtend(e: ICalComponent): string {
  return e.properties.find((p) => p.name === 'DTEND')!.value;
}

describe('CalendarInverter', () => {
  it('returns a VCALENDAR root component', () => {
    expect(inverter.invert(makeCalendar(), from, to).name).toBe('VCALENDAR');
  });

  describe('empty calendar', () => {
    it('produces one free event spanning the entire range', () => {
      const result = inverter.invert(makeCalendar(), from, to);
      const events = freeEvents(result);
      expect(events).toHaveLength(1);
      expect(dtstart(events[0]!)).toBe('20240115T080000Z');
      expect(dtend(events[0]!)).toBe('20240115T180000Z');
    });
  });

  describe('single event in the middle', () => {
    it('produces two free slots around the event', () => {
      const cal = makeCalendar(makeEvent('a', '20240115T100000Z', '20240115T110000Z'));
      const events = freeEvents(inverter.invert(cal, from, to));
      expect(events).toHaveLength(2);
      expect(dtstart(events[0]!)).toBe('20240115T080000Z');
      expect(dtend(events[0]!)).toBe('20240115T100000Z');
      expect(dtstart(events[1]!)).toBe('20240115T110000Z');
      expect(dtend(events[1]!)).toBe('20240115T180000Z');
    });
  });

  describe('event at range boundaries', () => {
    it('produces one free slot at the end when the event starts at range start', () => {
      const cal = makeCalendar(makeEvent('a', '20240115T080000Z', '20240115T100000Z'));
      const events = freeEvents(inverter.invert(cal, from, to));
      expect(events).toHaveLength(1);
      expect(dtstart(events[0]!)).toBe('20240115T100000Z');
      expect(dtend(events[0]!)).toBe('20240115T180000Z');
    });

    it('produces one free slot at the start when the event ends at range end', () => {
      const cal = makeCalendar(makeEvent('a', '20240115T160000Z', '20240115T180000Z'));
      const events = freeEvents(inverter.invert(cal, from, to));
      expect(events).toHaveLength(1);
      expect(dtstart(events[0]!)).toBe('20240115T080000Z');
      expect(dtend(events[0]!)).toBe('20240115T160000Z');
    });

    it('produces no free events when the event covers the entire range', () => {
      const cal = makeCalendar(makeEvent('a', '20240115T080000Z', '20240115T180000Z'));
      expect(freeEvents(inverter.invert(cal, from, to))).toHaveLength(0);
    });
  });

  describe('overlapping events', () => {
    it('merges two overlapping events into one busy interval', () => {
      const cal = makeCalendar(
        makeEvent('a', '20240115T090000Z', '20240115T110000Z'),
        makeEvent('b', '20240115T103000Z', '20240115T130000Z'),
      );
      const events = freeEvents(inverter.invert(cal, from, to));
      expect(events).toHaveLength(2);
      expect(dtend(events[0]!)).toBe('20240115T090000Z');
      expect(dtstart(events[1]!)).toBe('20240115T130000Z');
    });

    it('merges adjacent events with no gap between them', () => {
      const cal = makeCalendar(
        makeEvent('a', '20240115T090000Z', '20240115T110000Z'),
        makeEvent('b', '20240115T110000Z', '20240115T130000Z'),
      );
      const events = freeEvents(inverter.invert(cal, from, to));
      expect(events).toHaveLength(2);
      expect(dtend(events[0]!)).toBe('20240115T090000Z');
      expect(dtstart(events[1]!)).toBe('20240115T130000Z');
    });
  });

  describe('events partially outside range', () => {
    it('clips a busy interval that starts before range start', () => {
      const cal = makeCalendar(makeEvent('a', '20240115T070000Z', '20240115T100000Z'));
      const events = freeEvents(inverter.invert(cal, from, to));
      expect(events).toHaveLength(1);
      expect(dtstart(events[0]!)).toBe('20240115T100000Z');
    });

    it('clips a busy interval that ends after range end', () => {
      const cal = makeCalendar(makeEvent('a', '20240115T160000Z', '20240115T200000Z'));
      const events = freeEvents(inverter.invert(cal, from, to));
      expect(events).toHaveLength(1);
      expect(dtend(events[0]!)).toBe('20240115T160000Z');
    });
  });

  describe('recurring events', () => {
    it('expands recurring events and blocks the matching occurrences', () => {
      // Daily standup 09:00–09:30 — Jan 15 occurrence blocks 09:00–09:30
      const cal = makeCalendar(
        makeRecurring('standup', '20240101T090000Z', '20240101T093000Z', 'FREQ=DAILY'),
      );
      const events = freeEvents(inverter.invert(cal, from, to));
      const starts = events.map(dtstart);
      expect(starts).toContain('20240115T080000Z'); // free before standup
      expect(starts).toContain('20240115T093000Z'); // free after standup
      const endsAtStandup = events.find((e) => dtend(e) === '20240115T090000Z');
      expect(endsAtStandup).toBeDefined();
    });
  });

  describe('events without parseable dates', () => {
    it('skips events returned by EventLister that have no DTSTART or DTEND', () => {
      const eventWithoutDates: ICalComponent = {
        name: 'VEVENT',
        properties: [{ name: 'SUMMARY', params: {}, value: 'No dates' }],
        components: [],
      };
      const mockLister = { list: () => [eventWithoutDates] } as unknown as EventLister;
      const inverterWithMock = new CalendarInverter(mockLister);
      const result = inverterWithMock.invert(makeCalendar(), from, to);
      expect(freeEvents(result)).toHaveLength(1);
      expect(dtstart(freeEvents(result)[0]!)).toBe('20240115T080000Z');
    });
  });

  describe('free event properties', () => {
    it('sets SUMMARY to "Free" on each free event', () => {
      const result = inverter.invert(makeCalendar(), from, to);
      expect(freeEvents(result)[0]!.properties.find((p) => p.name === 'SUMMARY')?.value).toBe('Free');
    });

    it('sets a unique UID on each free event based on its start time', () => {
      const cal = makeCalendar(makeEvent('a', '20240115T100000Z', '20240115T110000Z'));
      const events = freeEvents(inverter.invert(cal, from, to));
      const uids = events.map((e) => e.properties.find((p) => p.name === 'UID')!.value);
      expect(new Set(uids).size).toBe(uids.length);
    });
  });
});
