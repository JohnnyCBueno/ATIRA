import { describe, expect, it, vi } from 'vitest';
import { DayRecord } from '../domain/types';
import { TimelineRepository } from './contracts';
import { ensureCurrentDay } from './currentDay';

describe('current timeline day', () => {
  it('adds today when history currently ends yesterday', async () => {
    const existing = day('2026-07-24');
    const upsertDay = vi.fn();
    const repository = {
      listDays: vi.fn().mockResolvedValue([existing]),
      upsertDay,
    } as unknown as TimelineRepository;

    await expect(ensureCurrentDay(repository, new Date(2026, 6, 25, 9))).resolves.toBe(true);
    expect(upsertDay).toHaveBeenCalledWith(expect.objectContaining({
      id: '2026-07-25',
      dayNumber: '25',
      relativeLabel: 'Today',
    }));
  });

  it('does not overwrite an existing current day', async () => {
    const current = day('2026-07-25');
    const upsertDay = vi.fn();
    const repository = {
      listDays: vi.fn().mockResolvedValue([current]),
      upsertDay,
    } as unknown as TimelineRepository;

    await expect(ensureCurrentDay(repository, new Date(2026, 6, 25, 20))).resolves.toBe(false);
    expect(upsertDay).not.toHaveBeenCalled();
  });
});

function day(id: string): DayRecord {
  return {
    id,
    weekday: 'Fri',
    dayNumber: id.slice(-2),
    month: 'July',
    relativeLabel: 'Today',
    coverage: 0,
    understood: '0m',
    work: '0m',
    movement: '—',
    learning: '0m',
    distance: '—',
    routePath: '',
    places: [],
    events: [],
    desktopUsages: [],
  };
}
