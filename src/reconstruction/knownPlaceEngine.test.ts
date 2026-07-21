import { describe, expect, it } from 'vitest';
import { LocationSegmentRecord } from '../data/contracts';
import { clusterKnownPlaces } from './knownPlaceEngine';

const stay = (
  id: string,
  dayId: string,
  latitude: number,
  longitude: number,
  origin: LocationSegmentRecord['origin'] = 'synthetic',
): LocationSegmentRecord => ({
  id,
  dayId,
  kind: 'stay',
  startedAt: `${dayId}T08:00:00.000Z`,
  endedAt: `${dayId}T08:30:00.000Z`,
  durationMinutes: 30,
  distanceMetres: 0,
  confidence: 0.9,
  sampleCount: 4,
  origin,
  center: { latitude, longitude },
  points: [],
});

describe('known-place clustering', () => {
  it('combines repeat visits across days while keeping distant places separate', () => {
    const result = clusterKnownPlaces([
      stay('home-1', '2026-07-14', 51.5, -0.1),
      stay('home-2', '2026-07-15', 51.50012, -0.10008),
      stay('office', '2026-07-15', 51.506, -0.0952),
    ]);

    expect(result.places).toHaveLength(2);
    expect(result.places[0]).toMatchObject({ label: 'Place A', visitCount: 2, dayCount: 2 });
    expect(result.assignments[0].placeId).toBe(result.assignments[1].placeId);
    expect(result.assignments[2].placeId).not.toBe(result.assignments[0].placeId);
  });

  it('ignores journeys and coverage gaps', () => {
    const journey: LocationSegmentRecord = {
      ...stay('journey', '2026-07-14', 51.5, -0.1),
      kind: 'journey',
      center: undefined,
      distanceMetres: 500,
      mode: 'walking',
    };
    expect(clusterKnownPlaces([journey])).toEqual({ places: [], assignments: [] });
  });

  it('marks a cluster mixed when real and synthetic visits combine', () => {
    const result = clusterKnownPlaces([
      stay('visit-1', '2026-07-14', 51.5, -0.1, 'synthetic'),
      stay('visit-2', '2026-07-15', 51.50005, -0.1, 'real'),
    ]);
    expect(result.places[0].origin).toBe('mixed');
  });
});
