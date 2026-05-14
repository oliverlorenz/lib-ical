import { Calendar } from '../src/Calendar';

const workCalendar = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Work//EN',
  'BEGIN:VEVENT',
  'UID:review@work.example',
  'DTSTART:20250603T100000Z',
  'DTEND:20250603T110000Z',
  'SUMMARY:Quarterly Review',
  'LOCATION:Board Room',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const personalCalendar = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Personal//EN',
  'BEGIN:VEVENT',
  'UID:dentist@personal.example',
  'DTSTART:20250604T140000Z',
  'DTEND:20250604T150000Z',
  'SUMMARY:Dentist Appointment',
  'DESCRIPTION:Bring insurance card',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const calendar = Calendar.create();
const work = calendar.parse(workCalendar);
const personal = calendar.parse(personalCalendar);

// Strip personal data before sharing
const anonPersonal = calendar.anonymize(personal);
const anonEvent = anonPersonal.components.find((c) => c.name === 'VEVENT');
console.log('Anonymized summary:', anonEvent?.properties.find((p) => p.name === 'SUMMARY')?.value);
console.log(
  'DESCRIPTION removed:',
  !anonEvent?.properties.some((p) => p.name === 'DESCRIPTION'),
);

// Merge both calendars into one
const merged = calendar.merge(work, anonPersonal);
console.log(`\nMerged calendar has ${merged.components.filter((c) => c.name === 'VEVENT').length} event(s).`);
