import {
  getHealthKitAuthorizationRequestStatus,
  isHealthKitModuleAvailable,
  queryRecentHealthKitSamples,
  requestHealthKitReadAuthorization,
} from '../../modules/atira-healthkit';
import {
  CollectorStatus,
  TimelineRepository,
} from '../data/contracts';
import { normalizeHealthKitSamples } from './healthKitNormalization';

const HEALTHKIT_HISTORY_DAYS = 7;

export async function inspectHealthKitCollector(): Promise<CollectorStatus> {
  const updatedAt = new Date().toISOString();
  if (!isHealthKitModuleAvailable()) {
    return {
      source: 'health',
      state: 'temporarily_unavailable',
      detail: 'HealthKit requires the next ATIRA iPhone development build.',
      operationalState: 'offline',
      expectedHeartbeatSeconds: 86_400,
      backfillState: 'supported',
      updatedAt,
    };
  }
  const requestStatus = await getHealthKitAuthorizationRequestStatus();
  if (requestStatus === 'should_request') {
    return {
      source: 'health',
      state: 'permission_required',
      detail: 'HealthKit is available. Connect it to read the last seven days of steps, heart rate, sleep and workouts.',
      operationalState: 'unknown',
      expectedHeartbeatSeconds: 86_400,
      backfillState: 'supported',
      updatedAt,
    };
  }
  return {
    source: 'health',
    state: 'available_limited',
    detail: 'HealthKit access was previously reviewed. ATIRA can sync any currently readable samples.',
    operationalState: 'collecting',
    expectedHeartbeatSeconds: 86_400,
    backfillState: 'supported',
    updatedAt,
  };
}

export async function connectOrSyncHealthKit(repository: TimelineRepository) {
  if (!isHealthKitModuleAvailable()) {
    throw new Error('HealthKit requires the next ATIRA iPhone development build.');
  }
  const requestStatus = await getHealthKitAuthorizationRequestStatus();
  if (requestStatus !== 'unnecessary') {
    await requestHealthKitReadAuthorization();
  }
  return syncHealthKitObservations(repository);
}

export async function syncHealthKitObservations(
  repository: TimelineRepository,
  now = new Date(),
): Promise<CollectorStatus> {
  const to = now.toISOString();
  const from = new Date(now.getTime() - HEALTHKIT_HISTORY_DAYS * 86_400_000).toISOString();
  const result = await queryRecentHealthKitSamples(from, to);
  const capturedAt = new Date().toISOString();
  const records = normalizeHealthKitSamples(result.samples, capturedAt);

  for (const device of records.devices) await repository.upsertDevice(device);
  for (const collector of records.collectors) await repository.upsertCollector(collector);
  const before = await repository.getDiagnostics();
  await repository.appendObservations(records.observations);
  const after = await repository.getDiagnostics();
  const added = Math.max(0, after.observationCount - before.observationCount);
  const lastObservedAt = records.observations
    .map((item) => item.endedAt ?? item.startedAt)
    .sort()
    .at(-1);
  const status: CollectorStatus = {
    source: 'health',
    state: records.observations.length > 0 ? 'available_full' : 'available_limited',
    detail: records.observations.length > 0
      ? `HealthKit synced ${added} new sample${added === 1 ? '' : 's'} from a bounded seven-day window.`
      : 'No readable HealthKit samples were returned for the last seven days. iOS does not reveal whether a type was denied or simply empty.',
    lastObservedAt,
    lastSyncedAt: capturedAt,
    operationalState: 'collecting',
    expectedHeartbeatSeconds: 86_400,
    backfillState: 'supported',
    updatedAt: capturedAt,
  };
  await repository.upsertCollectorStatus(status);
  return status;
}
