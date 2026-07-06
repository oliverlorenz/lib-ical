import { Calendar } from '../src/Calendar';

const icsString = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Example//EN',
  'BEGIN:VEVENT',
  'UID:well-filled@example.com',
  'DTSTART:20250603T100000Z',
  'DTEND:20250603T110000Z',
  'SUMMARY:Design Review',
  'LOCATION:Room 1',
  'ATTENDEE:mailto:alice@example.com',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:sparse@example.com',
  'DTSTART:20250603T130000Z',
  'DTEND:20250603T140000Z',
  'SUMMARY:Quick Sync',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const calendar = Calendar.create();
const component = calendar.parse(icsString);

const issues = calendar.lint(component);

for (const issue of issues) {
  console.log(`${issue.uid} (${issue.summary ?? 'no summary'}): [${issue.rule}] ${issue.message}`);
}
