import { describe, expect, it } from 'vitest';
import { RawObservation } from '../data/contracts';
import { normalizeObservationEvidence } from './evidenceNormalizer';
import { SourceCoverageWindow } from './contracts';
import { applyInterpretationFeedback, buildTemporalTriangulation } from './temporalFusionEngine';

describe('temporal triangulation', () => {
  it('stays in a single-source learning state with desktop evidence alone', () => {
    const result = buildTemporalTriangulation(normalizeObservationEvidence([
      observation('away', 'desktop', 'desktop_foreground', '09:00', '09:10', { activityState: 'idle' }),
    ]), [coverage('desktop')]);

    expect(result).toMatchObject({ readiness: 'single_source', observedSources: ['desktop'] });
    expect(result.candidates).toHaveLength(0);
  });

  it('creates a neutral candidate from independently covered phone and desktop evidence', () => {
    const result = buildTemporalTriangulation(normalizeObservationEvidence([
      observation('away', 'desktop', 'desktop_foreground', '09:00', '09:10', { activityState: 'idle' }),
      observation('phone', 'phone', 'app_foreground', '09:03', '09:08', { application: 'Messages', activityState: 'active' }),
    ]), [coverage('desktop'), coverage('phone')]);

    expect(result.readiness).toBe('ready');
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({ kind: 'phone_attention_shift', independentObservedSources: ['desktop', 'phone'] });
    expect(result.candidates[0].summary).toContain('does not reveal why');
  });

  it('does not allow declared calendar intent to count as an observed source', () => {
    const result = buildTemporalTriangulation(normalizeObservationEvidence([
      observation('meeting', 'calendar', 'calendar_interval', '09:00', '09:30', { title: 'Meeting' }),
      observation('teams', 'desktop', 'desktop_foreground', '09:00', '09:30', { application: 'Teams', activityState: 'active' }),
    ]), [coverage('desktop')]);

    expect(result.observedSources).toEqual(['desktop']);
    expect(result.readiness).toBe('single_source');
    expect(result.candidates).toHaveLength(0);
  });

  it('blocks an apparent overlap when explicit source coverage is missing', () => {
    const result = buildTemporalTriangulation(normalizeObservationEvidence([
      observation('away', 'desktop', 'desktop_foreground', '09:00', '09:10', { activityState: 'idle' }),
      observation('phone', 'phone', 'app_foreground', '09:03', '09:08', { application: 'Messages', activityState: 'active' }),
    ]), [coverage('desktop')]);

    expect(result.readiness).toBe('insufficient_coverage');
    expect(result.candidates).toHaveLength(0);
    expect(result.blocked[0].reasons.join(' ')).toContain('phone coverage');
  });

  it('retains contradictory evidence and lowers confidence', () => {
    const base = [
      observation('away', 'desktop', 'desktop_foreground', '09:00', '09:10', { activityState: 'idle' }),
      observation('phone', 'phone', 'app_foreground', '09:03', '09:08', { application: 'Messages', activityState: 'active' }),
    ];
    const clean = buildTemporalTriangulation(normalizeObservationEvidence(base), [coverage('desktop'), coverage('phone')]);
    const conflicted = buildTemporalTriangulation(normalizeObservationEvidence([
      ...base,
      observation('desktop-active', 'desktop', 'desktop_foreground', '09:04', '09:07', { application: 'Excel', activityState: 'active' }),
    ]), [coverage('desktop'), coverage('phone')]);

    expect(conflicted.candidates[0].confidence).toBeLessThan(clean.candidates[0].confidence);
    expect(conflicted.candidates[0].evidence.some((item) => item.relation === 'contradiction')).toBe(true);
  });

  it('lets a user correction confirm or invalidate a candidate', () => {
    const candidate = buildTemporalTriangulation(normalizeObservationEvidence([
      observation('away', 'desktop', 'desktop_foreground', '09:00', '09:10', { activityState: 'idle' }),
      observation('walk', 'motion', 'motion_activity', '09:01', '09:09', { activity: 'walking' }),
    ]), [coverage('desktop'), coverage('motion')]).candidates[0];

    const confirmed = applyInterpretationFeedback([candidate], [{ id: 'yes', fingerprint: candidate.fingerprint, answer: 'yes', createdAt: '2026-07-21T12:00:00.000Z' }])[0];
    const rejected = applyInterpretationFeedback([candidate], [{ id: 'no', fingerprint: candidate.fingerprint, answer: 'no', createdAt: '2026-07-21T12:00:00.000Z' }])[0];
    expect(confirmed).toMatchObject({ status: 'confirmed', confidence: 1 });
    expect(rejected).toMatchObject({ status: 'rejected', confidence: 0 });
    expect(rejected.reasoning.at(-1)).toContain('must not support later claims');
  });
});

function observation(
  id: string,
  source: RawObservation['source'],
  kind: RawObservation['kind'],
  start: string,
  end: string,
  payload: RawObservation['payload'],
): RawObservation {
  return {
    id,
    source,
    kind,
    deviceId: `${source}-device`,
    collectorId: `${source}-collector`,
    startedAt: `2026-07-21T${start}:00.000Z`,
    endedAt: `2026-07-21T${end}:00.000Z`,
    capturedAt: `2026-07-21T${end}:00.000Z`,
    quality: 0.9,
    payload,
  };
}

function coverage(source: SourceCoverageWindow['source']): SourceCoverageWindow {
  return {
    id: `${source}-coverage`,
    source,
    startedAt: '2026-07-21T08:00:00.000Z',
    endedAt: '2026-07-21T11:00:00.000Z',
    state: 'observed',
    quality: 1,
  };
}
