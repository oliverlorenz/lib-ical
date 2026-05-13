import { ICalComponent } from './types';

export interface EventFilterCriteria {
  property?: string;
  pattern: RegExp;
}

export class EventFilter {
  public filter(component: ICalComponent, criteria: ReadonlyArray<EventFilterCriteria>): ICalComponent {
    if (criteria.length === 0) return component;
    return {
      ...component,
      components: component.components.filter(
        (c) => c.name !== 'VEVENT' || !this.eventMatches(c, criteria),
      ),
    };
  }

  public keep(component: ICalComponent, criteria: ReadonlyArray<EventFilterCriteria>): ICalComponent {
    if (criteria.length === 0) return component;
    return {
      ...component,
      components: component.components.filter(
        (c) => c.name !== 'VEVENT' || this.eventMatches(c, criteria),
      ),
    };
  }

  private eventMatches(event: ICalComponent, criteria: ReadonlyArray<EventFilterCriteria>): boolean {
    return criteria.some(({ property, pattern }) =>
      event.properties
        .filter((p) => property === undefined || p.name === property)
        .some((p) => pattern.test(p.value)),
    );
  }
}
