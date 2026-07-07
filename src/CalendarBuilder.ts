import { ICalComponent, ICalProperty } from './types';
import { formatUtcDatetime } from './datetime';

export interface AttendeeInput {
  email: string;
  name?: string;
  status?: string;
}

export interface EventInput {
  uid?: string;
  summary: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  allDay?: boolean;
  attendees?: AttendeeInput[];
}

export interface CalendarBuilderOptions {
  prodId?: string;
  name?: string;
}

export class CalendarBuilder {
  private readonly events: EventInput[] = [];

  constructor(private readonly options: CalendarBuilderOptions = {}) {}

  public addEvent(event: EventInput): this {
    this.events.push(event);
    return this;
  }

  public build(): ICalComponent {
    const properties: ICalProperty[] = [
      { name: 'VERSION', params: {}, value: '2.0' },
      { name: 'CALSCALE', params: {}, value: 'GREGORIAN' },
      { name: 'PRODID', params: {}, value: this.options.prodId ?? '-//oliverlorenz/lib-ical//EN' },
    ];

    if (this.options.name) {
      properties.push({ name: 'X-WR-CALNAME', params: {}, value: this.options.name });
    }

    return {
      name: 'VCALENDAR',
      properties,
      components: this.events.map((event) => CalendarBuilder.buildEvent(event)),
    };
  }

  private static buildEvent(event: EventInput): ICalComponent {
    const uid = event.uid ?? crypto.randomUUID();
    const now = new Date();

    const properties: ICalProperty[] = [
      { name: 'UID', params: {}, value: uid },
      { name: 'DTSTAMP', params: {}, value: formatUtcDatetime(now) },
      { name: 'SUMMARY', params: {}, value: event.summary },
    ];

    if (event.allDay) {
      properties.push({
        name: 'DTSTART',
        params: { VALUE: 'DATE' },
        value: CalendarBuilder.formatDateOnly(event.start),
      });
      properties.push({
        name: 'DTEND',
        params: { VALUE: 'DATE' },
        value: CalendarBuilder.formatDateOnly(event.end),
      });
    } else {
      properties.push({ name: 'DTSTART', params: {}, value: formatUtcDatetime(event.start) });
      properties.push({ name: 'DTEND', params: {}, value: formatUtcDatetime(event.end) });
    }

    if (event.description) {
      properties.push({ name: 'DESCRIPTION', params: {}, value: event.description });
    }

    if (event.location) {
      properties.push({ name: 'LOCATION', params: {}, value: event.location });
    }

    for (const attendee of event.attendees ?? []) {
      properties.push(CalendarBuilder.buildAttendeeProperty(attendee));
    }

    return { name: 'VEVENT', properties, components: [] };
  }

  private static buildAttendeeProperty(attendee: AttendeeInput): ICalProperty {
    const params: Record<string, string> = {};
    if (attendee.name) {
      params.CN = attendee.name;
    }
    if (attendee.status) {
      params.PARTSTAT = attendee.status;
    }

    return { name: 'ATTENDEE', params, value: `mailto:${attendee.email}` };
  }

  private static formatDateOnly(date: Date): string {
    const pad = (n: number): string => n.toString().padStart(2, '0');
    return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
  }
}
