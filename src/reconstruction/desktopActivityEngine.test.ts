import { describe, expect, it } from 'vitest';
import { RawObservation } from '../data/contracts';
import { desktopDayToRecord, reconstructDesktopActivity } from './desktopActivityEngine';

const observation = (id: string, application: string | null, startedAt: string, endedAt: string, activityState = 'active'): RawObservation => ({
  id,
  source: 'desktop',
  kind: 'desktop_foreground',
  startedAt,
  endedAt,
  capturedAt: endedAt,
  quality: 0.96,
  payload: { application, activityState, sampleCount: 3 },
});

describe('desktop activity reconstruction', () => {
  it('classifies and merges adjacent focused applications', () => {
    const result = reconstructDesktopActivity([
      observation('a', 'EXCEL', '2026-07-21T09:00:00.000Z', '2026-07-21T09:30:00.000Z'),
      observation('b', 'POWERPNT', '2026-07-21T09:31:00.000Z', '2026-07-21T10:00:00.000Z'),
    ])[0];
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]).toMatchObject({ kind: 'focused_work', applications: ['EXCEL', 'POWERPNT'], durationSeconds: 3540 });
    expect(result.focusedWorkSeconds).toBe(3540);
  });

  it('keeps browser activity deliberately ambiguous', () => {
    const result = reconstructDesktopActivity([
      observation('browser', 'chrome', '2026-07-21T12:00:00.000Z', '2026-07-21T12:20:00.000Z'),
    ])[0];
    const day = desktopDayToRecord(result, undefined, new Date('2026-07-21T13:00:00.000Z'));
    expect(day.events[0]).toMatchObject({ title: 'Browser activity', category: 'digital', confidence: 0.45, state: 'inferred_medium' });
    expect(day.events[0].summary).toContain('cannot infer whether that time was productive');
    expect(day.work).toBe('0m');
  });

  it('drops tiny idle noise but keeps a meaningful break', () => {
    const result = reconstructDesktopActivity([
      observation('tiny-idle', null, '2026-07-21T12:00:00.000Z', '2026-07-21T12:00:20.000Z', 'idle'),
      observation('break', null, '2026-07-21T12:01:00.000Z', '2026-07-21T12:11:00.000Z', 'idle'),
    ])[0];
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].kind).toBe('idle');
  });

  it('preserves a correction when a stable block is reconstructed again', () => {
    const result = reconstructDesktopActivity([
      observation('chat', 'ChatGPT', '2026-07-21T14:00:00.000Z', '2026-07-21T14:10:00.000Z'),
    ])[0];
    const first = desktopDayToRecord(result, undefined, new Date('2026-07-21T15:00:00.000Z'));
    first.events[0] = { ...first.events[0], title: 'Product planning', state: 'corrected', confidence: 1 };
    const rebuilt = desktopDayToRecord(result, first, new Date('2026-07-21T15:00:00.000Z'));
    expect(rebuilt.events[0]).toMatchObject({ title: 'Product planning', state: 'corrected', confidence: 1 });
  });
});
