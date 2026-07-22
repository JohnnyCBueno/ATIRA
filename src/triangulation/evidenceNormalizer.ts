import { RawObservation } from '../data/contracts';
import {
  EvidenceFactType,
  EvidenceModality,
  EvidenceRole,
  NormalizedEvidence,
} from './contracts';

export function normalizeObservationEvidence(observations: RawObservation[]): NormalizedEvidence[] {
  return observations.flatMap((observation) => {
    const started = Date.parse(observation.startedAt);
    const proposedEnd = Date.parse(observation.endedAt ?? observation.capturedAt);
    if (!Number.isFinite(started)) return [];
    const ended = Number.isFinite(proposedEnd) && proposedEnd > started ? proposedEnd : started + 1_000;
    const { role, modality, factType } = classifyObservation(observation);
    const independenceKey = observation.collectorId
      ?? `${observation.source}:${observation.deviceId ?? 'unknown-device'}`;
    return [{
      id: `evidence:${observation.id}`,
      role,
      source: observation.source,
      modality,
      factType,
      deviceId: observation.deviceId,
      collectorId: observation.collectorId,
      startedAt: new Date(started).toISOString(),
      endedAt: new Date(ended).toISOString(),
      quality: clamp(observation.quality),
      attributes: { ...observation.payload },
      observationIds: [observation.id],
      lineageSources: [observation.source],
      independenceKeys: [independenceKey],
    } satisfies NormalizedEvidence];
  }).sort((left, right) => left.startedAt.localeCompare(right.startedAt));
}

function classifyObservation(observation: RawObservation): {
  role: EvidenceRole;
  modality: EvidenceModality;
  factType: EvidenceFactType;
} {
  if (observation.kind === 'calendar_interval') {
    return { role: 'declared', modality: 'declared_intent', factType: 'declared_intent' };
  }
  if (observation.kind === 'location_sample') {
    return { role: 'observed', modality: 'location', factType: 'location_sample' };
  }
  if (observation.kind === 'motion_activity') {
    return { role: 'observed', modality: 'motion', factType: movementFactType(observation.payload.activity ?? observation.payload.type) };
  }
  if (observation.kind === 'health_sample') {
    return healthClassification(observation.payload.metric ?? observation.payload.type ?? observation.payload.kind);
  }
  if (['desktop_foreground', 'app_foreground', 'browser_foreground'].includes(observation.kind)) {
    const state = String(observation.payload.activityState ?? 'active').toLowerCase();
    if (state === 'idle' || state === 'away') return { role: 'observed', modality: 'device_state', factType: 'device_away' };
    if (state === 'locked') return { role: 'observed', modality: 'device_state', factType: 'device_locked' };
    return { role: 'observed', modality: 'digital_activity', factType: 'digital_active' };
  }
  return { role: 'observed', modality: 'other', factType: 'other' };
}

function movementFactType(value: unknown): EvidenceFactType {
  const activity = String(value ?? '').toLowerCase();
  return ['walking', 'running', 'cycling', 'on_foot', 'automotive', 'moving'].includes(activity) ? 'movement' : 'other';
}

function healthClassification(value: unknown): {
  role: EvidenceRole;
  modality: EvidenceModality;
  factType: EvidenceFactType;
} {
  const metric = String(value ?? '').toLowerCase().replace(/[- ]/g, '_');
  if (metric.includes('sleep')) return { role: 'observed', modality: 'physiology', factType: 'sleep' };
  if (metric.includes('heart') || metric.includes('heartrate')) return { role: 'observed', modality: 'physiology', factType: 'heart_rate' };
  if (metric.includes('step')) return { role: 'observed', modality: 'motion', factType: 'steps' };
  if (metric.includes('workout') || metric.includes('exercise') || metric.includes('activity_record')) {
    return { role: 'observed', modality: 'workout_record', factType: 'workout' };
  }
  return { role: 'observed', modality: 'physiology', factType: 'other' };
}

function clamp(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
