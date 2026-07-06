import { ICalComponent } from './types';
import { Parser } from './Parser';
import { Serializer } from './Serializer';
import { Anonymizer } from './Anonymizer';
import { Merger } from './Merger';
import { RangeCleaner } from './RangeCleaner';
import { EventFilter, EventFilterCriteria } from './EventFilter';
import { EventLister } from './EventLister';
import { CalendarInverter } from './CalendarInverter';
import { RecurringExpander } from './RecurringExpander';
import { ConflictFinder } from './ConflictFinder';
import type { ConflictPair } from './ConflictFinder';
import { CalendarDiff } from './CalendarDiff';
import type { CalendarDiffResult } from './CalendarDiff';
import { FreeSlotFinder } from './FreeSlotFinder';
import { BusyTimeCounter } from './BusyTimeCounter';
import { CalendarBuilder } from './CalendarBuilder';
import type { CalendarBuilderOptions } from './CalendarBuilder';
import { CalendarLinter } from './CalendarLinter';
import type { LintIssue, LintRule } from './CalendarLinter';

export class Calendar {
  public static create(): Calendar {
    return new Calendar(
      new Parser(),
      new Serializer(),
      new Anonymizer(),
      new Merger(),
      new RangeCleaner(),
      new EventFilter(),
      new EventLister(),
      new CalendarInverter(),
      new RecurringExpander(),
      new ConflictFinder(),
      new CalendarDiff(),
      new FreeSlotFinder(),
      new BusyTimeCounter(),
      new CalendarLinter(),
    );
  }

  constructor(
    private readonly parser: Parser,
    private readonly serializer: Serializer,
    private readonly anonymizer: Anonymizer,
    private readonly merger: Merger,
    private readonly rangeCleaner: RangeCleaner,
    private readonly eventFilter: EventFilter = new EventFilter(),
    private readonly eventLister: EventLister = new EventLister(),
    private readonly calendarInverter: CalendarInverter = new CalendarInverter(),
    private readonly recurringExpander: RecurringExpander = new RecurringExpander(),
    private readonly conflictFinder: ConflictFinder = new ConflictFinder(),
    private readonly calendarDiff: CalendarDiff = new CalendarDiff(),
    private readonly freeSlotFinder: FreeSlotFinder = new FreeSlotFinder(),
    private readonly busyTimeCounter: BusyTimeCounter = new BusyTimeCounter(),
    private readonly calendarLinter: CalendarLinter = new CalendarLinter(),
  ) {}

  public parse(input: string): ICalComponent {
    return this.parser.parse(input);
  }

  public async loadFromUrl(url: string): Promise<ICalComponent> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch iCal from ${url}: ${response.status} ${response.statusText}`,
      );
    }
    return this.parser.parse(await response.text());
  }

  public serialize(component: ICalComponent): string {
    return this.serializer.serialize(component);
  }

  public anonymize(component: ICalComponent): ICalComponent {
    return this.anonymizer.anonymize(component);
  }

  public merge(first: ICalComponent, ...rest: ICalComponent[]): ICalComponent {
    return this.merger.merge(first, ...rest);
  }

  public cleanRange(component: ICalComponent, start: Date, end: Date): ICalComponent {
    return this.rangeCleaner.clean(component, start, end);
  }

  public cleanRanges(component: ICalComponent, ranges: ReadonlyArray<[Date, Date]>): ICalComponent {
    return this.rangeCleaner.cleanRanges(component, ranges);
  }

  public filterEvents(component: ICalComponent, ...criteria: EventFilterCriteria[]): ICalComponent {
    return this.eventFilter.filter(component, criteria);
  }

  public keepEvents(component: ICalComponent, ...criteria: EventFilterCriteria[]): ICalComponent {
    return this.eventFilter.keep(component, criteria);
  }

  public listEvents(component: ICalComponent, from: Date, to: Date): ICalComponent[] {
    return this.eventLister.list(component, from, to);
  }

  public invert(component: ICalComponent, from: Date, to: Date): ICalComponent {
    return this.calendarInverter.invert(component, from, to);
  }

  public expandRecurring(component: ICalComponent, from: Date, to: Date): ICalComponent {
    return this.recurringExpander.expand(component, from, to);
  }

  public findConflicts(component: ICalComponent, from: Date, to: Date): ConflictPair[] {
    return this.conflictFinder.find(component, from, to);
  }

  public diff(before: ICalComponent, after: ICalComponent): CalendarDiffResult {
    return this.calendarDiff.diff(before, after);
  }

  public findFreeSlots(
    component: ICalComponent,
    from: Date,
    to: Date,
    minDurationMs: number = 0,
  ): ICalComponent[] {
    return this.freeSlotFinder.find(component, from, to, minDurationMs);
  }

  public countBusyTime(component: ICalComponent, from: Date, to: Date): number {
    return this.busyTimeCounter.count(component, from, to);
  }

  public buildCalendar(options?: CalendarBuilderOptions): CalendarBuilder {
    return new CalendarBuilder(options);
  }

  public lint(component: ICalComponent, rules?: ReadonlyArray<LintRule>): LintIssue[] {
    return this.calendarLinter.lint(component, rules);
  }
}
