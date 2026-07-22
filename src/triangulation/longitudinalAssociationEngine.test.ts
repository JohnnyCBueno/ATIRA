import { describe, expect, it } from 'vitest';
import { DailyMetricPoint } from './contracts';
import { analyzeLongitudinalAssociation } from './longitudinalAssociationEngine';

describe('longitudinal association engine', () => {
  it('establishes a repeated cross-source association without implying causation', () => {
    const sleep = series('sleep', 'Sleep duration', 'hours', 'health', 30, (index) => 6 + (index % 5) * 0.5);
    const engagement = series('engagement', 'desktop engagement', 'minutes', 'desktop', 30, (index) => 700 - (6 + (index % 5) * 0.5) * 60);
    const result = analyzeLongitudinalAssociation(sleep, engagement);

    expect(result.association).toMatchObject({ maturity: 'established', pairedDayCount: 30, sources: ['desktop', 'health'] });
    expect(result.association?.coefficient).toBeLessThan(-0.9);
    expect(result.association?.summary).toContain('not evidence that one caused the other');
  });

  it('blocks a cross-source claim when both metrics come from one source', () => {
    const first = series('interactive', 'interaction', 'minutes', 'desktop', 30, (index) => index);
    const second = series('passive', 'passive time', 'minutes', 'desktop', 30, (index) => index * 2);
    const result = analyzeLongitudinalAssociation(first, second);
    expect(result.association).toBeUndefined();
    expect(result.blockedReasons[0]).toContain('two independent source types');
  });

  it('does not treat a declared calendar metric as observed behaviour', () => {
    const plans = series('planned-focus', 'planned focus', 'minutes', 'calendar', 30, (index) => index, 'declared');
    const activity = series('engagement', 'desktop engagement', 'minutes', 'desktop', 30, (index) => index * 2);
    const result = analyzeLongitudinalAssociation(plans, activity);
    expect(result.association).toBeUndefined();
    expect(result.blockedReasons.join(' ')).toContain('Declared intentions');
  });

  it('blocks sparse and low-coverage periods rather than treating them as zeroes', () => {
    const health = series('sleep', 'Sleep', 'hours', 'health', 30, (index) => index, 'observed', (index) => index < 6 ? 100 : 20);
    const desktop = series('engagement', 'Engagement', 'minutes', 'desktop', 30, (index) => index * 2);
    const result = analyzeLongitudinalAssociation(health, desktop);
    expect(result.association).toBeUndefined();
    expect(result.pairedDayCount).toBe(6);
    expect(result.blockedReasons.join(' ')).toContain('sufficiently covered paired days');
  });

  it('does not report an association when a metric has no variation', () => {
    const health = series('sleep', 'Sleep', 'hours', 'health', 30, () => 8);
    const desktop = series('engagement', 'Engagement', 'minutes', 'desktop', 30, (index) => index);
    const result = analyzeLongitudinalAssociation(health, desktop);
    expect(result.association).toBeUndefined();
    expect(result.blockedReasons[0]).toContain('no variation');
  });
});

function series(
  metricId: string,
  label: string,
  unit: string,
  source: DailyMetricPoint['source'],
  count: number,
  value: (index: number) => number,
  role: DailyMetricPoint['role'] = 'observed',
  coverage: (index: number) => number = () => 100,
): DailyMetricPoint[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(2026, 5, 1 + index));
    const dayId = date.toISOString().slice(0, 10);
    return {
      id: `${metricId}-${dayId}`,
      dayId,
      metricId,
      label,
      value: value(index),
      unit,
      source,
      role,
      coveragePercent: coverage(index),
      observationIds: [`observation-${metricId}-${dayId}`],
    };
  });
}
