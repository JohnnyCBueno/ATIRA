import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { CollectorStatus, TimelineRepository } from '../data/contracts';
import { captureFreshThenCached, LocationCaptureUnavailableError } from './locationCapture';
import { locationToObservation } from './locationObservations';
import { ATIRA_BACKGROUND_LOCATION_TASK } from './locationTaskName';

const FRESH_LOCATION_TIMEOUT_MS = 12_000;
const MAX_CACHED_LOCATION_AGE_MS = 5 * 60 * 1000;
const MAX_CACHED_LOCATION_ACCURACY_METRES = 250;

export async function inspectLocationCollector(): Promise<CollectorStatus> {
  const now = new Date().toISOString();
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    return { source: 'location', state: 'temporarily_unavailable', detail: 'Device location services are switched off.', operationalState: 'offline', expectedHeartbeatSeconds: 900, backfillState: 'not_supported', updatedAt: now };
  }
  const [foregroundPermission, backgroundPermission, backgroundUpdatesStarted] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
    Location.hasStartedLocationUpdatesAsync(ATIRA_BACKGROUND_LOCATION_TASK),
  ]);
  if (foregroundPermission.status === 'granted' && backgroundPermission.status === 'granted' && backgroundUpdatesStarted) {
    return {
      source: 'location',
      state: 'available_full',
      detail: 'Background location collection is registered and running.',
      operationalState: 'collecting',
      expectedHeartbeatSeconds: 900,
      backfillState: 'not_supported',
      updatedAt: now,
    };
  }
  if (foregroundPermission.status === 'granted') {
    return { source: 'location', state: 'available_limited', detail: 'Foreground location is allowed; continuous collection is not running.', operationalState: 'unknown', expectedHeartbeatSeconds: 900, backfillState: 'not_supported', updatedAt: now };
  }
  if (foregroundPermission.status === 'denied' && !foregroundPermission.canAskAgain) {
    return { source: 'location', state: 'permission_denied', detail: 'Location is blocked in system settings.', operationalState: 'unknown', expectedHeartbeatSeconds: 900, backfillState: 'not_supported', updatedAt: now };
  }
  return { source: 'location', state: 'permission_required', detail: 'Tap to store one real location observation locally.', operationalState: 'unknown', expectedHeartbeatSeconds: 900, backfillState: 'not_supported', updatedAt: now };
}

export async function captureCurrentLocation(repository: TimelineRepository): Promise<CollectorStatus> {
  const permission = await Location.requestForegroundPermissionsAsync();
  const now = new Date().toISOString();
  if (permission.status !== 'granted') {
    const status: CollectorStatus = {
      source: 'location',
      state: permission.canAskAgain ? 'permission_required' : 'permission_denied',
      detail: permission.canAskAgain ? 'Location was not allowed.' : 'Location is blocked in system settings.',
      operationalState: 'unknown',
      expectedHeartbeatSeconds: 900,
      backfillState: 'not_supported',
      updatedAt: now,
    };
    await repository.upsertCollectorStatus(status);
    return status;
  }

  try {
    const capture = await captureFreshThenCached({
      getFresh: () => Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      getCached: () => Location.getLastKnownPositionAsync({
        maxAge: MAX_CACHED_LOCATION_AGE_MS,
        requiredAccuracy: MAX_CACHED_LOCATION_ACCURACY_METRES,
      }),
      timeoutMs: FRESH_LOCATION_TIMEOUT_MS,
    });
    const observation = locationToObservation(capture.value, capture.method);
    await repository.appendObservations([observation]);
    const status: CollectorStatus = {
      source: 'location',
      state: 'available_limited',
      detail: capture.method === 'fresh'
        ? 'One fresh location sample was stored locally. Background collection remains off.'
        : 'A recent cached location sample was stored because a fresh fix was unavailable.',
      lastObservedAt: observation.startedAt,
      lastSyncedAt: new Date().toISOString(),
      operationalState: 'unknown',
      expectedHeartbeatSeconds: 900,
      backfillState: 'not_supported',
      updatedAt: new Date().toISOString(),
    };
    await repository.upsertCollectorStatus(status);
    return status;
  } catch (cause) {
    const detail = cause instanceof LocationCaptureUnavailableError
      ? cause.message
      : 'ATIRA could not read location from this device. Please try again.';
    const status: CollectorStatus = {
      source: 'location',
      state: 'temporarily_unavailable',
      detail,
      operationalState: 'offline',
      expectedHeartbeatSeconds: 900,
      backfillState: 'not_supported',
      updatedAt: new Date().toISOString(),
    };
    await repository.upsertCollectorStatus(status);
    throw new Error(detail, { cause });
  }
}

export async function startBackgroundLocation(repository: TimelineRepository): Promise<CollectorStatus> {
  const now = new Date().toISOString();
  if (Platform.OS === 'web' || !(await TaskManager.isAvailableAsync())) {
    const status: CollectorStatus = {
      source: 'location',
      state: 'unsupported_device',
      detail: 'Continuous background location requires an ATIRA development build.',
      operationalState: 'unknown',
      expectedHeartbeatSeconds: 900,
      backfillState: 'not_supported',
      updatedAt: now,
    };
    await repository.upsertCollectorStatus(status);
    return status;
  }

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') return captureDeniedBackgroundStatus(repository, foreground.canAskAgain);
  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== 'granted') return captureDeniedBackgroundStatus(repository, background.canAskAgain);

  await Location.startLocationUpdatesAsync(ATIRA_BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 50,
    deferredUpdatesDistance: 200,
    deferredUpdatesInterval: 5 * 60 * 1000,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'ATIRA is remembering your day',
      notificationBody: 'Location is processed into places and journeys on this device.',
      notificationColor: '#176B5B',
    },
  });
  const status: CollectorStatus = {
    source: 'location',
    state: 'available_full',
    detail: 'Background location collection is running.',
    operationalState: 'collecting',
    expectedHeartbeatSeconds: 900,
    backfillState: 'not_supported',
    updatedAt: now,
  };
  await repository.upsertCollectorStatus(status);
  return status;
}

async function captureDeniedBackgroundStatus(repository: TimelineRepository, canAskAgain: boolean) {
  const status: CollectorStatus = {
    source: 'location',
    state: canAskAgain ? 'permission_required' : 'permission_denied',
    detail: canAskAgain ? 'Background location was not allowed.' : 'Background location is blocked in system settings.',
    operationalState: 'unknown',
    expectedHeartbeatSeconds: 900,
    backfillState: 'not_supported',
    updatedAt: new Date().toISOString(),
  };
  await repository.upsertCollectorStatus(status);
  return status;
}
