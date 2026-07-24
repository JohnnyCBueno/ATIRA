import { describe, expect, it } from 'vitest';
import { LocationSegmentRecord } from '../data/contracts';
import { focusViewportOnSegment, overviewViewport, panViewport, viewBoxForViewport, zoomViewport } from './locationMapInteraction';

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
  origin: 'synthetic',
  points: [],
};

describe('location map interaction', () => {
  it('keeps zoom and panning inside the projected canvas', () => {
    const zoomed = zoomViewport(overviewViewport, 9);
    const panned = panViewport(panViewport(zoomed, 20, 0), 0, -20);
    const box = viewBoxForViewport(panned);

    expect(zoomed.zoom).toBe(3);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(360);
    expect(box.y + box.height).toBeLessThanOrEqual(300);
  });

  it('focuses journeys on the midpoint of their visible path', () => {
    const focused = focusViewportOnSegment({
      segment,
      points: [{ x: 40, y: 80 }, { x: 240, y: 160 }],
    });

    expect(focused).toEqual({ centerX: 140, centerY: 120, zoom: 1.75 });
  });

  it('uses a closer focus for a stay marker', () => {
    const focused = focusViewportOnSegment({
      segment: { ...segment, kind: 'stay' },
      points: [],
      center: { x: 120, y: 90 },
    });

    expect(focused).toEqual({ centerX: 120, centerY: 90, zoom: 2.25 });
  });
});
