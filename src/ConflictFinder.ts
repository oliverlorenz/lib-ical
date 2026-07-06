import { ICalComponent } from './types';
import { parsePropertyDatetime } from './datetime';
import { EventLister } from './EventLister';

export interface ConflictPair {
  first: ICalComponent;
  second: ICalComponent;
}

export class ConflictFinder {
  constructor(private readonly eventLister: EventLister = new EventLister()) {}

  public find(component: ICalComponent, from: Date, to: Date): ConflictPair[] {
    const events = this.eventLister.list(component, from, to);
    const conflicts: ConflictPair[] = [];

    for (let i = 0; i < events.length; i++) {
      const eventI = events[i] as ICalComponent;
      for (let j = i + 1; j < events.length; j++) {
        const eventJ = events[j] as ICalComponent;
        if (this.overlaps(eventI, eventJ)) {
          conflicts.push({ first: eventI, second: eventJ });
        }
      }
    }
    return conflicts;
  }

  private overlaps(a: ICalComponent, b: ICalComponent): boolean {
    const aStart = parsePropertyDatetime(a.properties.find((p) => p.name === 'DTSTART'));
    const aEnd = parsePropertyDatetime(a.properties.find((p) => p.name === 'DTEND'));
    const bStart = parsePropertyDatetime(b.properties.find((p) => p.name === 'DTSTART'));
    const bEnd = parsePropertyDatetime(b.properties.find((p) => p.name === 'DTEND'));

    if (!aStart || !aEnd || !bStart || !bEnd) return false;
    return aStart < bEnd && bStart < aEnd;
  }
}
