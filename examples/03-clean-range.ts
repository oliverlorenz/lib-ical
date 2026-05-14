import { Calendar } from '../src/Calendar';

// Daily standup recurring Monday–Friday; block the holiday week
const icsString = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Example//EN',
  'BEGIN:VEVENT',
  'UID:standup@example.com',
  'DTSTART:20250101T090000Z',
  'DTEND:20250101T093000Z',
  'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
  'SUMMARY:Daily Standup',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const calendar = Calendar.create();
const component = calendar.parse(icsString);

// Remove occurrences during the week of June 23–27
const cleaned = calendar.cleanRange(
  component,
  new Date('2025-06-23T00:00:00Z'),
  new Date('2025-06-28T00:00:00Z'),
);

const juneFrom = new Date('2025-06-01T00:00:00Z');
const juneTo = new Date('2025-06-30T23:59:59Z');
const remaining = calendar.listEvents(cleaned, juneFrom, juneTo);

console.log(`Events remaining in June: ${remaining.length} (holiday week removed)`);
for (const event of remaining) {
  const start = event.properties.find((p) => p.name === 'DTSTART')?.value ?? '?';
  console.log(`  ${start}`);
}
