import { describe, expect, it } from 'vitest';
import { LocationSegmentRecord } from '../data/contracts';
import { cameraForLocationSegments, locationCoordinates } from './locationNativeMapPresentation';

const segment: LocationSegmentRecord = {
  id: 'journey',
  dayId: '2026-07-25',
  kind: 'journey',
  startedAt: '2026-07-25T08:00:00.000Z',
  endedAt: '2026-07-25T08:20:00.000Z',
  durationMinutes: 20,
  distanceMetres: 1_200,
  confidence: 0.9,
  sampleCount: 3,
  mode: 'walking',
  origin: 'synthetic',
  points: [
    { latitude: 40.410, longitude: -3.700, timestamp: '2026-07-25T08:00:00.000Z' },
    { latitude: 40.415, longitude: -3.695, timestamp: '2026-07-25T08:20:00.000Z' },
  ],
};

describe('native location map presentation', () => {
  it('derives a bounded camera that includes the reconstructed day', () => {
    const camera = cameraForLocationSegments([segment]);

    expect(camera?.coordinates.latitude).toBeCloseTo(40.4125);
    expect(camera?.coordinates.longitude).toBeCloseTo(-3.6975);
    expect(camera?.zoom).toBeGreaterThanOrEqual(11);
    expect(camera?.zoom).toBeLessThanOrEqual(17);
  });

  it('focuses more closely on a selected stay', () => {
    const stay: LocationSegmentRecord = {
      ...segment,
      id: 'stay',
      kind: 'stay',
      points: [],
      center: { latitude: 40.416, longitude: -3.694 },
    };

    expect(cameraForLocationSegments([segment, stay], 'stay')).toEqual({
      coordinates: { latitude: 40.416, longitude: -3.694 },
      zoom: 18,
    });
  });

  it('uses a stay centre when no path points are available', () => {
    const stay = { ...segment, kind: 'stay' as const, points: [], center: { latitude: 40.416, longitude: -3.694 } };

    expect(locationCoordinates([stay])).toEqual([{ latitude: 40.416, longitude: -3.694 }]);
  });
});
