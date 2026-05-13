import { ICalComponent } from './types';
import { parseDatetimeValue, formatUtcDatetime } from './datetime';
import { RRuleExpander } from './RRuleExpander';

export class EventLister {
  constructor(private readonly rruleExpander: RRuleExpander = new RRuleExpander()) {}

  public list(component: ICalComponent, from: Date, to: Date): ICalComponent[] {
    return component.components
      .filter((c) => c.name === 'VEVENT')
      .flatMap((event) => this.expandEvent(event, from, to));
  }

  private expandEvent(event: ICalComponent, from: Date, to: Date): ICalComponent[] {
    const rruleProp = event.properties.find((p) => p.name === 'RRULE');
    if (rruleProp) {
      return this.expandRecurring(event, rruleProp.value, from, to);
    }
    return this.expandNonRecurring(event, from, to);
  }

  // ── Non-recurring ────────────────────────────────────────────────────────

  private expandNonRecurring(event: ICalComponent, from: Date, to: Date): ICalComponent[] {
    const dtStartProp = event.properties.find((p) => p.name === 'DTSTART');
    const dtEndProp = event.properties.find((p) => p.name === 'DTEND');
    if (!dtStartProp) return [];

    const start = parseDatetimeValue(dtStartProp.value);
    if (!start) return [];

    const end = dtEndProp
      ? parseDatetimeValue(dtEndProp.value)
      : EventLister.impliedEnd(dtStartProp.value, start);
    if (!end) return [];

    if (end <= from || start >= to) return [];
    return [event];
  }

  // ── Recurring ─────────────────────────────────────────────────────────────

  private expandRecurring(event: ICalComponent, rrule: string, from: Date, to: Date): ICalComponent[] {
    const dtStartProp = event.properties.find((p) => p.name === 'DTSTART');
    const dtEndProp = event.properties.find((p) => p.name === 'DTEND');
    if (!dtStartProp) return [];

    const dtstart = parseDatetimeValue(dtStartProp.value);
    if (!dtstart) return [];

    const dtend = dtEndProp ? parseDatetimeValue(dtEndProp.value) : null;
    const duration = dtend
      ? dtend.getTime() - dtstart.getTime()
      : /^\d{8}$/.test(dtStartProp.value)
        ? 24 * 60 * 60 * 1000
        : 0;

    const exdates = this.parseExdates(event);

    // Start expanding early enough to catch occurrences that begin before `from` but end after it
    const expandFrom = new Date(Math.max(dtstart.getTime(), from.getTime() - duration));

    let occurrences: Date[];
    try {
      occurrences = this.rruleExpander.expand(dtstart, rrule, expandFrom, to);
    } catch {
      return this.expandNonRecurring(event, from, to);
    }

    const result: ICalComponent[] = [];
    for (const occ of occurrences) {
      if (exdates.has(occ.getTime())) continue;
      const occEnd = new Date(occ.getTime() + duration);
      if (occEnd <= from || occ >= to) continue;
      result.push(this.makeOccurrence(event, occ, occEnd));
    }
    return result;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private parseExdates(event: ICalComponent): Set<number> {
    const prop = event.properties.find((p) => p.name === 'EXDATE');
    if (!prop) return new Set();
    return new Set(
      prop.value
        .split(',')
        .map((v) => parseDatetimeValue(v.trim()))
        .filter((d): d is Date => d !== null)
        .map((d) => d.getTime()),
    );
  }

  private makeOccurrence(baseEvent: ICalComponent, start: Date, end: Date): ICalComponent {
    const excluded = new Set(['RRULE', 'EXDATE', 'RDATE', 'DTSTART', 'DTEND']);
    return {
      ...baseEvent,
      properties: [
        ...baseEvent.properties.filter((p) => !excluded.has(p.name)),
        { name: 'DTSTART', params: {}, value: formatUtcDatetime(start) },
        { name: 'DTEND', params: {}, value: formatUtcDatetime(end) },
        { name: 'RECURRENCE-ID', params: {}, value: formatUtcDatetime(start) },
      ],
    };
  }

  private static impliedEnd(dtStartValue: string, start: Date): Date {
    return /^\d{8}$/.test(dtStartValue)
      ? new Date(start.getTime() + 24 * 60 * 60 * 1000)
      : start;
  }
}
