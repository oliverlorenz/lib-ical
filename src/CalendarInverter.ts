import { ICalComponent } from './types';
import { parseDatetimeValue, formatUtcDatetime } from './datetime';
import { EventLister } from './EventLister';

export class CalendarInverter {
  constructor(private readonly eventLister: EventLister = new EventLister()) {}

  public invert(component: ICalComponent, from: Date, to: Date): ICalComponent {
    const busyIntervals = this.collectBusyIntervals(component, from, to);
    const merged = this.mergeIntervals(busyIntervals);
    const freeEvents = this.buildFreeEvents(merged, from, to);

    return {
      name: 'VCALENDAR',
      properties: [
        { name: 'VERSION', params: {}, value: '2.0' },
        { name: 'PRODID', params: {}, value: '-//oliverlorenz//lib-ical//EN' },
      ],
      components: freeEvents,
    };
  }

  // ── Interval collection ────────────────────────────────────────────────────

  private collectBusyIntervals(component: ICalComponent, from: Date, to: Date): [Date, Date][] {
    const intervals: [Date, Date][] = [];

    for (const event of this.eventLister.list(component, from, to)) {
      const start = parseDatetimeValue(
        event.properties.find((p) => p.name === 'DTSTART')?.value ?? '',
      );
      const end = parseDatetimeValue(event.properties.find((p) => p.name === 'DTEND')?.value ?? '');
      if (!start || !end) continue;

      // Clip to [from, to] since EventLister may return partially overlapping events
      const clippedStart = start < from ? from : start;
      const clippedEnd = end > to ? to : end;
      if (clippedStart < clippedEnd) intervals.push([clippedStart, clippedEnd]);
    }

    return intervals.sort((a, b) => a[0].getTime() - b[0].getTime());
  }

  // ── Interval merge ─────────────────────────────────────────────────────────

  private mergeIntervals(intervals: [Date, Date][]): [Date, Date][] {
    if (intervals.length === 0) return [];

    const merged: [Date, Date][] = [intervals[0] as [Date, Date]];
    for (let i = 1; i < intervals.length; i++) {
      const last = merged[merged.length - 1] as [Date, Date];
      const [currStart, currEnd] = intervals[i] as [Date, Date];
      if (currStart <= last[1]) {
        if (currEnd > last[1]) merged[merged.length - 1] = [last[0], currEnd];
      } else {
        merged.push([currStart, currEnd]);
      }
    }
    return merged;
  }

  // ── Gap → VEVENT ───────────────────────────────────────────────────────────

  private buildFreeEvents(busyIntervals: [Date, Date][], from: Date, to: Date): ICalComponent[] {
    const events: ICalComponent[] = [];
    let cursor = from;

    for (const [busyStart, busyEnd] of busyIntervals) {
      if (cursor < busyStart) events.push(this.makeFreeEvent(cursor, busyStart));
      cursor = busyEnd;
    }

    if (cursor < to) events.push(this.makeFreeEvent(cursor, to));
    return events;
  }

  private makeFreeEvent(start: Date, end: Date): ICalComponent {
    return {
      name: 'VEVENT',
      properties: [
        { name: 'UID', params: {}, value: `free-${formatUtcDatetime(start)}` },
        { name: 'SUMMARY', params: {}, value: 'Free' },
        { name: 'DTSTART', params: {}, value: formatUtcDatetime(start) },
        { name: 'DTEND', params: {}, value: formatUtcDatetime(end) },
      ],
      components: [],
    };
  }
}
