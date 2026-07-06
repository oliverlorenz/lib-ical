import { ICalComponent } from './types';
import { parsePropertyDatetime } from './datetime';
import { CalendarInverter } from './CalendarInverter';

export class BusyTimeCounter {
  constructor(private readonly inverter: CalendarInverter = new CalendarInverter()) {}

  public count(component: ICalComponent, from: Date, to: Date): number {
    const totalMs = to.getTime() - from.getTime();
    const antiCal = this.inverter.invert(component, from, to);
    const freeMs = antiCal.components.reduce((sum, c) => {
      const start = parsePropertyDatetime(c.properties.find((p) => p.name === 'DTSTART'));
      const end = parsePropertyDatetime(c.properties.find((p) => p.name === 'DTEND'));
      if (!start || !end) return sum;
      return sum + (end.getTime() - start.getTime());
    }, 0);
    return totalMs - freeMs;
  }
}
