import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { DayRecord, TimelineEvent } from '../domain/types';
import { demoDays } from '../fixtures/demoPeriods';
import { syntheticMultiDayLocationTrace } from '../fixtures/syntheticLocationTrace';
import { clusterKnownPlaces, KnownPlaceClusteringResult } from '../reconstruction/knownPlaceEngine';
import { captureCurrentLocation, inspectLocationCollector, startBackgroundLocation } from '../collectors/locationCollector';
import { connectOrSyncHuaweiHealth, inspectDesktopCollector, inspectHuaweiHealthConnector, syncDesktopObservations, syncHuaweiHealthObservations } from '../collectors/desktopCollectorClient';
import { LocationReconstructionResult, reconstructLocationDay } from '../reconstruction/locationEngine';
import { desktopDayToRecord, reconstructDesktopActivity } from '../reconstruction/desktopActivityEngine';
import { CollectorStatus, EventCorrection, LocationSegmentRecord, RepositoryDiagnostics, TimelineRepository } from './contracts';
import { getTimelineRepository } from './timelineRepository';

interface UpdateEventInput {
  dayId: string;
  eventId: string;
  action: EventCorrection['action'];
  correctedTitle?: string;
}

export function useTimelineStore() {
  const repository = useMemo(() => getTimelineRepository(), []);
  const [days, setDays] = useState<DayRecord[]>([]);
  const [collectorStatuses, setCollectorStatuses] = useState<CollectorStatus[]>([]);
  const [diagnostics, setDiagnostics] = useState<RepositoryDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastReconstruction, setLastReconstruction] = useState<LocationReconstructionResult | null>(null);
  const [locationSegments, setLocationSegments] = useState<LocationSegmentRecord[]>([]);
  const [knownPlaceClustering, setKnownPlaceClustering] = useState<KnownPlaceClusteringResult>({ places: [], assignments: [] });
  const desktopSyncInFlight = useRef(false);

  const refresh = useCallback(async () => {
    const [storedDays, statuses, repositoryDiagnostics, storedSegments] = await Promise.all([
      repository.listDays(),
      repository.listCollectorStatuses(),
      repository.getDiagnostics(),
      repository.listLocationSegments(),
    ]);
    setDays(storedDays);
    setCollectorStatuses(statuses);
    setDiagnostics(repositoryDiagnostics);
    setLocationSegments(storedSegments);
    setKnownPlaceClustering(clusterKnownPlaces(storedSegments));
  }, [repository]);

  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await repository.initialize(demoDays);
      await reconstructStoredLocationDays(repository);
      try {
        await repository.upsertCollectorStatus(await inspectLocationCollector());
      } catch {
        await repository.upsertCollectorStatus({
          source: 'location',
          state: 'temporarily_unavailable',
          detail: 'Location capability could not be evaluated in this runtime.',
          updatedAt: new Date().toISOString(),
        });
      }
      const desktopStatus = await inspectDesktopCollector();
      await repository.upsertCollectorStatus(desktopStatus);
      if (desktopStatus.state === 'available_limited') {
        try {
          await syncDesktopObservations(repository);
        } catch {
          // A companion can stop between inspection and import; existing data remains usable.
        }
      }
      await reconstructStoredDesktopDays(repository);
      await repository.upsertCollectorStatus(await inspectHuaweiHealthConnector());
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ATIRA could not open its local data store.');
    } finally {
      setLoading(false);
    }
  }, [refresh, repository]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (loading || Platform.OS !== 'web') return undefined;
    const pollDesktop = async () => {
      if (desktopSyncInFlight.current) return;
      desktopSyncInFlight.current = true;
      try {
        await syncDesktopObservations(repository);
        await reconstructStoredDesktopDays(repository);
        const huaweiStatus = await inspectHuaweiHealthConnector();
        await repository.upsertCollectorStatus(huaweiStatus);
        if (huaweiStatus.state === 'available_limited') {
          try {
            await syncHuaweiHealthObservations(repository);
          } catch {
            // Authorization can be revoked at any time; the last imported history remains intact.
          }
        }
        await refresh();
      } catch {
        // Automatic polling is intentionally quiet when the optional companion is offline.
      } finally {
        desktopSyncInFlight.current = false;
      }
    };
    const timer = setInterval(() => void pollDesktop(), 30_000);
    return () => clearInterval(timer);
  }, [loading, refresh, repository]);

  const updateEvent = useCallback(async ({ dayId, eventId, action, correctedTitle }: UpdateEventInput) => {
    const currentDay = days.find((day) => day.id === dayId);
    const currentEvent = currentDay?.events.find((event) => event.id === eventId);
    if (!currentDay || !currentEvent) throw new Error('The selected event is no longer available.');

    const updatedEvent: TimelineEvent = {
      ...currentEvent,
      title: correctedTitle ?? currentEvent.title,
      state: action === 'confirm' ? 'confirmed' : 'corrected',
      confidence: 1,
    };
    const createdAt = new Date().toISOString();
    const correction: EventCorrection = {
      id: `correction-${createdAt}-${Math.random().toString(36).slice(2, 9)}`,
      dayId,
      eventId,
      action,
      previousTitle: currentEvent.title,
      correctedTitle: updatedEvent.title,
      createdAt,
    };

    await repository.saveEvent(dayId, updatedEvent, correction);
    setDays((current) => current.map((day) => day.id === dayId
      ? { ...day, events: day.events.map((event) => event.id === eventId ? updatedEvent : event) }
      : day));
    setDiagnostics(await repository.getDiagnostics());
  }, [days, repository]);

  const captureLocation = useCallback(async () => {
    setActionError(null);
    try {
      await captureCurrentLocation(repository);
      await reconstructStoredLocationDays(repository);
      await refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'ATIRA could not capture a location sample.';
      setActionError(message);
      throw cause;
    }
  }, [refresh, repository]);

  const enableBackgroundLocation = useCallback(async () => {
    setActionError(null);
    try {
      await startBackgroundLocation(repository);
      await refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'ATIRA could not start background location.';
      setActionError(message);
      throw cause;
    }
  }, [refresh, repository]);

  const syncDesktopActivity = useCallback(async () => {
    setActionError(null);
    try {
      await syncDesktopObservations(repository);
      await reconstructStoredDesktopDays(repository);
      await refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Desktop companion activity could not be synced.';
      setActionError(message);
      throw cause;
    }
  }, [refresh, repository]);

  const runSyntheticReconstruction = useCallback(async () => {
    setActionError(null);
    try {
      await repository.appendObservations(syntheticMultiDayLocationTrace);
      const results = await reconstructStoredLocationDays(repository);
      const result = results.find((item) => item.dayId === '2026-07-20') ?? reconstructLocationDay('2026-07-20', []);
      setLastReconstruction(result);
      await refresh();
      return result;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'ATIRA could not reconstruct the sample trace.';
      setActionError(message);
      throw cause;
    }
  }, [refresh, repository]);

  const connectHuaweiHealth = useCallback(async () => {
    setActionError(null);
    try {
      await connectOrSyncHuaweiHealth(repository);
      await refresh();
    } catch (cause) {
      const message = cause instanceof Error ? `HUAWEI Health: ${cause.message}` : 'HUAWEI Health could not be connected.';
      setActionError(message);
      throw cause;
    }
  }, [refresh, repository]);

  return {
    days,
    collectorStatuses,
    diagnostics,
    loading,
    error,
    actionError,
    lastReconstruction,
    locationSegments,
    knownPlaceClustering,
    retry: initialize,
    refresh,
    updateEvent,
    captureLocation,
    enableBackgroundLocation,
    syncDesktopActivity,
    connectHuaweiHealth,
    runSyntheticReconstruction,
  };
}

