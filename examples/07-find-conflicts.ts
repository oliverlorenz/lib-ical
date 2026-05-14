import { Calendar } from '../src/Calendar';

const icsString = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Example//EN',
  'BEGIN:VEVENT',
  'UID:design-review@example.com',
  'DTSTART:20250603T100000Z',
  'DTEND:20250603T110000Z',
  'SUMMARY:Design Review',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:team-sync@example.com',
  'DTSTART:20250603T103000Z',
  'DTEND:20250603T120000Z',
  'SUMMARY:Team Sync',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:lunch@example.com',
  'DTSTART:20250603T130000Z',
  'DTEND:20250603T140000Z',
  'SUMMARY:Lunch',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const calendar = Calendar.create();
const component = calendar.parse(icsString);

const from = new Date('2025-06-03T00:00:00Z');
const to = new Date('2025-06-03T23:59:59Z');

const conflicts = calendar.findConflicts(component, from, to);

if (conflicts.length === 0) {
  console.log('No conflicts found.');
} else {
  console.log(`${conflicts.length} conflict(s) detected:`);
  for (const { first, second } of conflicts) {
    const a = first.properties.find((p) => p.name === 'SUMMARY')?.value ?? '?';
    const b = second.properties.find((p) => p.name === 'SUMMARY')?.value ?? '?';
    console.log(`  "${a}" overlaps with "${b}"`);
  }
}
