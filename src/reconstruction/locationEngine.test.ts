import { describe, expect, it } from 'vitest';
import { RawObservation } from '../data/contracts';
import { syntheticLocationTrace } from '../fixtures/syntheticLocationTrace';
import {
  cleanLocationObservations,
  haversineMetres,
  inferTravelMode,
  reconstructLocationDay,
} from './locationEngine';

const observation = (id: string, timestamp: string, latitude: number, longitude: number, accuracyMetres = 15): RawObservation => ({
  id,
  source: 'location',
  kind: 'location_sample',
  startedAt: timestamp,
  capturedAt: timestamp,
  quality: 0.9,
  payload: { latitude, longitude, accuracyMetres },
});

describe('location reconstruction engine', () => {
  it('calculates geodesic distance without a map provider', () => {
    const distance = haversineMetres(51.5, -0.1, 51.501, -0.1);
    expect(distance).toBeGreaterThan(110);
    expect(distance).toBeLessThan(112);
  });

  it('infers conservative travel modes from average speed', () => {
    expect(inferTravelMode(0.1)).toBe('unknown');
    expect(inferTravelMode(1.4)).toBe('walking');
    expect(inferTravelMode(4.5)).toBe('cycling');
    expect(inferTravelMode(14)).toBe('road');
    expect(inferTravelMode(50)).toBe('fast_transit');
  });

  it('rejects invalid and low-accuracy observations and deduplicates timestamps', () => {
    const time = '2026-07-20T08:00:00.000Z';
    const result = cleanLocationObservations([
      observation('valid', time, 51.5, -0.1),
      { ...observation('duplicate', time, 51.5, -0.1), quality: 0.2 },
      observation('invalid-latitude', '2026-07-20T08:01:00.000Z', 151.5, -0.1),
      observation('inaccurate', '2026-07-20T08:02:00.000Z', 51.5, -0.1, 900),
    ]);
    expect(result.samples).toHaveLength(1);
    expect(result.rejected).toBe(3);
  });

  it('turns a trace into stays, journeys, and an honest coverage gap', () => {
    const result = reconstructLocationDay('2026-07-20', syntheticLocationTrace);
    expect(result.acceptedSamples).toBe(syntheticLocationTrace.length);
    expect(result.segments.filter((segment) => segment.kind === 'stay').length).toBeGreaterThanOrEqual(2);
    expect(result.segments.some((segment) => segment.kind === 'journey')).toBe(true);
    expect(result.segments.some((segment) => segment.kind === 'coverage_gap')).toBe(true);
    expect(result.coveragePercent).toBeLessThan(100);
    expect(result.distanceMetres).toBeGreaterThan(450);
    expect(result.warnings).toContain('Dashed route sections represent missing coverage, not measured travel.');
  });

  it('does not fabricate a route from one point', () => {
    const result = reconstructLocationDay('2026-07-20', [
      observation('single', '2026-07-20T08:00:00.000Z', 51.5, -0.1),
    ]);
    expect(result.segments).toEqual([]);
    expect(result.coveragePercent).toBe(0);
    expect(result.warnings[0]).toMatch(/At least two/);
  });

  it('does not call stationary GPS noise a journey', () => {
    const result = reconstructLocationDay('2026-07-20', [
      observation('noise-1', '2026-07-20T08:00:00.000Z', 51.5, -0.1),
      observation('noise-2', '2026-07-20T08:05:00.000Z', 51.50003, -0.10002),
      observation('noise-3', '2026-07-20T08:10:00.000Z', 51.49998, -0.09999),
    ]);
    expect(result.segments.filter((segment) => segment.kind === 'journey')).toEqual([]);
  });
});
