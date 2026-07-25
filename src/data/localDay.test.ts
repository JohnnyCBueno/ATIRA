import { describe, expect, it } from 'vitest';
import { localDayIdForDate, localDayIdForTimestamp, parseLocalDayId } from './localDay';

describe('local day boundaries', () => {
  it('uses the device calendar day instead of the UTC date', () => {
    const justAfterLocalMidnight = new Date(2026, 6, 25, 0, 15);

    expect(localDayIdForTimestamp(justAfterLocalMidnight.toISOString())).toBe('2026-07-25');
  });

  it('round-trips a local calendar day without crossing a timezone boundary', () => {
    const date = parseLocalDayId('2026-07-25');

    expect(localDayIdForDate(date)).toBe('2026-07-25');
  });
});
