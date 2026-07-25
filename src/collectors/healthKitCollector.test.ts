import { describe, expect, it } from 'vitest';
import type { NativeHealthKitSample } from '../../modules/atira-healthkit';
import { normalizeHealthKitSamples } from './healthKitNormalization';

describe('HealthKit normalization', () => {
  it('normalizes bounded read-only samples with stable IDs and provider lineage', () => {
    const result = normalizeHealthKitSamples([
      sample({
        id: 'ABC-123',
        metric: 'heart_rate',
        value: 124,
        unit: 'count/min',
        deviceManufacturer: 'Apple Inc.',
        deviceModel: 'Watch',
      }),
      sample({
        id: 'DEF-456',
        metric: 'workout',
        value: 2_700,
        unit: 's',
        category: '50',
        deviceManufacturer: 'Apple Inc.',
        deviceModel: 'Watch',
      }),
    ], '2026-07-25T19:00:00.000Z');

    expect(result.observations).toHaveLength(2);
    expect(result.observations[0]).toMatchObject({
      id: 'healthkit:abc-123',
      source: 'health',
      kind: 'health_sample',
      quality: 0.95,
      payload: {
        metric: 'heart_rate',
        provider: 'apple_healthkit',
      },
    });
    expect(result.devices).toEqual([
      expect.objectContaining({ deviceClass: 'watch', platform: 'ios', label: 'Apple Health watch' }),
    ]);
    expect(result.collectors).toEqual([
      expect.objectContaining({ source: 'health', provider: 'apple_healthkit', label: 'Apple HealthKit' }),
    ]);
  });

  it('rejects malformed samples rather than manufacturing health evidence', () => {
    const result = normalizeHealthKitSamples([
      sample({ id: '', value: Number.NaN }),
      sample({ id: 'bad-time', startedAt: 'not-a-time' }),
    ], '2026-07-25T19:00:00.000Z');

    expect(result.observations).toEqual([]);
    expect(result.devices).toEqual([]);
    expect(result.collectors).toEqual([]);
  });

  it('keeps sleep stage and step units factual without interpreting them', () => {
    const result = normalizeHealthKitSamples([
      sample({ id: 'sleep-1', metric: 'sleep_session', value: 3_600, unit: 's', category: 'asleep_deep' }),
      sample({ id: 'steps-1', metric: 'steps', value: 412, unit: 'count' }),
    ], '2026-07-25T19:00:00.000Z');

    expect(result.observations.map((item) => item.payload)).toEqual([
      expect.objectContaining({ metric: 'sleep_session', value: 3_600, unit: 's', category: 'asleep_deep' }),
      expect.objectContaining({ metric: 'steps', value: 412, unit: 'count' }),
    ]);
  });
});

function sample(overrides: Partial<NativeHealthKitSample>): NativeHealthKitSample {
  return {
    id: 'sample-1',
    metric: 'heart_rate',
    startedAt: '2026-07-25T17:10:00.000Z',
    endedAt: '2026-07-25T17:11:00.000Z',
    value: 90,
    unit: 'count/min',
    sourceName: 'Synthetic Health Source',
    sourceBundleIdentifier: 'com.example.synthetic-health',
    ...overrides,
  };
}
