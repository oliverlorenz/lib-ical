import { ICalComponent } from './types';
import { parseDatetimeValue } from './datetime';
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
      const start = parseDatetimeValue(c.properties.find((p) => p.name === 'DTSTART')?.value ?? '');
      const end = parseDatetimeValue(c.properties.find((p) => p.name === 'DTEND')?.value ?? '');
      if (!start || !end) return false;
      return end.getTime() - start.getTime() >= minDurationMs;
    });
  }
}
