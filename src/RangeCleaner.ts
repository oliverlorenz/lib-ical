import { ICalComponent, ICalProperty } from './types';
import { parsePropertyDatetime, formatUtcDatetime } from './datetime';
import { RRuleExpander } from './RRuleExpander';

export class RangeCleaner {
  constructor(private readonly rruleExpander: RRuleExpander = new RRuleExpander()) {}

  public cleanRanges(component: ICalComponent, ranges: ReadonlyArray<[Date, Date]>): ICalComponent {
    return ranges.reduce((acc, [start, end]) => this.clean(acc, start, end), component);
  }

  public clean(component: ICalComponent, start: Date, end: Date): ICalComponent {
    return {
      ...component,
      components: component.components.flatMap((c) =>
        c.name === 'VEVENT' ? this.processEvent(c, start, end) : [c],
      ),
    };
  }

  private processEvent(event: ICalComponent, rangeStart: Date, rangeEnd: Date): ICalComponent[] {
    const rruleProp = event.properties.find((p) => p.name === 'RRULE');
    if (rruleProp) {
      return this.processRecurringEvent(event, rruleProp.value, rangeStart, rangeEnd);
    }
    return this.processNonRecurringEvent(event, rangeStart, rangeEnd);
  }

  // ── Non-recurring ────────────────────────────────────────────────────────

  private processNonRecurringEvent(
    event: ICalComponent,
    rangeStart: Date,
    rangeEnd: Date,
  ): ICalComponent[] {
    const dtStartProp = event.properties.find((p) => p.name === 'DTSTART');
    const dtEndProp = event.properties.find((p) => p.name === 'DTEND');

    if (!dtStartProp) return [event];

    const eventStart = parsePropertyDatetime(dtStartProp);
    if (!eventStart) return [event];

    const eventEnd = dtEndProp
      ? parsePropertyDatetime(dtEndProp)
      : RangeCleaner.impliedEnd(dtStartProp.value, eventStart);
    if (!eventEnd) return [event];

    if (eventEnd <= rangeStart || eventStart >= rangeEnd) return [event];
    if (eventStart >= rangeStart && eventEnd <= rangeEnd) return [];

    if (eventStart < rangeStart && eventEnd > rangeEnd) {
      return [
        RangeCleaner.withDtEnd(event, rangeStart),
        RangeCleaner.withDtStart(RangeCleaner.withSplitUid(event), rangeEnd),
      ];
    }
    if (eventStart < rangeStart) return [RangeCleaner.withDtEnd(event, rangeStart)];
    return [RangeCleaner.withDtStart(event, rangeEnd)];
  }

  // ── Recurring ─────────────────────────────────────────────────────────────

  private processRecurringEvent(
    event: ICalComponent,
    rrule: string,
    rangeStart: Date,
    rangeEnd: Date,
  ): ICalComponent[] {
    const dtStartProp = event.properties.find((p) => p.name === 'DTSTART');
    const dtEndProp = event.properties.find((p) => p.name === 'DTEND');
    if (!dtStartProp) return [event];

    const dtstart = parsePropertyDatetime(dtStartProp);
    if (!dtstart) return [event];

    const dtend = dtEndProp ? parsePropertyDatetime(dtEndProp) : null;
    const duration = dtend
      ? dtend.getTime() - dtstart.getTime()
      : /^\d{8}$/.test(dtStartProp.value)
        ? 24 * 60 * 60 * 1000
        : 0;

    const from = new Date(Math.max(dtstart.getTime(), rangeStart.getTime() - duration));

    let occurrences: Date[];
    try {
      occurrences = this.rruleExpander.expand(dtstart, rrule, from, rangeEnd);
    } catch {
      return this.processNonRecurringEvent(event, rangeStart, rangeEnd);
    }

    const uidProp = event.properties.find((p) => p.name === 'UID');
    const baseUid = uidProp?.value ?? 'unknown';
    const exdates: Date[] = [];
    const exceptions: ICalComponent[] = [];

    for (const occ of occurrences) {
      const occEnd = new Date(occ.getTime() + duration);

      if (occEnd <= rangeStart || occ >= rangeEnd) continue;

      exdates.push(occ);

      if (occ >= rangeStart && occEnd <= rangeEnd) continue;

      const key = formatUtcDatetime(occ).substring(0, 15); // YYYYMMDDTHHmmss

      if (occ < rangeStart && occEnd > rangeEnd) {
        exceptions.push(
          RangeCleaner.makeException(event, `${baseUid}-${key}-1`, occ, new Date(rangeStart)),
        );
        exceptions.push(
          RangeCleaner.makeException(event, `${baseUid}-${key}-2`, new Date(rangeEnd), occEnd),
        );
      } else if (occ < rangeStart) {
        exceptions.push(
          RangeCleaner.makeException(event, `${baseUid}-${key}-1`, occ, new Date(rangeStart)),
        );
      } else {
        exceptions.push(
          RangeCleaner.makeException(event, `${baseUid}-${key}-1`, new Date(rangeEnd), occEnd),
        );
      }
    }

    if (exdates.length === 0) return [event];

    return [RangeCleaner.withExdates(event, exdates), ...exceptions];
  }

  // ── Static helpers ────────────────────────────────────────────────────────

  private static impliedEnd(dtStartValue: string, start: Date): Date {
    return /^\d{8}$/.test(dtStartValue) ? new Date(start.getTime() + 24 * 60 * 60 * 1000) : start;
  }

  private static withDtEnd(event: ICalComponent, end: Date): ICalComponent {
    const value = formatUtcDatetime(end);
    const newProp: ICalProperty = { name: 'DTEND', params: {}, value };
    const hasDtEnd = event.properties.some((p) => p.name === 'DTEND');
    return {
      ...event,
      properties: hasDtEnd
        ? event.properties.map((p) => (p.name === 'DTEND' ? newProp : p))
        : [...event.properties, newProp],
    };
  }

  private static withDtStart(event: ICalComponent, start: Date): ICalComponent {
    const value = formatUtcDatetime(start);
    return {
      ...event,
      properties: event.properties.map((p) =>
        p.name === 'DTSTART' ? { name: 'DTSTART', params: {}, value } : p,
      ),
    };
  }

  private static withSplitUid(event: ICalComponent): ICalComponent {
    return {
      ...event,
      properties: event.properties.map((p) =>
        p.name === 'UID' ? { ...p, value: `${p.value}-split` } : p,
      ),
    };
  }

  private static withExdates(event: ICalComponent, exdates: Date[]): ICalComponent {
    const exdateProp: ICalProperty = {
      name: 'EXDATE',
      params: {},
      value: exdates.map(formatUtcDatetime).join(','),
    };
    return { ...event, properties: [...event.properties, exdateProp] };
  }

  private static makeException(
    baseEvent: ICalComponent,
    uid: string,
    start: Date,
    end: Date,
  ): ICalComponent {
    const excluded = new Set(['UID', 'RRULE', 'DTSTART', 'DTEND', 'EXDATE', 'RDATE', 'EXRULE']);
    return {
      ...baseEvent,
      properties: [
        ...baseEvent.properties.filter((p) => !excluded.has(p.name)),
        { name: 'UID', params: {}, value: uid },
        { name: 'DTSTART', params: {}, value: formatUtcDatetime(start) },
        { name: 'DTEND', params: {}, value: formatUtcDatetime(end) },
      ],
    };
  }
}
