import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { getTimelineRepository } from '../data/timelineRepository';
import { locationToObservation } from './locationObservations';
import { ATIRA_BACKGROUND_LOCATION_TASK } from './locationTaskName';

interface BackgroundLocationData {
  locations: Location.LocationObject[];
}

if (Platform.OS !== 'web') {
  TaskManager.defineTask<BackgroundLocationData>(ATIRA_BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    const repository = getTimelineRepository();
    await repository.initialize([]);
    const now = new Date().toISOString();
    if (error) {
      await repository.upsertCollectorStatus({
        source: 'location',
        state: 'temporarily_unavailable',
        detail: error.message,
        operationalState: 'offline',
        expectedHeartbeatSeconds: 900,
        backfillState: 'not_supported',
        updatedAt: now,
      });
      return;
    }
    const observations = data?.locations.map((location) => locationToObservation(location)) ?? [];
    if (observations.length === 0) return;
    await repository.appendObservations(observations);
    await repository.upsertCollectorStatus({
      source: 'location',
      state: 'available_full',
      detail: `Background collector stored ${observations.length} new sample${observations.length === 1 ? '' : 's'}.`,
      lastObservedAt: observations[observations.length - 1].startedAt,
      lastSyncedAt: now,
      operationalState: 'collecting',
      expectedHeartbeatSeconds: 900,
      backfillState: 'not_supported',
      updatedAt: now,
    });
  });
}
