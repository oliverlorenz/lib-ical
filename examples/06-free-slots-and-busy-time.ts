import { Calendar } from '../src/Calendar';

const icsString = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Example//EN',
  'BEGIN:VEVENT',
  'UID:morning@example.com',
  'DTSTART:20250602T090000Z',
  'DTEND:20250602T110000Z',
  'SUMMARY:Morning Block',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:afternoon@example.com',
  'DTSTART:20250602T140000Z',
  'DTEND:20250602T160000Z',
  'SUMMARY:Afternoon Block',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const calendar = Calendar.create();
const component = calendar.parse(icsString);

// Work day window: 08:00–18:00 UTC
const from = new Date('2025-06-02T08:00:00Z');
const to = new Date('2025-06-02T18:00:00Z');

// Find free slots of at least 30 minutes
const MIN_30_MIN = 30 * 60 * 1000;
const freeSlots = calendar.findFreeSlots(component, from, to, MIN_30_MIN);

console.log('Free slots ≥ 30 min on June 2:');
for (const slot of freeSlots) {
  const start = slot.properties.find((p) => p.name === 'DTSTART')?.value ?? '?';
  const end = slot.properties.find((p) => p.name === 'DTEND')?.value ?? '?';
  console.log(`  ${start} → ${end}`);
}

// Measure how much of the window is occupied
const busyMs = calendar.countBusyTime(component, from, to);
const totalMs = to.getTime() - from.getTime();
console.log(`\nBusy:  ${busyMs / 3_600_000} h`);
console.log(`Free:  ${(totalMs - busyMs) / 3_600_000} h`);

// invert() produces a VCALENDAR whose VEVENTs are the gaps between booked events
const freeCalendar = calendar.invert(component, from, to);
console.log(
  `\nInverted calendar has ${freeCalendar.components.filter((c) => c.name === 'VEVENT').length} free-time event(s).`,
);
