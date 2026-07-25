import { describe, expect, it } from 'vitest';
import { dayIdsForTimelinePeriod, isLiveTimelinePeriod } from './timelinePeriod';

describe('timeline period boundaries', () => {
  it('clips a day to its one local calendar date', () => {
    expect(dayIdsForTimelinePeriod('day', '2026-07-25')).toEqual(['2026-07-25']);
  });

  it('uses the Monday-to-Sunday week containing the selected day', () => {
    expect(dayIdsForTimelinePeriod('week', '2026-07-25')).toEqual([
      '2026-07-20',
      '2026-07-21',
      '2026-07-22',
      '2026-07-23',
      '2026-07-24',
      '2026-07-25',
      '2026-07-26',
    ]);
  });

  it('clips a month to every local calendar date in that month', () => {
    const ids = dayIdsForTimelinePeriod('month', '2026-07-25');

    expect(ids).toHaveLength(31);
    expect(ids[0]).toBe('2026-07-01');
    expect(ids[30]).toBe('2026-07-31');
  });
});

describe('live timeline map', () => {
  const now = new Date(2026, 6, 25, 9, 30);

  it('is live only for the current local day in day view', () => {
    expect(isLiveTimelinePeriod('day', '2026-07-25', now)).toBe(true);
    expect(isLiveTimelinePeriod('day', '2026-07-24', now)).toBe(false);
  });

  it('never shows live location in aggregate views', () => {
    expect(isLiveTimelinePeriod('week', '2026-07-25', now)).toBe(false);
    expect(isLiveTimelinePeriod('month', '2026-07-25', now)).toBe(false);
  });
});
