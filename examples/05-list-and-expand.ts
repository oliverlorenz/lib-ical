import { Calendar } from '../src/Calendar';

const icsString = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Example//EN',
  'BEGIN:VEVENT',
  'UID:standup@example.com',
  'DTSTART:20250101T090000Z',
  'DTEND:20250101T093000Z',
  'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR',
  'SUMMARY:Standup',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:planning@example.com',
  'DTSTART:20250103T100000Z',
  'DTEND:20250103T110000Z',
  'SUMMARY:Sprint Planning',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const calendar = Calendar.create();
const component = calendar.parse(icsString);

const from = new Date('2025-01-01T00:00:00Z');
const to = new Date('2025-01-31T23:59:59Z');

// listEvents expands recurring events and returns individual occurrences
const events = calendar.listEvents(component, from, to);
console.log(`Events in January 2025: ${events.length}`);
for (const event of events) {
  const summary = event.properties.find((p) => p.name === 'SUMMARY')?.value ?? '(no title)';
  const start = event.properties.find((p) => p.name === 'DTSTART')?.value ?? '?';
  console.log(`  ${start}  ${summary}`);
}

// expandRecurring converts the base recurring event into individual VEVENTs in the component tree
const expanded = calendar.expandRecurring(component, from, to);
const hasRrule = expanded.components
  .filter((c) => c.name === 'VEVENT')
  .some((c) => c.properties.some((p) => p.name === 'RRULE'));
console.log(`\nExpanded component still contains RRULE: ${hasRrule}`); // false
console.log(
  `Expanded VEVENTs: ${expanded.components.filter((c) => c.name === 'VEVENT').length}`,
);
