import { Calendar } from '../src/Calendar';

const beforeIcs = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Example//EN',
  'BEGIN:VEVENT',
  'UID:event-a@example.com',
  'DTSTART:20250601T090000Z',
  'DTEND:20250601T100000Z',
  'SUMMARY:Workshop',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:event-b@example.com',
  'DTSTART:20250601T110000Z',
  'DTEND:20250601T120000Z',
  'SUMMARY:Lunch',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

// Workshop moved by one hour, Lunch removed, new Code Review added
const afterIcs = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Example//EN',
  'BEGIN:VEVENT',
  'UID:event-a@example.com',
  'DTSTART:20250601T100000Z',
  'DTEND:20250601T110000Z',
  'SUMMARY:Workshop',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:event-c@example.com',
  'DTSTART:20250601T140000Z',
  'DTEND:20250601T150000Z',
  'SUMMARY:Code Review',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const calendar = Calendar.create();
const before = calendar.parse(beforeIcs);
const after = calendar.parse(afterIcs);

const summary = (events: ReturnType<typeof calendar.parse>['components']): string =>
  events.map((e) => e.properties.find((p) => p.name === 'SUMMARY')?.value ?? '?').join(', ') ||
  '(none)';

const { added, removed, changed } = calendar.diff(before, after);
console.log('Added:  ', summary(added));
console.log('Removed:', summary(removed));
console.log('Changed:', summary(changed));
