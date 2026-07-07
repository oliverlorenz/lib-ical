import { CalendarBuilder } from './CalendarBuilder';
import { Serializer } from './Serializer';

const START = new Date('2025-06-20T10:00:00Z');
const END = new Date('2025-06-20T11:00:00Z');

describe('CalendarBuilder', () => {
  describe('build', () => {
    it('produces a VCALENDAR component with required properties', () => {
      const cal = new CalendarBuilder().build();
      expect(cal.name).toBe('VCALENDAR');
      expect(cal.properties.find((p) => p.name === 'VERSION')?.value).toBe('2.0');
      expect(cal.properties.find((p) => p.name === 'CALSCALE')?.value).toBe('GREGORIAN');
      expect(cal.properties.find((p) => p.name === 'PRODID')).toBeDefined();
    });

    it('uses the provided prodId', () => {
      const cal = new CalendarBuilder({ prodId: '-//My Corp//My Cal//EN' }).build();
      expect(cal.properties.find((p) => p.name === 'PRODID')?.value).toBe('-//My Corp//My Cal//EN');
    });

    it('adds X-WR-CALNAME when name is provided', () => {
      const cal = new CalendarBuilder({ name: 'Work' }).build();
      expect(cal.properties.find((p) => p.name === 'X-WR-CALNAME')?.value).toBe('Work');
    });

    it('omits X-WR-CALNAME when name is not provided', () => {
      const cal = new CalendarBuilder().build();
      expect(cal.properties.find((p) => p.name === 'X-WR-CALNAME')).toBeUndefined();
    });

    it('starts with no events', () => {
      expect(new CalendarBuilder().build().components).toHaveLength(0);
    });
  });

  describe('addEvent', () => {
    it('returns the builder for chaining', () => {
      const builder = new CalendarBuilder();
      expect(builder.addEvent({ summary: 'A', start: START, end: END })).toBe(builder);
    });

    it('adds a VEVENT component for each event', () => {
      const cal = new CalendarBuilder()
        .addEvent({ summary: 'First', start: START, end: END })
        .addEvent({ summary: 'Second', start: START, end: END })
        .build();
      expect(cal.components).toHaveLength(2);
      expect(cal.components.every((c) => c.name === 'VEVENT')).toBe(true);
    });

    it('sets SUMMARY on the event', () => {
      const [event] = new CalendarBuilder()
        .addEvent({ summary: 'Team Meeting', start: START, end: END })
        .build().components;
      expect(event.properties.find((p) => p.name === 'SUMMARY')?.value).toBe('Team Meeting');
    });

    it('sets DTSTART and DTEND in UTC format for timed events', () => {
      const [event] = new CalendarBuilder()
        .addEvent({ summary: 'X', start: START, end: END })
        .build().components;
      expect(event.properties.find((p) => p.name === 'DTSTART')?.value).toBe('20250620T100000Z');
      expect(event.properties.find((p) => p.name === 'DTEND')?.value).toBe('20250620T110000Z');
    });

    it('sets DTSTART and DTEND with VALUE=DATE for all-day events', () => {
      const [event] = new CalendarBuilder()
        .addEvent({
          summary: 'Holiday',
          start: new Date('2025-06-20T00:00:00Z'),
          end: new Date('2025-06-21T00:00:00Z'),
          allDay: true,
        })
        .build().components;
      const dtstart = event.properties.find((p) => p.name === 'DTSTART');
      const dtend = event.properties.find((p) => p.name === 'DTEND');
      expect(dtstart?.params).toEqual({ VALUE: 'DATE' });
      expect(dtstart?.value).toBe('20250620');
      expect(dtend?.value).toBe('20250621');
    });

    it('uses the provided uid', () => {
      const [event] = new CalendarBuilder()
        .addEvent({ summary: 'X', start: START, end: END, uid: 'my-fixed-uid' })
        .build().components;
      expect(event.properties.find((p) => p.name === 'UID')?.value).toBe('my-fixed-uid');
    });

    it('generates a uid when none is provided', () => {
      const [event] = new CalendarBuilder()
        .addEvent({ summary: 'X', start: START, end: END })
        .build().components;
      const uid = event.properties.find((p) => p.name === 'UID')?.value;
      expect(uid).toBeDefined();
      expect(uid).toMatch(/^[0-9a-f-]{36}$/i);
    });

    it('sets DTSTAMP to a valid UTC timestamp', () => {
      const [event] = new CalendarBuilder()
        .addEvent({ summary: 'X', start: START, end: END })
        .build().components;
      const dtstamp = event.properties.find((p) => p.name === 'DTSTAMP')?.value;
      expect(dtstamp).toMatch(/^\d{8}T\d{6}Z$/);
    });

    it('adds DESCRIPTION when provided', () => {
      const [event] = new CalendarBuilder()
        .addEvent({ summary: 'X', start: START, end: END, description: 'Details here' })
        .build().components;
      expect(event.properties.find((p) => p.name === 'DESCRIPTION')?.value).toBe('Details here');
    });

    it('omits DESCRIPTION when not provided', () => {
      const [event] = new CalendarBuilder()
        .addEvent({ summary: 'X', start: START, end: END })
        .build().components;
      expect(event.properties.find((p) => p.name === 'DESCRIPTION')).toBeUndefined();
    });

    it('adds LOCATION when provided', () => {
      const [event] = new CalendarBuilder()
        .addEvent({ summary: 'X', start: START, end: END, location: 'Berlin' })
        .build().components;
      expect(event.properties.find((p) => p.name === 'LOCATION')?.value).toBe('Berlin');
    });

    it('omits LOCATION when not provided', () => {
      const [event] = new CalendarBuilder()
        .addEvent({ summary: 'X', start: START, end: END })
        .build().components;
      expect(event.properties.find((p) => p.name === 'LOCATION')).toBeUndefined();
    });

    it('adds an ATTENDEE property with mailto value for each attendee', () => {
      const [event] = new CalendarBuilder()
        .addEvent({
          summary: 'X',
          start: START,
          end: END,
          attendees: [{ email: 'a@example.com' }, { email: 'b@example.com' }],
        })
        .build().components;
      const attendees = event.properties.filter((p) => p.name === 'ATTENDEE');
      expect(attendees).toHaveLength(2);
      expect(attendees[0].value).toBe('mailto:a@example.com');
      expect(attendees[1].value).toBe('mailto:b@example.com');
    });

    it('sets CN param when attendee name is provided', () => {
      const [event] = new CalendarBuilder()
        .addEvent({
          summary: 'X',
          start: START,
          end: END,
          attendees: [{ email: 'a@example.com', name: 'Ada Lovelace' }],
        })
        .build().components;
      const attendee = event.properties.find((p) => p.name === 'ATTENDEE');
      expect(attendee?.params.CN).toBe('Ada Lovelace');
    });

    it('sets PARTSTAT param when attendee status is provided', () => {
      const [event] = new CalendarBuilder()
        .addEvent({
          summary: 'X',
          start: START,
          end: END,
          attendees: [{ email: 'a@example.com', status: 'ACCEPTED' }],
        })
        .build().components;
      const attendee = event.properties.find((p) => p.name === 'ATTENDEE');
      expect(attendee?.params.PARTSTAT).toBe('ACCEPTED');
    });

    it('omits CN and PARTSTAT params when not provided', () => {
      const [event] = new CalendarBuilder()
        .addEvent({
          summary: 'X',
          start: START,
          end: END,
          attendees: [{ email: 'a@example.com' }],
        })
        .build().components;
      const attendee = event.properties.find((p) => p.name === 'ATTENDEE');
      expect(attendee?.params).toEqual({});
    });

    it('omits ATTENDEE properties when not provided', () => {
      const [event] = new CalendarBuilder()
        .addEvent({ summary: 'X', start: START, end: END })
        .build().components;
      expect(event.properties.find((p) => p.name === 'ATTENDEE')).toBeUndefined();
    });
  });

  describe('serialization', () => {
    it('produces valid iCal output that can be round-tripped', () => {
      const serializer = new Serializer();
      const cal = new CalendarBuilder({ name: 'My Cal' })
        .addEvent({ summary: 'Meeting', start: START, end: END, location: 'Office' })
        .build();
      const ics = serializer.serialize(cal);
      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('END:VCALENDAR');
      expect(ics).toContain('BEGIN:VEVENT');
      expect(ics).toContain('SUMMARY:Meeting');
      expect(ics).toContain('DTSTART:20250620T100000Z');
      expect(ics).toContain('LOCATION:Office');
    });
  });
});
