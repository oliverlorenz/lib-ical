import { ICalComponent, ICalProperty } from './types';

const DEFAULT_PROPERTIES_TO_REMOVE: ReadonlySet<string> = new Set([
  'DESCRIPTION',
  'LOCATION',
  'ORGANIZER',
  'ATTENDEE',
  'COMMENT',
  'CONTACT',
  'URL',
  'GEO',
  'CATEGORIES',
  'X-WR-CALNAME',
]);

export class Anonymizer {
  constructor(
    private readonly summaryReplacement: string = 'Event',
    private readonly propertiesToRemove: ReadonlySet<string> = DEFAULT_PROPERTIES_TO_REMOVE,
  ) {}

  private anonymizeProperties(properties: ICalProperty[]): ICalProperty[] {
    return properties
      .filter((prop) => !this.propertiesToRemove.has(prop.name))
      .map((prop) =>
        prop.name === 'SUMMARY' ? { ...prop, value: this.summaryReplacement } : prop,
      );
  }

  public anonymize(component: ICalComponent): ICalComponent {
    return {
      ...component,
      properties: this.anonymizeProperties(component.properties),
      components: component.components.map((c) => this.anonymize(c)),
    };
  }
}
