import { Calendar } from '../src/Calendar';

const icsString = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Example//EN',
  'BEGIN:VEVENT',
  'UID:meeting1@example.com',
  'DTSTART:20250601T090000Z',
  'DTEND:20250601T100000Z',
  'SUMMARY:Team Meeting',
  'CATEGORIES:WORK',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:lunch@example.com',
  'DTSTART:20250601T120000Z',
  'DTEND:20250601T130000Z',
  'SUMMARY:Lunch with Alice',
  'CATEGORIES:PERSONAL',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:meeting2@example.com',
  'DTSTART:20250602T100000Z',
  'DTEND:20250602T110000Z',
  'SUMMARY:Sprint Planning',
  'CATEGORIES:WORK',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const calendar = Calendar.create();
const component = calendar.parse(icsString);
const eventCount = (cal: ReturnType<typeof calendar.parse>): number =>
  cal.components.filter((c) => c.name === 'VEVENT').length;

// Remove all events whose SUMMARY contains "Meeting"
const withoutMeetings = calendar.filterEvents(component, {
  property: 'SUMMARY',
  pattern: /Meeting/,
});
console.log('Events after removing "Meeting" events:', eventCount(withoutMeetings)); // 1

// Keep only WORK category events
const workOnly = calendar.keepEvents(component, {
  property: 'CATEGORIES',
  pattern: /WORK/,
});
console.log('Work-only events:', eventCount(workOnly)); // 2
