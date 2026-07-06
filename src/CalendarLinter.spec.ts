import { CalendarLinter, LintRule } from './CalendarLinter';
import { ICalComponent } from './types';

const linter = new CalendarLinter();

function makeEvent(
  uid: string,
  extra: { attendee?: string; location?: string; summary?: string } = {},
): ICalComponent {
  const properties = [{ name: 'UID', params: {}, value: uid }];
  if (extra.summary !== undefined) {
    properties.push({ name: 'SUMMARY', params: {}, value: extra.summary });
  }
  if (extra.attendee !== undefined) {
    properties.push({ name: 'ATTENDEE', params: {}, value: extra.attendee });
  }
  if (extra.location !== undefined) {
    properties.push({ name: 'LOCATION', params: {}, value: extra.location });
  }
  return { name: 'VEVENT', properties, components: [] };
}

function makeCalendar(...events: ICalComponent[]): ICalComponent {
  return { name: 'VCALENDAR', properties: [], components: events };
}

describe('CalendarLinter', () => {
  it('returns no issues for a calendar with no events', () => {
    expect(linter.lint(makeCalendar())).toHaveLength(0);
  });

  it('ignores non-VEVENT components', () => {
    const cal: ICalComponent = {
      name: 'VCALENDAR',
      properties: [],
      components: [{ name: 'VTIMEZONE', properties: [], components: [] }],
    };
    expect(linter.lint(cal)).toHaveLength(0);
  });

  it('returns no issues for a well-filled-out event', () => {
    const cal = makeCalendar(
      makeEvent('a', { attendee: 'mailto:a@example.com', location: 'Room 1' }),
    );
    expect(linter.lint(cal)).toHaveLength(0);
  });

  it('flags an event with no attendees', () => {
    const cal = makeCalendar(makeEvent('a', { location: 'Room 1' }));
    const issues = linter.lint(cal);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toEqual({
      uid: 'a',
      summary: undefined,
      rule: 'missing-attendees',
      message: 'Event has no attendees',
    });
  });

  it('flags an event with no location', () => {
    const cal = makeCalendar(makeEvent('a', { attendee: 'mailto:a@example.com' }));
    const issues = linter.lint(cal);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.rule).toBe('missing-location');
  });

  it('flags an event with an empty location value', () => {
    const cal = makeCalendar(makeEvent('a', { attendee: 'mailto:a@example.com', location: '   ' }));
    const issues = linter.lint(cal);
    expect(issues.map((i) => i.rule)).toContain('missing-location');
  });

  it('flags an event with neither attendees nor location', () => {
    const cal = makeCalendar(makeEvent('a'));
    const issues = linter.lint(cal);
    expect(issues.map((i) => i.rule).sort()).toEqual(['missing-attendees', 'missing-location']);
  });

  it('includes the summary when present', () => {
    const cal = makeCalendar(makeEvent('a', { summary: 'Standup' }));
    const issues = linter.lint(cal);
    expect(issues.every((i) => i.summary === 'Standup')).toBe(true);
  });

  it('reports issues per event across multiple events', () => {
    const cal = makeCalendar(
      makeEvent('a'),
      makeEvent('b', { attendee: 'mailto:b@example.com', location: 'Room 2' }),
    );
    const issues = linter.lint(cal);
    expect(issues.every((i) => i.uid === 'a')).toBe(true);
    expect(issues).toHaveLength(2);
  });

  it('defaults uid to an empty string when UID is missing', () => {
    const eventWithoutUid: ICalComponent = { name: 'VEVENT', properties: [], components: [] };
    const cal = makeCalendar(eventWithoutUid);
    const issues = linter.lint(cal);
    expect(issues.every((i) => i.uid === '')).toBe(true);
  });

  it('accepts a custom rule set', () => {
    const noSummaryRule: LintRule = {
      name: 'missing-summary',
      check: (event) => !event.properties.some((p) => p.name === 'SUMMARY'),
      message: 'Event has no summary',
    };
    const cal = makeCalendar(makeEvent('a'));
    const issues = linter.lint(cal, [noSummaryRule]);
    expect(issues).toEqual([
      { uid: 'a', summary: undefined, rule: 'missing-summary', message: 'Event has no summary' },
    ]);
  });
});
