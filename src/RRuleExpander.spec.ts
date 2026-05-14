import { RRuleExpander } from './RRuleExpander';

const expander = new RRuleExpander();

// Helpers
const dt = (iso: string): Date => new Date(iso);
const fmt = (d: Date): string => d.toISOString();

describe('RRuleExpander', () => {
  describe('DAILY', () => {
    it('generates daily occurrences in range', () => {
      const results = expander.expand(
        dt('2024-01-01T09:00:00Z'),
        'FREQ=DAILY',
        dt('2024-01-03T00:00:00Z'),
        dt('2024-01-05T23:59:59Z'),
      );
      expect(results.map(fmt)).toEqual([
        '2024-01-03T09:00:00.000Z',
        '2024-01-04T09:00:00.000Z',
        '2024-01-05T09:00:00.000Z',
      ]);
    });

    it('respects INTERVAL', () => {
      const results = expander.expand(
        dt('2024-01-01T09:00:00Z'),
        'FREQ=DAILY;INTERVAL=2',
        dt('2024-01-01T00:00:00Z'),
        dt('2024-01-07T23:59:59Z'),
      );
      expect(results.map(fmt)).toEqual([
        '2024-01-01T09:00:00.000Z',
        '2024-01-03T09:00:00.000Z',
        '2024-01-05T09:00:00.000Z',
        '2024-01-07T09:00:00.000Z',
      ]);
    });

    it('respects COUNT', () => {
      const results = expander.expand(
        dt('2024-01-01T09:00:00Z'),
        'FREQ=DAILY;COUNT=3',
        dt('2024-01-01T00:00:00Z'),
        dt('2024-12-31T23:59:59Z'),
      );
      expect(results).toHaveLength(3);
    });

    it('respects UNTIL', () => {
      const results = expander.expand(
        dt('2024-01-01T09:00:00Z'),
        'FREQ=DAILY;UNTIL=20240103T090000Z',
        dt('2024-01-01T00:00:00Z'),
        dt('2024-12-31T23:59:59Z'),
      );
      expect(results.map(fmt)).toEqual([
        '2024-01-01T09:00:00.000Z',
        '2024-01-02T09:00:00.000Z',
        '2024-01-03T09:00:00.000Z',
      ]);
    });
  });

  describe('WEEKLY', () => {
    it('generates weekly occurrences without BYDAY', () => {
      const results = expander.expand(
        dt('2024-01-01T09:00:00Z'),
        'FREQ=WEEKLY', // Monday
        dt('2024-01-01T00:00:00Z'),
        dt('2024-01-22T23:59:59Z'),
      );
      expect(results.map(fmt)).toEqual([
        '2024-01-01T09:00:00.000Z',
        '2024-01-08T09:00:00.000Z',
        '2024-01-15T09:00:00.000Z',
        '2024-01-22T09:00:00.000Z',
      ]);
    });

    it('generates occurrences for BYDAY=MO,WE,FR', () => {
      const results = expander.expand(
        dt('2024-01-01T09:00:00Z'),
        'FREQ=WEEKLY;BYDAY=MO,WE,FR',
        dt('2024-01-01T00:00:00Z'),
        dt('2024-01-05T23:59:59Z'),
      );
      expect(results.map(fmt)).toEqual([
        '2024-01-01T09:00:00.000Z', // Mon
        '2024-01-03T09:00:00.000Z', // Wed
        '2024-01-05T09:00:00.000Z', // Fri
      ]);
    });

    it('respects INTERVAL=2', () => {
      const results = expander.expand(
        dt('2024-01-01T09:00:00Z'),
        'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO',
        dt('2024-01-01T00:00:00Z'),
        dt('2024-01-29T23:59:59Z'),
      );
      expect(results.map(fmt)).toEqual([
        '2024-01-01T09:00:00.000Z',
        '2024-01-15T09:00:00.000Z',
        '2024-01-29T09:00:00.000Z',
      ]);
    });

    it('does not include occurrences before DTSTART', () => {
      // DTSTART is Wednesday; BYDAY includes Monday — that Monday should be skipped
      const results = expander.expand(
        dt('2024-01-03T09:00:00Z'),
        'FREQ=WEEKLY;BYDAY=MO,WE,FR', // Wed Jan 3
        dt('2024-01-01T00:00:00Z'),
        dt('2024-01-07T23:59:59Z'),
      );
      const days = results.map((d) => d.getUTCDay()); // 0=Sun … 6=Sat
      expect(days).not.toContain(1); // no Monday before DTSTART
      expect(days).toContain(3); // Wed Jan 3
      expect(days).toContain(5); // Fri Jan 5
    });
  });

  describe('MONTHLY', () => {
    it('generates monthly occurrences using BYMONTHDAY', () => {
      const results = expander.expand(
        dt('2024-01-01T09:00:00Z'),
        'FREQ=MONTHLY;BYMONTHDAY=15',
        dt('2024-01-01T00:00:00Z'),
        dt('2024-04-30T23:59:59Z'),
      );
      expect(results.map(fmt)).toEqual([
        '2024-01-15T09:00:00.000Z',
        '2024-02-15T09:00:00.000Z',
        '2024-03-15T09:00:00.000Z',
        '2024-04-15T09:00:00.000Z',
      ]);
    });

    it('generates monthly occurrences on the same day', () => {
      const results = expander.expand(
        dt('2024-01-15T09:00:00Z'),
        'FREQ=MONTHLY',
        dt('2024-01-01T00:00:00Z'),
        dt('2024-04-30T23:59:59Z'),
      );
      expect(results.map(fmt)).toEqual([
        '2024-01-15T09:00:00.000Z',
        '2024-02-15T09:00:00.000Z',
        '2024-03-15T09:00:00.000Z',
        '2024-04-15T09:00:00.000Z',
      ]);
    });

    it('skips invalid dates like Feb 30', () => {
      const results = expander.expand(
        dt('2024-01-30T09:00:00Z'),
        'FREQ=MONTHLY',
        dt('2024-01-01T00:00:00Z'),
        dt('2024-04-30T23:59:59Z'),
      );
      const months = results.map((d) => d.getUTCMonth() + 1);
      expect(months).not.toContain(2); // Feb 30 skipped
      expect(months).toContain(1); // Jan 30
      expect(months).toContain(3); // Mar 30
    });
  });

  describe('YEARLY', () => {
    it('generates yearly occurrences', () => {
      const results = expander.expand(
        dt('2020-03-15T09:00:00Z'),
        'FREQ=YEARLY',
        dt('2020-01-01T00:00:00Z'),
        dt('2024-12-31T23:59:59Z'),
      );
      expect(results).toHaveLength(5);
      expect(results.map((d) => d.getUTCFullYear())).toEqual([2020, 2021, 2022, 2023, 2024]);
    });
  });

  describe('error handling', () => {
    it('throws on unsupported FREQ', () => {
      expect(() =>
        expander.expand(
          dt('2024-01-01T09:00:00Z'),
          'FREQ=HOURLY',
          dt('2024-01-01T00:00:00Z'),
          dt('2024-01-02T00:00:00Z'),
        ),
      ).toThrow('Unsupported or missing RRULE FREQ: HOURLY');
    });
  });
});
