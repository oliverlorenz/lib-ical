import { parseDatetimeValue, parsePropertyDatetime, formatUtcDatetime } from './datetime';
import { ICalProperty } from './types';

describe('parseDatetimeValue', () => {
  it('parses a date-only value as UTC midnight', () => {
    expect(parseDatetimeValue('20240115')).toEqual(new Date(Date.UTC(2024, 0, 15)));
  });

  it('parses a Z-suffixed datetime as UTC', () => {
    expect(parseDatetimeValue('20240115T100000Z')).toEqual(
      new Date(Date.UTC(2024, 0, 15, 10, 0, 0)),
    );
  });

  it('parses a floating datetime (no Z, no tzid) as UTC, unchanged from before', () => {
    expect(parseDatetimeValue('20240115T100000')).toEqual(
      new Date(Date.UTC(2024, 0, 15, 10, 0, 0)),
    );
  });

  it('returns null for an unrecognised format', () => {
    expect(parseDatetimeValue('not-a-date')).toBeNull();
  });

  it('resolves a non-UTC tzid datetime to the correct UTC instant in winter (CET, UTC+1)', () => {
    expect(parseDatetimeValue('20250115T100000', 'Europe/Berlin')).toEqual(
      new Date(Date.UTC(2025, 0, 15, 9, 0, 0)),
    );
  });

  it('resolves a non-UTC tzid datetime to the correct UTC instant in summer (CEST, UTC+2)', () => {
    expect(parseDatetimeValue('20250715T100000', 'Europe/Berlin')).toEqual(
      new Date(Date.UTC(2025, 6, 15, 8, 0, 0)),
    );
  });

  it('resolves a different tzid correctly (America/New_York, EST winter UTC-5)', () => {
    expect(parseDatetimeValue('20250115T100000', 'America/New_York')).toEqual(
      new Date(Date.UTC(2025, 0, 15, 15, 0, 0)),
    );
  });

  it('resolves a different tzid correctly (America/New_York, EDT summer UTC-4)', () => {
    expect(parseDatetimeValue('20250715T100000', 'America/New_York')).toEqual(
      new Date(Date.UTC(2025, 6, 15, 14, 0, 0)),
    );
  });

  it('ignores tzid when the value is Z-suffixed (Z always wins per RFC 5545)', () => {
    expect(parseDatetimeValue('20250115T100000Z', 'Europe/Berlin')).toEqual(
      new Date(Date.UTC(2025, 0, 15, 10, 0, 0)),
    );
  });

  it('ignores tzid for date-only values', () => {
    expect(parseDatetimeValue('20250115', 'Europe/Berlin')).toEqual(
      new Date(Date.UTC(2025, 0, 15)),
    );
  });

  it('resolves a globally-unique TZID (leading slash, vendor domain) to the same offset as the plain IANA name', () => {
    expect(
      parseDatetimeValue('20250115T100000', '/freeassociation.sourceforge.net/Europe/Berlin'),
    ).toEqual(new Date(Date.UTC(2025, 0, 15, 9, 0, 0)));
  });

  it('resolves a globally-unique TZID in summer (DST) correctly', () => {
    expect(
      parseDatetimeValue('20250715T100000', '/freeassociation.sourceforge.net/Europe/Berlin'),
    ).toEqual(new Date(Date.UTC(2025, 6, 15, 8, 0, 0)));
  });

  it('falls back to UTC (0 offset) for a tzid that cannot be resolved at all', () => {
    expect(parseDatetimeValue('20250115T100000', 'Not/A_Real_Zone')).toEqual(
      new Date(Date.UTC(2025, 0, 15, 10, 0, 0)),
    );
  });
});

describe('parsePropertyDatetime', () => {
  it('returns null for an undefined property', () => {
    expect(parsePropertyDatetime(undefined)).toBeNull();
  });

  it('uses the TZID param off the property', () => {
    const prop: ICalProperty = {
      name: 'DTSTART',
      params: { TZID: 'Europe/Berlin' },
      value: '20250115T100000',
    };
    expect(parsePropertyDatetime(prop)).toEqual(new Date(Date.UTC(2025, 0, 15, 9, 0, 0)));
  });

  it('behaves like parseDatetimeValue when there is no TZID param', () => {
    const prop: ICalProperty = { name: 'DTSTART', params: {}, value: '20250115T100000Z' };
    expect(parsePropertyDatetime(prop)).toEqual(new Date(Date.UTC(2025, 0, 15, 10, 0, 0)));
  });
});

describe('formatUtcDatetime', () => {
  it('formats a Date as a Z-suffixed iCal datetime', () => {
    expect(formatUtcDatetime(new Date(Date.UTC(2024, 0, 15, 10, 0, 0)))).toBe('20240115T100000Z');
  });
});
