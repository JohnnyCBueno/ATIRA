import { CollectorOperationalState, CollectorStatus } from '../data/contracts';
import { EvidenceSource } from '../domain/types';

export type CollectorHealthState =
  | 'healthy'
  | 'delayed'
  | 'paused'
  | 'offline'
  | 'setup_required'
  | 'coverage_gap'
  | 'unknown';

export interface CollectorHealthAssessment {
  source: EvidenceSource;
  state: CollectorHealthState;
  operationalState: CollectorOperationalState;
  checkedAt: string;
  lastObservedAt?: string;
  lastSyncedAt?: string;
  staleAfterSeconds: number;
  ageSeconds?: number;
  reason: string;
}

const defaultHeartbeatSeconds: Record<EvidenceSource, number> = {
  location: 900,
  motion: 900,
  phone: 900,
  health: 86_400,
  calendar: 86_400,
  desktop: 120,
};

/**
 * Turns a collector's operational report into a small, source-neutral health
 * assessment. This intentionally does not infer historical coverage: a live
 * collector proves only that it is live now, not that it captured an earlier
 * period.
 */
export function assessCollectorHealth(status: CollectorStatus, checkedAt = new Date().toISOString()): CollectorHealthAssessment {
  const checkedAtMs = parseTimestamp(checkedAt) ?? Date.now();
  const heartbeatSeconds = positiveFinite(status.expectedHeartbeatSeconds) ?? defaultHeartbeatSeconds[status.source];
  const staleAfterSeconds = heartbeatSeconds * 2;
  const reportedAt = parseTimestamp(status.updatedAt);
  const ageSeconds = reportedAt == null ? undefined : Math.max(0, Math.floor((checkedAtMs - reportedAt) / 1_000));
  const operationalState = status.operationalState ?? operationalFallback(status);

  if (operationalState === 'paused') return result(status, 'paused', operationalState, checkedAt, staleAfterSeconds, ageSeconds, 'Collection is intentionally paused. This time must remain a coverage gap.');
  if (status.state === 'permission_required' || status.state === 'permission_denied') return result(status, 'setup_required', operationalState, checkedAt, staleAfterSeconds, ageSeconds, status.detail);
  if (status.state === 'missing_coverage') return result(status, 'coverage_gap', operationalState, checkedAt, staleAfterSeconds, ageSeconds, status.detail);
  if (status.state === 'temporarily_unavailable' || operationalState === 'offline') return result(status, 'offline', operationalState, checkedAt, staleAfterSeconds, ageSeconds, status.detail);
  if (ageSeconds != null && ageSeconds > staleAfterSeconds) return result(status, 'delayed', operationalState, checkedAt, staleAfterSeconds, ageSeconds, `ATIRA has not received a ${status.source} health update for ${ageSeconds}s.`);
  if (status.state === 'available_full' || status.state === 'available_limited' || status.state === 'report_only') return result(status, 'healthy', operationalState, checkedAt, staleAfterSeconds, ageSeconds, status.detail);
  return result(status, 'unknown', operationalState, checkedAt, staleAfterSeconds, ageSeconds, status.detail);
}

function result(
  status: CollectorStatus,
  state: CollectorHealthState,
  operationalState: CollectorOperationalState,
  checkedAt: string,
  staleAfterSeconds: number,
  ageSeconds: number | undefined,
  reason: string,
): CollectorHealthAssessment {
  return { source: status.source, state, operationalState, checkedAt, lastObservedAt: status.lastObservedAt, lastSyncedAt: status.lastSyncedAt, staleAfterSeconds, ageSeconds, reason };
}

function operationalFallback(status: CollectorStatus): CollectorOperationalState {
  if (status.state === 'temporarily_unavailable') return 'offline';
  return 'unknown';
}

function parseTimestamp(value: string | undefined) {
  if (!value) return undefined;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : undefined;
}

function positiveFinite(value: number | undefined) {
  return value != null && Number.isFinite(value) && value > 0 ? value : undefined;
}