async function reconstructStoredLocationDays(repository: TimelineRepository) {
  const observations = await repository.listObservations({ source: 'location' });
  const byDay = new Map<string, typeof observations>();
  for (const observation of observations) {
    const dayId = observation.startedAt.slice(0, 10);
    const dayObservations = byDay.get(dayId) ?? [];
    dayObservations.push(observation);
    byDay.set(dayId, dayObservations);
  }
  const results: LocationReconstructionResult[] = [];
  for (const [dayId, dayObservations] of byDay) {
    const result = reconstructLocationDay(dayId, dayObservations);
    await repository.replaceLocationSegments(dayId, result.segments);
    results.push(result);
  }
  return results;
}

async function reconstructStoredDesktopDays(repository: TimelineRepository) {
  const [observations, existingDays] = await Promise.all([
    repository.listObservations({ source: 'desktop' }),
    repository.listDays(),
  ]);
  const existingById = new Map(existingDays.map((day) => [day.id, day]));
  for (const result of reconstructDesktopActivity(observations)) {
    const existing = existingById.get(result.dayId);
    const desktopRecord = desktopDayToRecord(result, existing);
    const nonDesktopEvents = (existing?.events ?? []).filter((event) => !event.evidence.some((item) => item.source === 'desktop'));
    const record = existing && nonDesktopEvents.length > 0
      ? {
          ...existing,
          desktopUsage: desktopRecord.desktopUsage,
          events: [...nonDesktopEvents, ...desktopRecord.events].sort((a, b) => a.start.localeCompare(b.start)),
        }
      : desktopRecord;
    await repository.upsertDay(record);
  }
}
