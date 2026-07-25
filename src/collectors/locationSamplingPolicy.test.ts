import { describe, expect, it } from 'vitest';
import {
  IOS_LIFE_TIMELINE_SAMPLING_POLICY,
  matchesIosLifeTimelineSamplingPolicy,
} from './locationSamplingPolicy';

describe('iOS life timeline location sampling policy', () => {
  it('uses short movement batches while allowing iOS to pause when stationary', () => {
    expect(IOS_LIFE_TIMELINE_SAMPLING_POLICY).toMatchObject({
      pointDistanceMetres: 25,
      backgroundBatchDistanceMetres: 25,
      backgroundBatchIntervalMs: 90_000,
      pausesAutomatically: true,
      showsBackgroundIndicator: false,
    });
  });

  it('recognizes the active adaptive registration', () => {
    expect(matchesIosLifeTimelineSamplingPolicy({
      distanceInterval: 25,
      deferredUpdatesDistance: 25,
      deferredUpdatesInterval: 90_000,
      pausesUpdatesAutomatically: true,
      showsBackgroundLocationIndicator: false,
    })).toBe(true);
  });

  it('rejects the previous continuous five-minute registration', () => {
    expect(matchesIosLifeTimelineSamplingPolicy({
      distanceInterval: 50,
      deferredUpdatesDistance: 200,
      deferredUpdatesInterval: 300_000,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    })).toBe(false);
  });
});
