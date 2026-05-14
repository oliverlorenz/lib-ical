import { BusyTimeCounter } from './BusyTimeCounter';
import { CalendarInverter } from './CalendarInverter';
import { ICalComponent } from './types';

const counter = new BusyTimeCounter();

const from = new Date('2024-01-15T08:00:00Z');
const to = new Date('2024-01-15T18:00:00Z'); // 10h window

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

const HOUR = 60 * 60 * 1000;

describe('BusyTimeCounter', () => {
  it('returns 0 for an empty calendar', () => {
    expect(counter.count(makeCalendar(), from, to)).toBe(0);
  });

  it('returns the full range duration when one event covers the entire range', () => {
    const cal = makeCalendar(makeEvent('a', '20240115T080000Z', '20240115T180000Z'));
    expect(counter.count(cal, from, to)).toBe(10 * HOUR);
  });

  it('counts the duration of a single event', () => {
    const cal = makeCalendar(makeEvent('a', '20240115T100000Z', '20240115T120000Z'));
    expect(counter.count(cal, from, to)).toBe(2 * HOUR);
  });

  it('counts two non-overlapping events separately', () => {
    const cal = makeCalendar(
      makeEvent('a', '20240115T090000Z', '20240115T100000Z'),
      makeEvent('b', '20240115T110000Z', '20240115T130000Z'),
    );
    expect(counter.count(cal, from, to)).toBe(3 * HOUR);
  });

  it('deduplicates overlapping events — counts union not sum', () => {
    // Two events 09:00–11:00 and 10:00–12:00 overlap; union is 09:00–12:00 = 3h
    const cal = makeCalendar(
      makeEvent('a', '20240115T090000Z', '20240115T110000Z'),
      makeEvent('b', '20240115T100000Z', '20240115T120000Z'),
    );
    expect(counter.count(cal, from, to)).toBe(3 * HOUR);
  });

  it('clips events that extend beyond the range boundary', () => {
    // Event 07:00–11:00, only 08:00–11:00 is within range → 3h
    const cal = makeCalendar(makeEvent('a', '20240115T070000Z', '20240115T110000Z'));
    expect(counter.count(cal, from, to)).toBe(3 * HOUR);
  });

  it('counts busy time from a recurring event correctly', () => {
    // Daily standup 09:00–09:30, one occurrence on Jan 15 → 30min
    const cal = makeCalendar(
      makeRecurring('standup', '20240101T090000Z', '20240101T093000Z', 'FREQ=DAILY'),
    );
    expect(counter.count(cal, from, to)).toBe(30 * 60 * 1000);
  });

  it('ignores slots returned by CalendarInverter that have no parseable DTSTART or DTEND', () => {
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
    const counterWithMock = new BusyTimeCounter(mockInverter);
    // No parseable free slots → busy time = total window
    expect(counterWithMock.count(makeCalendar(), from, to)).toBe(to.getTime() - from.getTime());
  });
});
