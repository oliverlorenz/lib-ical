import { ICalComponent } from './types';
import { parseDatetimeValue } from './datetime';
import { CalendarInverter } from './CalendarInverter';

export class BusyTimeCounter {
  constructor(private readonly inverter: CalendarInverter = new CalendarInverter()) {}

  public count(component: ICalComponent, from: Date, to: Date): number {
    const totalMs = to.getTime() - from.getTime();
    const antiCal = this.inverter.invert(component, from, to);
    const freeMs = antiCal.components.reduce((sum, c) => {
      const start = parseDatetimeValue(c.properties.find((p) => p.name === 'DTSTART')!.value)!;
      const end = parseDatetimeValue(c.properties.find((p) => p.name === 'DTEND')!.value)!;
      return sum + (end.getTime() - start.getTime());
    }, 0);
    return totalMs - freeMs;
  }
}
