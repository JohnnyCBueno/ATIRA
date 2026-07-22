import { EvidenceSource } from '../domain/types';
import {
  CoverageAssessmentState,
  SourceCoverageAssessment,
  SourceCoverageWindow,
} from './contracts';

const stateWeight: Record<SourceCoverageWindow['state'], number> = {
  observed: 1,
  partial: 0.5,
  missing: 0,
  paused: 0,
  unavailable: 0,
};

export function assessSourceCoverage(
  windows: SourceCoverageWindow[],
  sources: EvidenceSource[],
  startedAt: string,
  endedAt: string,
): SourceCoverageAssessment[] {
  const rangeStart = Date.parse(startedAt);
  const rangeEnd = Date.parse(endedAt);
  if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeEnd <= rangeStart) {
    throw new Error('Coverage assessment requires a valid, positive time range.');
  }
  return [...new Set(sources)].map((source) => assessOneSource(windows, source, rangeStart, rangeEnd));
}

export function hasSufficientCoverage(assessment: SourceCoverageAssessment, minimumPercent: number) {
  return assessment.state === 'sufficient' && assessment.coveragePercent >= minimumPercent;
}

function assessOneSource(
  windows: SourceCoverageWindow[],
  source: EvidenceSource,
  rangeStart: number,
  rangeEnd: number,
): SourceCoverageAssessment {
  const relevant = windows.flatMap((window) => {
    if (window.source !== source) return [];
    const start = Math.max(rangeStart, Date.parse(window.startedAt));
    const end = Math.min(rangeEnd, Date.parse(window.endedAt));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
    return [{ ...window, start, end }];
  });
  const expectedSeconds = Math.round((rangeEnd - rangeStart) / 1_000);
  if (relevant.length === 0) {
    return {
      source,
      startedAt: new Date(rangeStart).toISOString(),
      endedAt: new Date(rangeEnd).toISOString(),
      state: 'unknown',
      coveragePercent: 0,
      observedSeconds: 0,
      expectedSeconds,
      reasons: ['No explicit collector coverage was recorded for this period.'],
    };
  }

  const boundaries = [...new Set([rangeStart, rangeEnd, ...relevant.flatMap((window) => [window.start, window.end])])]
    .sort((left, right) => left - right);
  let weightedMilliseconds = 0;
  for (let index = 1; index < boundaries.length; index += 1) {
    const start = boundaries[index - 1];
    const end = boundaries[index];
    const midpoint = start + (end - start) / 2;
    const active = relevant.filter((window) => window.start <= midpoint && window.end >= midpoint);
    const weight = active.reduce((best, window) => Math.max(best, stateWeight[window.state] * clamp(window.quality)), 0);
    weightedMilliseconds += (end - start) * weight;
  }
  const observedSeconds = Math.round(weightedMilliseconds / 1_000);
  const coveragePercent = Math.round((weightedMilliseconds / (rangeEnd - rangeStart)) * 100);
  const states = new Set(relevant.map((window) => window.state));
  const state = aggregateState(coveragePercent, states);
  const reasons = relevant.map((window) => window.reason).filter((reason): reason is string => Boolean(reason));
  if (state !== 'sufficient' && reasons.length === 0) reasons.push(`${source} coverage was ${coveragePercent}% for this period.`);
  return {
    source,
    startedAt: new Date(rangeStart).toISOString(),
    endedAt: new Date(rangeEnd).toISOString(),
    state,
    coveragePercent,
    observedSeconds,
    expectedSeconds,
    reasons: [...new Set(reasons)],
  };
}

function aggregateState(coveragePercent: number, states: Set<SourceCoverageWindow['state']>): CoverageAssessmentState {
  if (coveragePercent >= 60) return 'sufficient';
  if (coveragePercent > 0) return 'partial';
  if (states.has('paused')) return 'paused';
  if (states.has('unavailable')) return 'unavailable';
  return 'missing';
}

function clamp(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
