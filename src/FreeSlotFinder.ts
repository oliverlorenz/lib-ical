import { ICalComponent } from './types';
import { parsePropertyDatetime } from './datetime';
import { CalendarInverter } from './CalendarInverter';

export class FreeSlotFinder {
  constructor(private readonly inverter: CalendarInverter = new CalendarInverter()) {}

  public find(
    component: ICalComponent,
    from: Date,
    to: Date,
    minDurationMs: number = 0,
  ): ICalComponent[] {
    const antiCal = this.inverter.invert(component, from, to);
    return antiCal.components.filter((c) => {
      const start = parsePropertyDatetime(c.properties.find((p) => p.name === 'DTSTART'));
      const end = parsePropertyDatetime(c.properties.find((p) => p.name === 'DTEND'));
      if (!start || !end) return false;
      return end.getTime() - start.getTime() >= minDurationMs;
    });
  }
}
