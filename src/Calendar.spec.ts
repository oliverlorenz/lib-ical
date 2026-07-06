import { Calendar } from './Calendar';
import { Parser } from './Parser';
import { Serializer } from './Serializer';
import { Anonymizer } from './Anonymizer';
import { Merger } from './Merger';
import { RangeCleaner } from './RangeCleaner';
import { EventFilter } from './EventFilter';
import { EventLister } from './EventLister';
import { CalendarInverter } from './CalendarInverter';
import { RecurringExpander } from './RecurringExpander';
import { ConflictFinder } from './ConflictFinder';
import { CalendarDiff } from './CalendarDiff';
import { FreeSlotFinder } from './FreeSlotFinder';
import { BusyTimeCounter } from './BusyTimeCounter';
import { CalendarLinter } from './CalendarLinter';
import { ICalComponent } from './types';

const MOCK_COMPONENT: ICalComponent = {
  name: 'VCALENDAR',
  properties: [],
  components: [],
};

const SIMPLE_ICAL = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:test-uid@example.com',
  'SUMMARY:Meeting with John',
  'LOCATION:123 Main St',
  'DTSTART:20240101T100000Z',
  'DTEND:20240101T110000Z',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

function makeCalendar(
  parser: Partial<Parser> = {},
  serializer: Partial<Serializer> = {},
  anonymizer: Partial<Anonymizer> = {},
  merger: Partial<Merger> = {},
  rangeCleaner: Partial<RangeCleaner> = {},
): Calendar {
  return new Calendar(
    parser as Parser,
    serializer as Serializer,
    anonymizer as Anonymizer,
    merger as Merger,
    rangeCleaner as RangeCleaner,
  );
}

