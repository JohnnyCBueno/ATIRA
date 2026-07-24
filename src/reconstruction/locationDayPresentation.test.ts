import { describe, expect, it } from 'vitest';
import { DayRecord } from '../domain/types';
import { LocationReconstructionResult } from './locationEngine';
import { locationDayResultToRecord } from './locationDayPresentation';

const result: LocationReconstructionResult = {
  dayId: '2026-07-20',
  acceptedSamples: 12,
  rejectedSamples: 0,
  observedMinutes: 95,
  gapMinutes: 25,
  coveragePercent: 79,
  distanceMetres: 3_420,
  warnings: [],
  segments: [
    {
      id: 'journey',
      dayId: '2026-07-20',
      kind: 'journey',
      startedAt: '2026-07-20T08:00:00.000Z',
      endedAt: '2026-07-20T08:35:00.000Z',
      durationMinutes: 35,
      distanceMetres: 3_420,
      confidence: 0.9,
      sampleCount: 12,
      points: [],
    },
    {
      id: 'stay',
      dayId: '2026-07-20',
      kind: 'stay',
      startedAt: '2026-07-20T08:35:00.000Z',
      endedAt: '2026-07-20T09:35:00.000Z',
      durationMinutes: 60,
      distanceMetres: 0,
      confidence: 0.9,
      sampleCount: 5,
      points: [],
    },
  ],
};

describe('location day presentation', () => {
  it('creates a timeline day for location-only evidence', () => {
    const day = locationDayResultToRecord(result, undefined, new Date('2026-07-24T10:00:00.000Z'));

    expect(day).toMatchObject({
      id: '2026-07-20',
      dayNumber: '20',
      month: 'July',
      relativeLabel: '4 days ago',
      coverage: 79,
      understood: '1h 35m',
      movement: '35m',
      distance: '3.4 km',
      work: '0m',
      learning: '0m',
      events: [],
      desktopUsages: [],
    });
  });

  it('updates location facts without erasing existing desktop and event data', () => {
    const existing: DayRecord = {
      id: '2026-07-20',
      weekday: 'Mon',
      dayNumber: '20',
      month: 'July',
      relativeLabel: 'Existing label',
      coverage: 88,
      understood: '4h 12m',
      work: '3h',
      movement: '—',
      learning: '25m',
      distance: '—',
      routePath: 'existing-route',
      places: [],
      events: [{
        id: 'desktop-event',
        title: 'Creation activity',
        category: 'creation',
        start: '09:00',
        end: '10:00',
        duration: '1h',
        state: 'inferred_high',
        summary: 'Existing desktop evidence.',
        evidence: [{ id: 'desktop', source: 'desktop', label: 'Desktop', detail: 'Observed locally.', strength: 'strong' }],
        alternatives: [],
      }],
      desktopUsages: [{
        deviceId: 'mac',
        deviceLabel: 'Mac',
        deviceClass: 'computer',
        platform: 'macos',
        totalSeconds: 3_600,
        applications: [],
        hours: [],
      }],
    };

    const day = locationDayResultToRecord(result, existing, new Date('2026-07-24T10:00:00.000Z'));

    expect(day).toMatchObject({
      relativeLabel: '4 days ago',
      coverage: 88,
      understood: '4h 12m',
      work: '3h',
      learning: '25m',
      movement: '35m',
      distance: '3.4 km',
      routePath: 'existing-route',
      events: existing.events,
      desktopUsages: existing.desktopUsages,
    });
  });

  it('keeps a location-only day truthful when there is no journey', () => {
    const day = locationDayResultToRecord({
      ...result,
      distanceMetres: 0,
      segments: result.segments.filter((segment) => segment.kind === 'stay'),
    });

    expect(day).toMatchObject({ movement: '—', distance: '—' });
  });
});
