import { parseDatetimeValue } from './datetime';

const BYDAY_MAP: Record<string, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_OCCURRENCES = 10_000;

type RRuleFreq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

interface ParsedRRule {
  freq: RRuleFreq;
  interval: number;
  count?: number;
  until?: Date;
  byday: number[];
  bymonthday: number[];
}

function parseRRule(rrule: string): ParsedRRule {
  const parts: Record<string, string> = {};
  for (const part of rrule.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx > 0) parts[part.substring(0, eqIdx)] = part.substring(eqIdx + 1);
  }

  const freq = parts['FREQ'];
  if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY' && freq !== 'YEARLY') {
    throw new Error(`Unsupported or missing RRULE FREQ: ${freq ?? 'missing'}`);
  }

  return {
    freq,
    interval: parts['INTERVAL'] ? parseInt(parts['INTERVAL'], 10) : 1,
    count: parts['COUNT'] ? parseInt(parts['COUNT'], 10) : undefined,
    until: parts['UNTIL'] ? (parseDatetimeValue(parts['UNTIL']) ?? undefined) : undefined,
    byday: parts['BYDAY']
      ? parts['BYDAY']
          .split(',')
          .map((d) => BYDAY_MAP[d.replace(/^[+-]?\d+/, '')])
          .filter((d): d is number => d !== undefined)
      : [],
    bymonthday: parts['BYMONTHDAY']
      ? parts['BYMONTHDAY'].split(',').map((d) => parseInt(d, 10))
      : [],
  };
}

export class RRuleExpander {
  public expand(dtstart: Date, rrule: string, from: Date, to: Date): Date[] {
    const rule = parseRRule(rrule);
    const effectiveTo = rule.until
      ? new Date(Math.min(to.getTime(), rule.until.getTime()))
      : to;

    const results: Date[] = [];
    if (rule.freq === 'DAILY') this.expandDaily(dtstart, rule, from, effectiveTo, results);
    else if (rule.freq === 'WEEKLY') this.expandWeekly(dtstart, rule, from, effectiveTo, results);
    else if (rule.freq === 'MONTHLY') this.expandMonthly(dtstart, rule, from, effectiveTo, results);
    else this.expandYearly(dtstart, rule, from, effectiveTo, results);
    return results;
  }

  private record(results: Date[], rule: ParsedRRule, candidate: Date, from: Date, to: Date): boolean {
    if (candidate >= from && candidate <= to) results.push(new Date(candidate));
    return rule.count !== undefined && results.length >= rule.count;
  }

  private expandDaily(dtstart: Date, rule: ParsedRRule, from: Date, to: Date, results: Date[]): void {
    let current = new Date(dtstart);
    while (current <= to && results.length < MAX_OCCURRENCES) {
      if (this.record(results, rule, current, from, to)) return;
      current = new Date(current.getTime() + rule.interval * DAY_MS);
    }
  }

  private expandWeekly(dtstart: Date, rule: ParsedRRule, from: Date, to: Date, results: Date[]): void {
    const byday = rule.byday.length > 0 ? rule.byday : [dtstart.getUTCDay()];
    const sorted = byday.slice().sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));

    const dstartDay = dtstart.getUTCDay();
    const daysFromMon = dstartDay === 0 ? 6 : dstartDay - 1;
    let weekStart = new Date(
      Date.UTC(dtstart.getUTCFullYear(), dtstart.getUTCMonth(), dtstart.getUTCDate() - daysFromMon),
    );

    while (weekStart <= to && results.length < MAX_OCCURRENCES) {
      for (const dayNum of sorted) {
        const dFM = dayNum === 0 ? 6 : dayNum - 1;
        const candidate = new Date(
          Date.UTC(
            weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() + dFM,
            dtstart.getUTCHours(), dtstart.getUTCMinutes(), dtstart.getUTCSeconds(),
          ),
        );
        if (candidate < dtstart) continue;
        if (this.record(results, rule, candidate, from, to)) return;
      }
      weekStart = new Date(weekStart.getTime() + rule.interval * 7 * DAY_MS);
    }
  }

  private expandMonthly(dtstart: Date, rule: ParsedRRule, from: Date, to: Date, results: Date[]): void {
    const days = rule.bymonthday.length > 0 ? rule.bymonthday : [dtstart.getUTCDate()];
    let year = dtstart.getUTCFullYear();
    let month = dtstart.getUTCMonth();

    while (results.length < MAX_OCCURRENCES) {
      if (new Date(Date.UTC(year, month, 1)) > to) break;
      for (const day of days) {
        const candidate = new Date(
          Date.UTC(year, month, day, dtstart.getUTCHours(), dtstart.getUTCMinutes(), dtstart.getUTCSeconds()),
        );
        if (candidate.getUTCMonth() !== month) continue; // invalid date (e.g. Feb 30)
        if (candidate < dtstart) continue;
        if (this.record(results, rule, candidate, from, to)) return;
      }
      month += rule.interval;
      if (month >= 12) { year += Math.floor(month / 12); month %= 12; }
    }
  }

  private expandYearly(dtstart: Date, rule: ParsedRRule, from: Date, to: Date, results: Date[]): void {
    let current = new Date(dtstart);
    while (current <= to && results.length < MAX_OCCURRENCES) {
      if (this.record(results, rule, current, from, to)) return;
      current = new Date(
        Date.UTC(
          current.getUTCFullYear() + rule.interval, current.getUTCMonth(), current.getUTCDate(),
          current.getUTCHours(), current.getUTCMinutes(), current.getUTCSeconds(),
        ),
      );
    }
  }
}
