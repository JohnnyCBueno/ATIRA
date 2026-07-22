import { describe, expect, it } from 'vitest';
import { RawObservation } from '../data/contracts';
import { normalizeObservationEvidence } from './evidenceNormalizer';

describe('evidence normalization', () => {
  it('keeps calendar information declared rather than observed', () => {
    const evidence = normalizeObservationEvidence([
      observation('plan', 'calendar', 'calendar_interval', { title: 'Team meeting' }),
      observation('activity', 'desktop', 'desktop_foreground', { application: 'Teams', activityState: 'active' }),
    ]);

    expect(evidence[0]).toMatchObject({ role: 'declared', modality: 'declared_intent', factType: 'declared_intent' });
    expect(evidence[1]).toMatchObject({ role: 'observed', modality: 'digital_activity', factType: 'digital_active' });
  });

  it('normalizes device inactivity and health modalities without interpreting intent', () => {
    const evidence = normalizeObservationEvidence([
      observation('away', 'desktop', 'desktop_foreground', { activityState: 'idle' }),
      observation('sleep', 'health', 'health_sample', { metric: 'sleep_session' }),
      observation('workout', 'health', 'health_sample', { metric: 'workout' }),
    ]);

    expect(evidence.map((item) => item.factType)).toEqual(['device_away', 'sleep', 'workout']);
    expect(evidence[0].attributes).toEqual({ activityState: 'idle' });
  });
});

function observation(
  id: string,
  source: RawObservation['source'],
  kind: RawObservation['kind'],
  payload: RawObservation['payload'],
): RawObservation {
  return {
    id,
    source,
    kind,
    deviceId: `${source}-device`,
    collectorId: `${source}-collector`,
    startedAt: '2026-07-21T09:00:00.000Z',
    endedAt: '2026-07-21T09:10:00.000Z',
    capturedAt: '2026-07-21T09:10:00.000Z',
    quality: 0.9,
    payload,
  };
}
