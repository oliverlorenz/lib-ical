import { Merger } from './Merger';
import { ICalComponent } from './types';

const merger = new Merger();

function makeCalendar(uid: string, tzid?: string): ICalComponent {
  const components: ICalComponent[] = [
    {
      name: 'VEVENT',
      properties: [{ name: 'UID', params: {}, value: uid }],
      components: [],
    },
  ];

  if (tzid) {
    components.unshift({
      name: 'VTIMEZONE',
      properties: [{ name: 'TZID', params: {}, value: tzid }],
      components: [],
    });
  }

  return {
    name: 'VCALENDAR',
    properties: [
      { name: 'VERSION', params: {}, value: '2.0' },
      { name: 'PRODID', params: {}, value: `-//${uid}//EN` },
    ],
    components,
  };
}

describe('Merger', () => {
  it('merges components from all calendars into the first', () => {
    const result = merger.merge(makeCalendar('a'), makeCalendar('b'), makeCalendar('c'));
    const uids = result.components.map((c) => c.properties.find((p) => p.name === 'UID')?.value);
    expect(uids).toEqual(['a', 'b', 'c']);
  });

  it('takes properties from the first calendar', () => {
    const result = merger.merge(makeCalendar('a'), makeCalendar('b'));
    expect(result.properties.find((p) => p.name === 'PRODID')!.value).toBe('-//a//EN');
  });

  it('deduplicates VTIMEZONE components by TZID', () => {
    const result = merger.merge(
      makeCalendar('a', 'Europe/Berlin'),
      makeCalendar('b', 'Europe/Berlin'),
      makeCalendar('c', 'America/New_York'),
    );
    const timezones = result.components.filter((c) => c.name === 'VTIMEZONE');
    expect(timezones).toHaveLength(2);
    expect(timezones.map((t) => t.properties.find((p) => p.name === 'TZID')?.value)).toEqual([
      'Europe/Berlin',
      'America/New_York',
    ]);
  });

  it('keeps all events even when timezones are deduplicated', () => {
    const result = merger.merge(
      makeCalendar('a', 'Europe/Berlin'),
      makeCalendar('b', 'Europe/Berlin'),
    );
    expect(result.components.filter((c) => c.name === 'VEVENT')).toHaveLength(2);
  });

  it('does not mutate the first calendar', () => {
    const first = makeCalendar('a');
    merger.merge(first, makeCalendar('b'));
    expect(first.components).toHaveLength(1);
  });

  it('filters out a VTIMEZONE component that has no TZID property', () => {
    const noTzid: ICalComponent = { name: 'VTIMEZONE', properties: [], components: [] };
    const cal: ICalComponent = {
      name: 'VCALENDAR',
      properties: [],
      components: [
        noTzid,
        { name: 'VEVENT', properties: [{ name: 'UID', params: {}, value: 'e' }], components: [] },
      ],
    };
    const result = merger.merge(cal);
    expect(result.components.filter((c) => c.name === 'VTIMEZONE')).toHaveLength(0);
    expect(result.components.filter((c) => c.name === 'VEVENT')).toHaveLength(1);
  });

  it('returns a copy when called with a single calendar', () => {
    const first = makeCalendar('a');
    const result = merger.merge(first);
    expect(result.components).toHaveLength(1);
    expect(result).not.toBe(first);
  });
});
