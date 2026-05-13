export function parseDatetimeValue(value: string): Date | null {
  const dateOnly = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnly) {
    return new Date(Date.UTC(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3]));
  }
  const datetime = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (datetime) {
    return new Date(
      Date.UTC(+datetime[1], +datetime[2] - 1, +datetime[3], +datetime[4], +datetime[5], +datetime[6]),
    );
  }
  return null;
}

export function formatUtcDatetime(date: Date): string {
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}
