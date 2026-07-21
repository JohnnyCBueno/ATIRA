import { describe, expect, it } from 'vitest';
import { LocationSegmentRecord } from '../data/contracts';
import { projectLocationSegments, projectedPath } from './locationMapProjection';

const segment: LocationSegmentRecord = {
  id: 'journey',
  dayId: '2026-07-20',
  kind: 'journey',
  startedAt: '2026-07-20T08:00:00.000Z',
  endedAt: '2026-07-20T08:10:00.000Z',
  durationMinutes: 10,
  distanceMetres: 900,
  confidence: 0.9,
  sampleCount: 3,
  mode: 'walking',
  origin: 'real',
  points: [
    { latitude: 51.5, longitude: -0.1, timestamp: '2026-07-20T08:00:00.000Z' },
    { latitude: 51.502, longitude: -0.098, timestamp: '2026-07-20T08:05:00.000Z' },
    { latitude: 51.504, longitude: -0.096, timestamp: '2026-07-20T08:10:00.000Z' },
  ],
};

describe('location map projection', () => {
  it('fits geographic points into the map while preserving north-up orientation', () => {
    const [result] = projectLocationSegments([segment]);
    expect(result.points.every((point) => point.x >= 24 && point.x <= 336 && point.y >= 24 && point.y <= 276)).toBe(true);
    expect(result.points[2].y).toBeLessThan(result.points[0].y);
    expect(projectedPath(result.points)).toMatch(/^M/);
  });

  it('returns no projection when there are no coordinates', () => {
    expect(projectLocationSegments([])).toEqual([]);
  });
});
