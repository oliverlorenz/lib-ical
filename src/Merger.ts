import { ICalComponent } from './types';

export class Merger {
  public merge(first: ICalComponent, ...rest: ICalComponent[]): ICalComponent {
    const allComponents = rest.reduce<ICalComponent[]>(
      (acc, cal) => [...acc, ...cal.components],
      [...first.components],
    );

    const seenTimezoneIds = new Set<string>();
    const components = allComponents.filter((component) => {
      if (component.name !== 'VTIMEZONE') return true;
      const tzid = component.properties.find((p) => p.name === 'TZID')?.value;
      if (!tzid || seenTimezoneIds.has(tzid)) return false;
      seenTimezoneIds.add(tzid);
      return true;
    });

    return { ...first, components };
  }
}
