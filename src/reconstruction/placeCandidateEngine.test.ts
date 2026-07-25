import { describe, expect, it } from 'vitest';
import { LocationSegmentRecord } from '../data/contracts';
import { NormalizedEvidence } from '../triangulation/contracts';
import {
  assessPlaceCandidates,
  normalizeApplePlaceCandidates,
  semanticCategoryFor,
} from './placeCandidateEngine';

const stay: LocationSegmentRecord = {
  id: 'stay-1',
  dayId: '2026-07-25',
  kind: 'stay',
  startedAt: '2026-07-25T17:00:00.000Z',
  endedAt: '2026-07-25T18:00:00.000Z',
  durationMinutes: 60,
  distanceMetres: 20,
  confidence: 0.9,
  sampleCount: 8,
  origin: 'real',
  center: { latitude: 51.5007, longitude: -0.1246 },
  points: [],
};

const candidates = normalizeApplePlaceCandidates(stay, [
  {
    name: 'Neighbourhood Gym',
    latitude: 51.50075,
    longitude: -0.12458,
    category: 'MKPOICategoryFitnessCenter',
  },
  {
    name: 'McDonald’s',
    latitude: 51.50072,
    longitude: -0.12455,
    category: 'MKPOICategoryRestaurant',
  },
]);

describe('place candidate reasoning', () => {
  it('preserves several Apple candidates and does not turn proximity into a fact', () => {
    const result = assessPlaceCandidates({ stay, candidates });

    expect(result.candidates).toHaveLength(2);
    expect(result.status).toBe('ambiguous');
    expect(result.confidence).toBeLessThanOrEqual(0.68);
    expect(result.confirmationQuestion).toContain('or somewhere else');
    expect(result.reasoning[0]).toContain('nearby possibilities');
  });

  it('allows an overlapping workout to support the gym while preserving the restaurant alternative', () => {
    const result = assessPlaceCandidates({
      stay,
      candidates,
      evidence: [workoutEvidence()],
    });

    expect(result.status).toBe('supported');
    expect(result.candidates[0].candidate.name).toBe('Neighbourhood Gym');
    expect(result.candidates[0].independentSources).toEqual(['location', 'health']);
    expect(result.alternatives).toContain('McDonald’s');
    expect(result.confirmationQuestion).toContain('McDonald’s');
  });

  it('does not treat elevated heart rate alone as proof of a gym visit', () => {
    const result = assessPlaceCandidates({
      stay,
      candidates,
      evidence: [heartRateEvidence()],
    });

    expect(result.status).toBe('ambiguous');
    expect(result.reasoning[0]).toContain('nearby possibilities');
  });

  it('makes an explicit user answer authoritative and traceable', () => {
    const restaurant = candidates.find((candidate) => candidate.name === 'McDonald’s')!;
    const result = assessPlaceCandidates({
      stay,
      candidates,
      evidence: [{
        ...baseEvidence(),
        id: 'confirmation-1',
        role: 'confirmed',
        source: 'user',
        modality: 'user_confirmation',
        factType: 'user_confirmation',
        quality: 1,
        attributes: { placeCandidateId: restaurant.id },
        lineageSources: [],
        independenceKeys: ['user:confirmation-1'],
      }],
    });

    expect(result.status).toBe('confirmed');
    expect(result.candidates[0].candidate.name).toBe('McDonald’s');
    expect(result.candidates[0].confidence).toBe(1);
    expect(result.candidates[0].evidenceIds).toContain('confirmation-1');
  });

  it('normalizes Apple point-of-interest categories conservatively', () => {
    expect(semanticCategoryFor('MKPOICategoryFitnessCenter')).toBe('fitness');
    expect(semanticCategoryFor('MKPOICategoryRestaurant')).toBe('food');
    expect(semanticCategoryFor('an-unknown-new-category')).toBe('other');
  });

  it('deduplicates identical provider results and sorts them by distance', () => {
    const normalized = normalizeApplePlaceCandidates(stay, [
      { name: 'Far Café', latitude: 51.5015, longitude: -0.1246, category: 'cafe' },
      { name: 'Near Shop', latitude: 51.50071, longitude: -0.1246, category: 'store' },
      { name: 'Near Shop', latitude: 51.50071, longitude: -0.1246, category: 'store' },
    ]);

    expect(normalized.map((candidate) => candidate.name)).toEqual(['Near Shop', 'Far Café']);
  });
});

function workoutEvidence(): NormalizedEvidence {
  return {
    ...baseEvidence(),
    id: 'workout-1',
    source: 'health',
    modality: 'workout_record',
    factType: 'workout',
    attributes: { workoutType: 'strength_training' },
    observationIds: ['health-observation-1'],
    lineageSources: ['health'],
    independenceKeys: ['health:watch-1'],
  };
}

function heartRateEvidence(): NormalizedEvidence {
  return {
    ...baseEvidence(),
    id: 'heart-rate-1',
    source: 'health',
    modality: 'physiology',
    factType: 'heart_rate',
    attributes: { elevated: true, beatsPerMinute: 132 },
    observationIds: ['health-observation-2'],
    lineageSources: ['health'],
    independenceKeys: ['health:watch-1'],
  };
}

function baseEvidence(): NormalizedEvidence {
  return {
    id: 'evidence-1',
    role: 'observed',
    source: 'health',
    modality: 'other',
    factType: 'other',
    deviceId: 'watch-1',
    collectorId: 'healthkit',
    startedAt: '2026-07-25T17:10:00.000Z',
    endedAt: '2026-07-25T17:50:00.000Z',
    quality: 0.95,
    attributes: {},
    observationIds: [],
    lineageSources: ['health'],
    independenceKeys: ['health:watch-1'],
  };
}
