import { Parser } from './Parser';

const parser = new Parser();

const SIMPLE_ICAL = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Test//Test//EN',
  'BEGIN:VEVENT',
  'UID:test-uid@example.com',
  'DTSTART:20240101T100000Z',
  'DTEND:20240101T110000Z',
  'SUMMARY:Test Event',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

describe('Parser', () => {
  it('parses a simple iCal string', () => {
    const result = parser.parse(SIMPLE_ICAL);
    expect(result.name).toBe('VCALENDAR');
    expect(result.properties).toHaveLength(2);
    expect(result.components).toHaveLength(1);
  });

  it('parses calendar properties correctly', () => {
    const result = parser.parse(SIMPLE_ICAL);
    expect(result.properties[0]).toEqual({ name: 'VERSION', params: {}, value: '2.0' });
  });

  it('parses nested VEVENT component', () => {
    const result = parser.parse(SIMPLE_ICAL);
    expect(result.components[0]!.name).toBe('VEVENT');
    expect(result.components[0]!.properties).toHaveLength(4);
  });

  it('parses property with parameters', () => {
    const input = [
      'BEGIN:VCALENDAR',
      'DTSTART;TZID=America/New_York:19970714T170000',
      'END:VCALENDAR',
    ].join('\r\n');

    const result = parser.parse(input);
    expect(result.properties[0]).toEqual({
      name: 'DTSTART',
      params: { TZID: 'America/New_York' },
      value: '19970714T170000',
    });
  });

  it('unfolds folded lines', () => {
    const input = [
      'BEGIN:VCALENDAR',
      'DESCRIPTION:This is a long descri',
      ' ption that spans multiple lines.',
      'END:VCALENDAR',
    ].join('\r\n');

    expect(parser.parse(input).properties[0]!.value).toBe(
      'This is a long description that spans multiple lines.',
    );
  });

  it('handles LF-only line endings', () => {
    const input = 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR';
    expect(parser.parse(input).properties[0]!.value).toBe('2.0');
  });

  it('parses a property with a quoted parameter containing a colon', () => {
    const input = [
      'BEGIN:VCALENDAR',
      'DTSTART;X-PARAM="val:ue":20240101T100000Z',
      'END:VCALENDAR',
    ].join('\r\n');
    const result = parser.parse(input);
    expect(result.properties[0]!.name).toBe('DTSTART');
    expect(result.properties[0]!.value).toBe('20240101T100000Z');
  });

  it('throws when a line has no colon', () => {
    expect(() =>
      parser.parse(['BEGIN:VCALENDAR', 'NOCOLON', 'END:VCALENDAR'].join('\r\n')),
    ).toThrow('Invalid iCal line (no colon found): NOCOLON');
  });

  it('throws when a property appears before any BEGIN', () => {
    expect(() => parser.parse('SUMMARY:orphan\r\nBEGIN:VCALENDAR\r\nEND:VCALENDAR')).toThrow(
      'Property outside component',
    );
  });

  it('throws on mismatched END', () => {
    expect(() => parser.parse('BEGIN:VCALENDAR\r\nEND:VEVENT')).toThrow('Mismatched END:VEVENT');
  });

  it('throws when no root component found', () => {
    expect(() => parser.parse('')).toThrow('No root component found');
  });
});
