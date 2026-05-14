import { Calendar } from '../src/Calendar';

const icsString = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Example Corp//Calendar//EN',
  'BEGIN:VEVENT',
  'UID:standup@example.com',
  'DTSTART:20250601T090000Z',
  'DTEND:20250601T093000Z',
  'SUMMARY:Weekly Standup',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const calendar = Calendar.create();
const component = calendar.parse(icsString);

const events = component.components.filter((c) => c.name === 'VEVENT');
console.log(`Parsed ${events.length} event(s):`);
for (const event of events) {
  const summary = event.properties.find((p) => p.name === 'SUMMARY')?.value ?? '(no title)';
  const start = event.properties.find((p) => p.name === 'DTSTART')?.value ?? '?';
  console.log(`  - ${summary} @ ${start}`);
}

const output = calendar.serialize(component);
console.log('\nRound-trip output:');
console.log(output);
