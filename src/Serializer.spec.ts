import { Serializer } from './Serializer';
import { ICalComponent } from './types';

const serializer = new Serializer();

describe('Serializer', () => {
  it('serializes a simple calendar', () => {
    const calendar: ICalComponent = {
      name: 'VCALENDAR',
      properties: [{ name: 'VERSION', params: {}, value: '2.0' }],
      components: [],
    };

    expect(serializer.serialize(calendar)).toBe('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR');
  });

  it('serializes nested components', () => {
    const calendar: ICalComponent = {
      name: 'VCALENDAR',
      properties: [],
      components: [
        {
          name: 'VEVENT',
          properties: [{ name: 'SUMMARY', params: {}, value: 'Test Event' }],
          components: [],
        },
      ],
    };

    expect(serializer.serialize(calendar)).toBe(
      'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Test Event\r\nEND:VEVENT\r\nEND:VCALENDAR',
    );
  });

  it('serializes properties with parameters', () => {
    const calendar: ICalComponent = {
      name: 'VCALENDAR',
      properties: [
        { name: 'DTSTART', params: { TZID: 'America/New_York' }, value: '19970714T170000' },
      ],
      components: [],
    };

    expect(serializer.serialize(calendar)).toContain('DTSTART;TZID=America/New_York:19970714T170000');
  });

  it('folds lines longer than 75 characters', () => {
    const calendar: ICalComponent = {
      name: 'VCALENDAR',
      properties: [{ name: 'DESCRIPTION', params: {}, value: 'A'.repeat(100) }],
      components: [],
    };

    for (const line of serializer.serialize(calendar).split('\r\n')) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
  });
});
