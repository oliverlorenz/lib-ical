import { ICalProperty } from './types';

function resolveTzidOffsetMinutes(tz: string, utcGuess: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
    .formatToParts(utcGuess)
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  const hour = parts.hour === '24' ? 0 : +parts.hour;
  const asUtc = Date.UTC(
    +parts.year,
    +parts.month - 1,
    +parts.day,
    hour,
    +parts.minute,
    +parts.second,
  );
  return (asUtc - utcGuess.getTime()) / 60_000;
}

function resolveTzidToUtc(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  tzid: string,
): Date {
  const utcGuess = new Date(Date.UTC(year, monthIndex, day, hour, minute, second));
  const offsetMinutes = resolveTzidOffsetMinutes(tzid, utcGuess);
  return new Date(utcGuess.getTime() - offsetMinutes * 60_000);
}

export function parseDatetimeValue(value: string, tzid?: string): Date | null {
  const dateOnly = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnly) {
    return new Date(Date.UTC(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3]));
  }
  const datetime = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (datetime) {
    const [, year, month, day, hour, minute, second, zulu] = datetime as unknown as string[];
    if (!zulu && tzid) {
      return resolveTzidToUtc(+year, +month - 1, +day, +hour, +minute, +second, tzid);
    }
    return new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute, +second));
  }
  return null;
}

export function parsePropertyDatetime(prop: ICalProperty | undefined): Date | null {
  if (!prop) return null;
  return parseDatetimeValue(prop.value, prop.params.TZID);
}

export function formatUtcDatetime(date: Date): string {
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}