describe('Calendar', () => {
  describe('create', () => {
    it('returns a Calendar instance without requiring manual dependency injection', () => {
      expect(Calendar.create()).toBeInstanceOf(Calendar);
    });
  });

  describe('parse', () => {
    it('delegates to the injected Parser', () => {
      const parse = jest.fn().mockReturnValue(MOCK_COMPONENT);
      const result = makeCalendar({ parse }).parse('input');
      expect(parse).toHaveBeenCalledWith('input');
      expect(result).toBe(MOCK_COMPONENT);
    });
  });

  describe('serialize', () => {
    it('delegates to the injected Serializer', () => {
      const serialize = jest.fn().mockReturnValue('serialized');
      const result = makeCalendar({}, { serialize }).serialize(MOCK_COMPONENT);
      expect(serialize).toHaveBeenCalledWith(MOCK_COMPONENT);
      expect(result).toBe('serialized');
    });
  });

  describe('anonymize', () => {
    it('delegates to the injected Anonymizer', () => {
      const anonymizedComponent: ICalComponent = { ...MOCK_COMPONENT, name: 'ANONYMIZED' };
      const anonymize = jest.fn().mockReturnValue(anonymizedComponent);
      const result = makeCalendar({}, {}, { anonymize }).anonymize(MOCK_COMPONENT);
      expect(anonymize).toHaveBeenCalledWith(MOCK_COMPONENT);
      expect(result).toBe(anonymizedComponent);
    });
  });

  describe('merge', () => {
    it('delegates to the injected Merger', () => {
      const mergedComponent: ICalComponent = { ...MOCK_COMPONENT, name: 'MERGED' };
      const merge = jest.fn().mockReturnValue(mergedComponent);
      const other: ICalComponent = { ...MOCK_COMPONENT };
      const result = makeCalendar({}, {}, {}, { merge }).merge(MOCK_COMPONENT, other);
      expect(merge).toHaveBeenCalledWith(MOCK_COMPONENT, other);
      expect(result).toBe(mergedComponent);
    });
  });

  describe('cleanRange', () => {
    it('delegates to the injected RangeCleaner', () => {
      const cleanedComponent: ICalComponent = { ...MOCK_COMPONENT, name: 'CLEANED' };
      const clean = jest.fn().mockReturnValue(cleanedComponent);
      const start = new Date('2024-01-15T10:00:00Z');
      const end = new Date('2024-01-15T12:00:00Z');
      const result = makeCalendar({}, {}, {}, {}, { clean }).cleanRange(MOCK_COMPONENT, start, end);
      expect(clean).toHaveBeenCalledWith(MOCK_COMPONENT, start, end);
      expect(result).toBe(cleanedComponent);
    });
  });

  describe('cleanRanges', () => {
    it('delegates to the injected RangeCleaner', () => {
      const cleanedComponent: ICalComponent = { ...MOCK_COMPONENT, name: 'CLEANED' };
      const cleanRanges = jest.fn().mockReturnValue(cleanedComponent);
      const ranges: Array<[Date, Date]> = [
        [new Date('2024-01-15T10:00:00Z'), new Date('2024-01-15T12:00:00Z')],
      ];
      const result = makeCalendar({}, {}, {}, {}, { cleanRanges }).cleanRanges(
        MOCK_COMPONENT,
        ranges,
      );
      expect(cleanRanges).toHaveBeenCalledWith(MOCK_COMPONENT, ranges);
      expect(result).toBe(cleanedComponent);
    });
  });

  describe('loadFromUrl', () => {
    afterEach(() => jest.restoreAllMocks());

    it('fetches the URL and delegates parsing to the injected Parser', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        text: async (): Promise<string> => SIMPLE_ICAL,
      } as Response);
      const parse = jest.fn().mockReturnValue(MOCK_COMPONENT);
      const result = await makeCalendar({ parse }).loadFromUrl('https://example.com/calendar.ics');
      expect(global.fetch).toHaveBeenCalledWith('https://example.com/calendar.ics');
      expect(parse).toHaveBeenCalledWith(SIMPLE_ICAL);
      expect(result).toBe(MOCK_COMPONENT);
    });

    it('throws when the response is not ok', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);
      await expect(makeCalendar().loadFromUrl('https://example.com/missing.ics')).rejects.toThrow(
        'Failed to fetch iCal from https://example.com/missing.ics: 404 Not Found',
      );
    });
  });

  describe('filterEvents', () => {
    it('delegates to the injected EventFilter', () => {
      const filtered = { ...MOCK_COMPONENT };
      const filter = jest.fn().mockReturnValue(filtered);
      const cal = new Calendar(
        {} as Parser,
        {} as Serializer,
        {} as Anonymizer,
        {} as Merger,
        {} as RangeCleaner,
        { filter } as unknown as EventFilter,
      );
      const result = cal.filterEvents(MOCK_COMPONENT, { pattern: /x/ });
      expect(filter).toHaveBeenCalledWith(MOCK_COMPONENT, [{ pattern: /x/ }]);
      expect(result).toBe(filtered);
    });
  });

  describe('keepEvents', () => {
    it('delegates to the injected EventFilter', () => {
      const kept = { ...MOCK_COMPONENT };
      const keep = jest.fn().mockReturnValue(kept);
      const cal = new Calendar(
        {} as Parser,
        {} as Serializer,
        {} as Anonymizer,
        {} as Merger,
        {} as RangeCleaner,
        { keep } as unknown as EventFilter,
      );
      const result = cal.keepEvents(MOCK_COMPONENT, { pattern: /x/ });
      expect(keep).toHaveBeenCalledWith(MOCK_COMPONENT, [{ pattern: /x/ }]);
      expect(result).toBe(kept);
    });
  });

  describe('listEvents', () => {
    it('delegates to the injected EventLister', () => {
      const events = [MOCK_COMPONENT];
      const list = jest.fn().mockReturnValue(events);
      const from = new Date('2024-01-01T00:00:00Z');
      const to = new Date('2024-01-02T00:00:00Z');
      const cal = new Calendar(
        {} as Parser,
        {} as Serializer,
        {} as Anonymizer,
        {} as Merger,
        {} as RangeCleaner,
        undefined,
        { list } as unknown as EventLister,
      );
      const result = cal.listEvents(MOCK_COMPONENT, from, to);
      expect(list).toHaveBeenCalledWith(MOCK_COMPONENT, from, to);
      expect(result).toBe(events);
    });
  });

  describe('invert', () => {
    it('delegates to the injected CalendarInverter', () => {
      const inverted = { ...MOCK_COMPONENT };
      const invert = jest.fn().mockReturnValue(inverted);
      const from = new Date('2024-01-01T00:00:00Z');
      const to = new Date('2024-01-02T00:00:00Z');
      const cal = new Calendar(
        {} as Parser,
        {} as Serializer,
        {} as Anonymizer,
        {} as Merger,
        {} as RangeCleaner,
        undefined,
        undefined,
        { invert } as unknown as CalendarInverter,
      );
      const result = cal.invert(MOCK_COMPONENT, from, to);
      expect(invert).toHaveBeenCalledWith(MOCK_COMPONENT, from, to);
      expect(result).toBe(inverted);
    });
  });

  describe('expandRecurring', () => {
    it('delegates to the injected RecurringExpander', () => {
      const expanded = { ...MOCK_COMPONENT };
      const expand = jest.fn().mockReturnValue(expanded);
      const from = new Date('2024-01-01T00:00:00Z');
      const to = new Date('2024-01-02T00:00:00Z');
      const cal = new Calendar(
        {} as Parser,
        {} as Serializer,
        {} as Anonymizer,
        {} as Merger,
        {} as RangeCleaner,
        undefined,
        undefined,
        undefined,
        { expand } as unknown as RecurringExpander,
      );
      const result = cal.expandRecurring(MOCK_COMPONENT, from, to);
      expect(expand).toHaveBeenCalledWith(MOCK_COMPONENT, from, to);
      expect(result).toBe(expanded);
    });
  });

  describe('findConflicts', () => {
    it('delegates to the injected ConflictFinder', () => {
      const conflicts = [{ first: MOCK_COMPONENT, second: MOCK_COMPONENT }];
      const find = jest.fn().mockReturnValue(conflicts);
      const from = new Date('2024-01-01T00:00:00Z');
      const to = new Date('2024-01-02T00:00:00Z');
      const cal = new Calendar(
        {} as Parser,
        {} as Serializer,
        {} as Anonymizer,
        {} as Merger,
        {} as RangeCleaner,
        undefined,
        undefined,
        undefined,
        undefined,
        { find } as unknown as ConflictFinder,
      );
      const result = cal.findConflicts(MOCK_COMPONENT, from, to);
      expect(find).toHaveBeenCalledWith(MOCK_COMPONENT, from, to);
      expect(result).toBe(conflicts);
    });
  });

  describe('diff', () => {
    it('delegates to the injected CalendarDiff', () => {
      const diffResult = { added: [], removed: [], changed: [] };
      const diff = jest.fn().mockReturnValue(diffResult);
      const cal = new Calendar(
        {} as Parser,
        {} as Serializer,
        {} as Anonymizer,
        {} as Merger,
        {} as RangeCleaner,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { diff } as unknown as CalendarDiff,
      );
      const other = { ...MOCK_COMPONENT };
      const result = cal.diff(MOCK_COMPONENT, other);
      expect(diff).toHaveBeenCalledWith(MOCK_COMPONENT, other);
      expect(result).toBe(diffResult);
    });
  });

  describe('findFreeSlots', () => {
    it('delegates to the injected FreeSlotFinder with default minDurationMs', () => {
      const slots = [MOCK_COMPONENT];
      const find = jest.fn().mockReturnValue(slots);
      const from = new Date('2024-01-01T00:00:00Z');
      const to = new Date('2024-01-02T00:00:00Z');
      const cal = new Calendar(
        {} as Parser,
        {} as Serializer,
        {} as Anonymizer,
        {} as Merger,
        {} as RangeCleaner,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { find } as unknown as FreeSlotFinder,
      );
      const result = cal.findFreeSlots(MOCK_COMPONENT, from, to);
      expect(find).toHaveBeenCalledWith(MOCK_COMPONENT, from, to, 0);
      expect(result).toBe(slots);
    });

    it('passes explicit minDurationMs to FreeSlotFinder', () => {
      const find = jest.fn().mockReturnValue([]);
      const from = new Date('2024-01-01T00:00:00Z');
      const to = new Date('2024-01-02T00:00:00Z');
      const cal = new Calendar(
        {} as Parser,
        {} as Serializer,
        {} as Anonymizer,
        {} as Merger,
        {} as RangeCleaner,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { find } as unknown as FreeSlotFinder,
      );
      cal.findFreeSlots(MOCK_COMPONENT, from, to, 1800000);
      expect(find).toHaveBeenCalledWith(MOCK_COMPONENT, from, to, 1800000);
    });
  });

  describe('countBusyTime', () => {
    it('delegates to the injected BusyTimeCounter', () => {
      const count = jest.fn().mockReturnValue(3600000);
      const from = new Date('2024-01-01T00:00:00Z');
      const to = new Date('2024-01-02T00:00:00Z');
      const cal = new Calendar(
        {} as Parser,
        {} as Serializer,
        {} as Anonymizer,
        {} as Merger,
        {} as RangeCleaner,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { count } as unknown as BusyTimeCounter,
      );
      const result = cal.countBusyTime(MOCK_COMPONENT, from, to);
      expect(count).toHaveBeenCalledWith(MOCK_COMPONENT, from, to);
      expect(result).toBe(3600000);
    });
  });

  describe('lint', () => {
    it('delegates to the injected CalendarLinter', () => {
      const issues = [{ uid: 'a', rule: 'missing-attendees', message: 'Event has no attendees' }];
      const lint = jest.fn().mockReturnValue(issues);
      const cal = new Calendar(
        {} as Parser,
        {} as Serializer,
        {} as Anonymizer,
        {} as Merger,
        {} as RangeCleaner,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { lint } as unknown as CalendarLinter,
      );
      const result = cal.lint(MOCK_COMPONENT);
      expect(lint).toHaveBeenCalledWith(MOCK_COMPONENT, undefined);
      expect(result).toBe(issues);
    });
  });

  describe('integration', () => {
    it('round-trips parse → serialize without data loss', () => {
      const calendar = new Calendar(
        new Parser(),
        new Serializer(),
        new Anonymizer(),
        new Merger(),
        new RangeCleaner(),
      );
      const result = calendar.serialize(calendar.parse(SIMPLE_ICAL));
      expect(calendar.serialize(calendar.parse(result))).toBe(result);
    });

    it('anonymize → serialize removes personal data', () => {
      const calendar = new Calendar(
        new Parser(),
        new Serializer(),
        new Anonymizer(),
        new Merger(),
        new RangeCleaner(),
      );
      const result = calendar.serialize(calendar.anonymize(calendar.parse(SIMPLE_ICAL)));
      expect(result).toContain('SUMMARY:Event');
      expect(result).not.toContain('Meeting with John');
      expect(result).not.toContain('LOCATION');
      expect(result).toContain('DTSTART:20240101T100000Z');
    });

    it('merge → serialize combines events from multiple calendars', () => {
      const calendar = new Calendar(
        new Parser(),
        new Serializer(),
        new Anonymizer(),
        new Merger(),
        new RangeCleaner(),
      );
      const cal1 = calendar.parse(SIMPLE_ICAL);
      const cal2 = calendar.parse(
        [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'BEGIN:VEVENT',
          'UID:second@example.com',
          'SUMMARY:Second Event',
          'DTSTART:20240102T100000Z',
          'DTEND:20240102T110000Z',
          'END:VEVENT',
          'END:VCALENDAR',
        ].join('\r\n'),
      );
      const result = calendar.serialize(calendar.merge(cal1, cal2));
      expect(result).toContain('UID:test-uid@example.com');
      expect(result).toContain('UID:second@example.com');
    });
  });
});
