import { ICalComponent } from './types';

export interface CalendarDiffResult {
  added: ICalComponent[];
  removed: ICalComponent[];
  changed: ICalComponent[];
}

export class CalendarDiff {
  public diff(before: ICalComponent, after: ICalComponent): CalendarDiffResult {
    const beforeEvents = this.eventsByKey(before);
    const afterEvents = this.eventsByKey(after);

    const added: ICalComponent[] = [];
    const removed: ICalComponent[] = [];
    const changed: ICalComponent[] = [];

    for (const [key, afterEvent] of afterEvents) {
      const beforeEvent = beforeEvents.get(key);
      if (!beforeEvent) {
        added.push(afterEvent);
      } else if (!this.eventsEqual(beforeEvent, afterEvent)) {
        changed.push(afterEvent);
      }
    }

    for (const [key, beforeEvent] of beforeEvents) {
      if (!afterEvents.has(key)) removed.push(beforeEvent);
    }

    return { added, removed, changed };
  }

  private eventsByKey(component: ICalComponent): Map<string, ICalComponent> {
    const map = new Map<string, ICalComponent>();
    for (const c of component.components) {
      if (c.name !== 'VEVENT') continue;
      const uid = c.properties.find((p) => p.name === 'UID')?.value;
      if (!uid) continue;
      const recurrenceId = c.properties.find((p) => p.name === 'RECURRENCE-ID')?.value;
      map.set(recurrenceId ? `${uid}:${recurrenceId}` : uid, c);
    }
    return map;
  }

  private eventsEqual(a: ICalComponent, b: ICalComponent): boolean {
    const aProps = new Map(a.properties.map((p) => [p.name, p.value]));
    const bProps = new Map(b.properties.map((p) => [p.name, p.value]));
    if (aProps.size !== bProps.size) return false;
    for (const [name, value] of aProps) {
      if (bProps.get(name) !== value) return false;
    }
    return true;
  }
}
