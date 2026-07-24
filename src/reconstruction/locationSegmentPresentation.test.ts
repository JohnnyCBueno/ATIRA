import { describe, expect, it } from 'vitest';
import { LocationSegmentRecord } from '../data/contracts';
import { locationSegmentDetail, locationSegmentTitle } from './locationSegmentPresentation';

const segment: LocationSegmentRecord = {
  id: 'segment',
  dayId: '2026-07-20',
  kind: 'journey',
  startedAt: '2026-07-20T08:00:00.000Z',
  endedAt: '2026-07-20T08:10:00.000Z',
  durationMinutes: 10,
  distanceMetres: 900,
  confidence: 0.9,
  sampleCount: 3,
  mode: 'walking',
  origin: 'synthetic',
  points: [],
};

describe('location segment presentation', () => {
  it('describes measured journeys without exposing coordinates', () => {
    expect(locationSegmentTitle(segment)).toBe('Walking journey');
    expect(locationSegmentDetail(segment)).toBe('900 m · 10m · 3 samples');
  });

  it('labels missing coverage honestly', () => {
    const gap = { ...segment, kind: 'coverage_gap' as const, distanceMetres: 0, durationMinutes: 75 };
    expect(locationSegmentTitle(gap)).toBe('Missing coverage');
    expect(locationSegmentDetail(gap)).toContain('straight line is not counted as travel');
  });

  it('uses anonymous place labels for stays', () => {
    expect(locationSegmentTitle({ ...segment, kind: 'stay' }, 'Place B')).toBe('Place B');
  });
});
