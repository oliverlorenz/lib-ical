import { ICalComponent } from './types';
import { EventLister } from './EventLister';

export class RecurringExpander {
  constructor(private readonly eventLister: EventLister = new EventLister()) {}

  public expand(component: ICalComponent, from: Date, to: Date): ICalComponent {
    const recurringOnly = {
      ...component,
      components: component.components.filter(
        (c) => c.name === 'VEVENT' && c.properties.some((p) => p.name === 'RRULE'),
      ),
    };

    return {
      ...component,
      components: [
        ...component.components.filter((c) => c.name !== 'VEVENT'),
        ...component.components.filter(
          (c) => c.name === 'VEVENT' && !c.properties.some((p) => p.name === 'RRULE'),
        ),
        ...this.eventLister.list(recurringOnly, from, to),
      ],
    };
  }
}
