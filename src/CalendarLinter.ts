import { ICalComponent } from './types';

export interface LintRule {
  name: string;
  check(event: ICalComponent): boolean;
  message: string;
}

export interface LintIssue {
  uid: string;
  summary?: string;
  rule: string;
  message: string;
}

const missingAttendeesRule: LintRule = {
  name: 'missing-attendees',
  check: (event) => !event.properties.some((p) => p.name === 'ATTENDEE'),
  message: 'Event has no attendees',
};

const missingLocationRule: LintRule = {
  name: 'missing-location',
  check: (event) => !event.properties.some((p) => p.name === 'LOCATION' && p.value.trim() !== ''),
  message: 'Event has no location',
};

export const defaultLintRules: ReadonlyArray<LintRule> = [
  missingAttendeesRule,
  missingLocationRule,
];

export class CalendarLinter {
  public lint(
    component: ICalComponent,
    rules: ReadonlyArray<LintRule> = defaultLintRules,
  ): LintIssue[] {
    const issues: LintIssue[] = [];

    for (const event of component.components) {
      if (event.name !== 'VEVENT') continue;

      const uid = event.properties.find((p) => p.name === 'UID')?.value ?? '';
      const summary = event.properties.find((p) => p.name === 'SUMMARY')?.value;

      for (const rule of rules) {
        if (rule.check(event)) {
          issues.push({ uid, summary, rule: rule.name, message: rule.message });
        }
      }
    }

    return issues;
  }
}
