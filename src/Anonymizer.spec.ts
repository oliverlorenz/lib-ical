import { Anonymizer } from './Anonymizer';
import { ICalComponent } from './types';

const EVENT: ICalComponent = {
  name: 'VCALENDAR',
  properties: [
    { name: 'VERSION', params: {}, value: '2.0' },
    { name: 'X-WR-CALNAME', params: {}, value: "John's Calendar" },
  ],
  components: [
    {
      name: 'VEVENT',
      properties: [
        { name: 'UID', params: {}, value: 'test-uid@example.com' },
        { name: 'SUMMARY', params: {}, value: 'Meeting with John' },
        { name: 'DESCRIPTION', params: {}, value: 'Bring the quarterly report' },
        { name: 'LOCATION', params: {}, value: '123 Main St, New York' },
        { name: 'ORGANIZER', params: {}, value: 'CN=John:MAILTO:john@example.com' },
        { name: 'ATTENDEE', params: {}, value: 'CN=Jane:MAILTO:jane@example.com' },
        { name: 'GEO', params: {}, value: '40.7128;-74.0060' },
        { name: 'DTSTART', params: {}, value: '20240101T100000Z' },
        { name: 'DTEND', params: {}, value: '20240101T110000Z' },
      ],
      components: [],
    },
  ],
};

describe('Anonymizer', () => {
  const anonymizer = new Anonymizer();

  it('replaces SUMMARY with default value', () => {
    const event = anonymizer.anonymize(EVENT).components[0]!;
    expect(event.properties.find((p) => p.name === 'SUMMARY')!.value).toBe('Event');
  });

  it('removes LOCATION, DESCRIPTION, ORGANIZER, ATTENDEE, GEO', () => {
    const event = anonymizer.anonymize(EVENT).components[0]!;
    for (const name of ['LOCATION', 'DESCRIPTION', 'ORGANIZER', 'ATTENDEE', 'GEO']) {
      expect(event.properties.find((p) => p.name === name)).toBeUndefined();
    }
  });

  it('removes X-WR-CALNAME from calendar', () => {
    const result = anonymizer.anonymize(EVENT);
    expect(result.properties.find((p) => p.name === 'X-WR-CALNAME')).toBeUndefined();
  });

  it('keeps UID, DTSTART, DTEND and VERSION', () => {
    const result = anonymizer.anonymize(EVENT);
    const event = result.components[0]!;
    expect(result.properties.find((p) => p.name === 'VERSION')).toBeDefined();
    expect(event.properties.find((p) => p.name === 'UID')).toBeDefined();
    expect(event.properties.find((p) => p.name === 'DTSTART')).toBeDefined();
    expect(event.properties.find((p) => p.name === 'DTEND')).toBeDefined();
  });

  it('does not mutate the original component', () => {
    anonymizer.anonymize(EVENT);
    const event = EVENT.components[0]!;
    expect(event.properties.find((p) => p.name === 'SUMMARY')!.value).toBe('Meeting with John');
    expect(event.properties.find((p) => p.name === 'LOCATION')).toBeDefined();
  });

  it('accepts custom propertiesToRemove via constructor', () => {
    const custom = new Anonymizer('Event', new Set(['UID']));
    const event = custom.anonymize(EVENT).components[0]!;
    expect(event.properties.find((p) => p.name === 'UID')).toBeUndefined();
    expect(event.properties.find((p) => p.name === 'LOCATION')).toBeDefined();
  });

  it('accepts custom summaryReplacement via constructor', () => {
    const custom = new Anonymizer('Termin');
    const event = custom.anonymize(EVENT).components[0]!;
    expect(event.properties.find((p) => p.name === 'SUMMARY')!.value).toBe('Termin');
  });
});
