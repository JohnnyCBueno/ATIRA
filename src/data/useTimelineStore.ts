import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { DayRecord, DigitalActivityRule, TimelineEvent } from '../domain/types';
import { syntheticMultiDayLocationTrace } from '../fixtures/syntheticLocationTrace';
import { clusterKnownPlaces, KnownPlaceClusteringResult } from '../reconstruction/knownPlaceEngine';
import { captureCurrentLocation, inspectLocationCollector, startBackgroundLocation } from '../collectors/locationCollector';
import { enrichStoredApplePlaceCandidates } from '../collectors/applePlaceCandidateProvider';
import { assessCollectorHealth } from '../collectors/collectorHealth';
import {
  BrowserIntegrationStatus,
  connectOrSyncHuaweiHealth,
  createBrowserPairingCode,
  createDesktopDevicePairingCode,
  deleteDesktopCollectorHistory,
  disconnectDesktopMobileDevice,
  DesktopDeviceConnectionStatus,
  inspectBrowserIntegration,
  inspectDesktopCollectionControl,
  inspectDesktopCollector,
  inspectDesktopMobileDevice,
  inspectHuaweiHealthConnector,
  pairDesktopMobileDevice,
  setDesktopCollectionPaused,
  syncDesktopObservations,
  syncHuaweiHealthObservations,
  unpairBrowserIntegration,
} from '../collectors/desktopCollectorClient';
import { locationDayResultToRecord } from '../reconstruction/locationDayPresentation';
import { LocationReconstructionResult, reconstructLocationDay } from '../reconstruction/locationEngine';
import { desktopDayResultsToRecord, reconstructDesktopActivity, withoutDesktopDerivedData } from '../reconstruction/desktopActivityEngine';
import {
  CollectorStatus,
  DeviceRecord,
  EventCorrection,
  LocationSegmentRecord,
  PlaceCandidateSetRecord,
  RawObservation,
  RepositoryDiagnostics,
  TimelineRepository,
} from './contracts';
import { databaseStartupMessage } from './databaseReliability';
import { ensureCurrentDay } from './currentDay';
import { localDayIdForTimestamp } from './localDay';
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
  const [placeCandidateSets, setPlaceCandidateSets] = useState<PlaceCandidateSetRecord[]>([]);
  const [knownPlaceClustering, setKnownPlaceClustering] = useState<KnownPlaceClusteringResult>({ places: [], assignments: [] });
  const [observations, setObservations] = useState<RawObservation[]>([]);
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [digitalActivityRules, setDigitalActivityRules] = useState<DigitalActivityRule[]>([]);
  const [desktopControl, setDesktopControl] = useState({ available: false, paused: false, running: false });
  const [browserIntegration, setBrowserIntegration] = useState<BrowserIntegrationStatus>({ paired: false, pairedAt: null, lastObservedAt: null, available: false, connectedBrowserCount: 0, browsers: [] });
  const [desktopDeviceConnection, setDesktopDeviceConnection] = useState<DesktopDeviceConnectionStatus>({ supported: Platform.OS !== 'web', paired: false, address: null, deviceLabel: null, pairedAt: null, lastSyncedAt: null });
  const desktopSyncInFlight = useRef(false);
  const foregroundRefreshInFlight = useRef(false);
  const collectorHealth = useMemo(() => collectorStatuses.map((status) => assessCollectorHealth(status)), [collectorStatuses]);

  const refresh = useCallback(async () => {
    await ensureCurrentDay(repository);
    const [storedDays, statuses, repositoryDiagnostics, storedSegments, storedPlaceCandidateSets, storedObservations, storedDevices, storedRules] = await Promise.all([
      repository.listDays(),
      repository.listCollectorStatuses(),
      repository.getDiagnostics(),
      repository.listLocationSegments(),
      repository.listPlaceCandidateSets(),
      repository.listObservations(),
      repository.listDevices(),
      repository.listDigitalActivityRules(),
    ]);
    setDays(storedDays);
    setCollectorStatuses(statuses);
    setDiagnostics(repositoryDiagnostics);
    setLocationSegments(storedSegments);
    setPlaceCandidateSets(storedPlaceCandidateSets);
    setKnownPlaceClustering(clusterKnownPlaces(storedSegments));
    setObservations(storedObservations);
    setDevices(storedDevices);
    setDigitalActivityRules(storedRules);
  }, [repository]);

  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await repository.initialize([]);
      await reconstructStoredLocationDays(repository);
      await enrichStoredApplePlaceCandidates(repository);
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
      await ensureCurrentDay(repository);
      await repository.upsertCollectorStatus(await inspectHuaweiHealthConnector());
      setDesktopControl(await inspectDesktopCollectionControl());
      setBrowserIntegration(await inspectBrowserIntegration());
      setDesktopDeviceConnection(await inspectDesktopMobileDevice());
      await refresh();
    } catch (cause) {
      setError(databaseStartupMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [refresh, repository]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' || loading || foregroundRefreshInFlight.current) return;
      foregroundRefreshInFlight.current = true;
      void (async () => {
        await reconstructStoredLocationDays(repository);
        await enrichStoredApplePlaceCandidates(repository);
        await repository.upsertCollectorStatus(await inspectLocationCollector());
        await refresh();
      })().catch(() => {
        // Existing timeline data remains available if a foreground refresh fails.
      }).finally(() => {
        foregroundRefreshInFlight.current = false;
      });
    });
    return () => subscription.remove();
  }, [loading, refresh, repository]);

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
        setBrowserIntegration(await inspectBrowserIntegration());
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
      await enrichStoredApplePlaceCandidates(repository);
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

  const updateDeviceLabel = useCallback(async (deviceId: string, label: string) => {
    const current = devices.find((device) => device.id === deviceId);
    const trimmed = label.trim();
    if (!current || !trimmed) return;
    await repository.upsertDevice({ ...current, label: trimmed, updatedAt: new Date().toISOString() });
    await reconstructStoredDesktopDays(repository);
    await refresh();
  }, [devices, refresh, repository]);

  const upsertDigitalActivityRule = useCallback(async (input: Omit<DigitalActivityRule, 'id' | 'createdAt' | 'updatedAt'>) => {
    const existing = digitalActivityRules.find((rule) => rule.deviceId === input.deviceId && rule.applicationId === input.applicationId);
    const now = new Date().toISOString();
    await repository.upsertDigitalActivityRule({
      ...input,
      id: existing?.id ?? `${input.deviceId}:${input.applicationId}`,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    await reconstructStoredDesktopDays(repository);
    await refresh();
  }, [digitalActivityRules, refresh, repository]);

  const deleteDigitalActivityRule = useCallback(async (id: string) => {
    await repository.deleteDigitalActivityRule(id);
    await reconstructStoredDesktopDays(repository);
    await refresh();
  }, [refresh, repository]);

  const setDesktopPaused = useCallback(async (paused: boolean) => {
    setActionError(null);
    try {
      const state = await setDesktopCollectionPaused(paused);
      setDesktopControl({ available: true, ...state });
      await repository.upsertCollectorStatus(await inspectDesktopCollector());
      await refresh();
    } catch (cause) {
      const message = cause instanceof Error ? `Desktop companion: ${cause.message}` : 'Desktop companion control failed.';
      setActionError(message);
      throw cause;
    }
  }, [refresh, repository]);

  const deleteDesktopHistory = useCallback(async (range: '7d' | '30d' | 'all') => {
    setActionError(null);
    try {
      const from = range === 'all' ? undefined : new Date(Date.now() - (range === '7d' ? 7 : 30) * 86_400_000).toISOString();
      const affected = await repository.listObservations({ source: 'desktop', from });
      await deleteDesktopCollectorHistory(range);
      await repository.deleteObservations({ source: 'desktop', from });
      await clearDesktopDerivedDays(repository, new Set(affected.map((item) => item.startedAt.slice(0, 10))));
      await refresh();
    } catch (cause) {
      const message = cause instanceof Error ? `Desktop companion: ${cause.message}` : 'Desktop history could not be deleted.';
      setActionError(message);
      throw cause;
    }
  }, [refresh, repository]);

  const requestBrowserPairingCode = useCallback(async () => {
    const result = await createBrowserPairingCode();
    setBrowserIntegration(await inspectBrowserIntegration());
    return result;
  }, []);

  const disconnectBrowserIntegration = useCallback(async () => {
    setBrowserIntegration(await unpairBrowserIntegration());
  }, []);

  const requestDesktopDevicePairingCode = useCallback(() => createDesktopDevicePairingCode(), []);

  const pairDesktopMobile = useCallback(async (address: string, code: string) => {
    setActionError(null);
    try {
      setDesktopDeviceConnection(await pairDesktopMobileDevice(address, code));
      await syncDesktopObservations(repository);
      await reconstructStoredDesktopDays(repository);
      await refresh();
      setDesktopDeviceConnection(await inspectDesktopMobileDevice());
    } catch (cause) {
      const message = cause instanceof Error ? `Desktop companion: ${cause.message}` : 'The iPhone could not pair with Windows.';
      setActionError(message);
      throw cause;
    }
  }, [refresh, repository]);

  const disconnectDesktopMobile = useCallback(async () => {
    setDesktopDeviceConnection(await disconnectDesktopMobileDevice());
  }, []);

  const confirmPlaceCandidate = useCallback(async (segmentId: string, candidateId?: string) => {
    const candidateSet = placeCandidateSets.find((item) => item.segmentId === segmentId);
    if (!candidateSet) return;
    if (candidateId && !candidateSet.candidates.some((candidate) => candidate.id === candidateId)) return;
    const timestamp = new Date().toISOString();
    const updated: PlaceCandidateSetRecord = {
      ...candidateSet,
      decision: candidateId
        ? { kind: 'candidate', candidateId, createdAt: timestamp }
        : { kind: 'somewhere_else', createdAt: timestamp },
      updatedAt: timestamp,
    };
    await repository.upsertPlaceCandidateSet(updated);
    setPlaceCandidateSets((current) => current.map((item) => item.segmentId === segmentId ? updated : item));
    setDiagnostics(await repository.getDiagnostics());
  }, [placeCandidateSets, repository]);

  return {
    days,
    collectorStatuses,
    collectorHealth,
    diagnostics,
    loading,
    error,
    actionError,
    lastReconstruction,
    locationSegments,
    placeCandidateSets,
    knownPlaceClustering,
    observations,
    devices,
    digitalActivityRules,
    desktopControl,
    browserIntegration,
    desktopDeviceConnection,
    retry: initialize,
    refresh,
    updateEvent,
    captureLocation,
    enableBackgroundLocation,
    syncDesktopActivity,
    connectHuaweiHealth,
    runSyntheticReconstruction,
    updateDeviceLabel,
    upsertDigitalActivityRule,
    deleteDigitalActivityRule,
    setDesktopPaused,
    deleteDesktopHistory,
    requestBrowserPairingCode,
    disconnectBrowserIntegration,
    requestDesktopDevicePairingCode,
    pairDesktopMobile,
    disconnectDesktopMobile,
    confirmPlaceCandidate,
  };
}

async function reconstructStoredLocationDays(repository: TimelineRepository) {
  const [observations, existingDays, existingSegments] = await Promise.all([
    repository.listObservations({ source: 'location' }),
    repository.listDays(),
    repository.listLocationSegments(),
  ]);
  const existingById = new Map(existingDays.map((day) => [day.id, day]));
  const byDay = new Map<string, typeof observations>();
  for (const observation of observations) {
    const dayId = localDayIdForTimestamp(observation.startedAt);
    const dayObservations = byDay.get(dayId) ?? [];
    dayObservations.push(observation);
    byDay.set(dayId, dayObservations);
  }
  const affectedDayIds = new Set([
    ...byDay.keys(),
    ...existingSegments.map((segment) => segment.dayId),
  ]);
  const results: LocationReconstructionResult[] = [];
  for (const dayId of [...affectedDayIds].sort()) {
    const dayObservations = byDay.get(dayId) ?? [];
    const result = reconstructLocationDay(dayId, dayObservations);
    await repository.replaceLocationSegments(dayId, result.segments);
    const existing = existingById.get(dayId);
    if (dayObservations.length > 0 || existing) {
      const record = locationDayResultToRecord(result, existing);
      await repository.upsertDay(record);
      existingById.set(dayId, record);
    }
    results.push(result);
  }
  return results;
}

async function reconstructStoredDesktopDays(repository: TimelineRepository) {
  const [observations, devices, existingDays, rules] = await Promise.all([
    repository.listObservations({ source: 'desktop' }),
    repository.listDevices(),
    repository.listDays(),
    repository.listDigitalActivityRules(),
  ]);
  const existingById = new Map(existingDays.map((day) => [day.id, day]));
  const resultsByDay = new Map<string, ReturnType<typeof reconstructDesktopActivity>>();
  const observedDesktopDayIds = new Set(observations.map((observation) => observation.startedAt.slice(0, 10)));
  for (const result of reconstructDesktopActivity(observations, devices, rules)) {
    const dayResults = resultsByDay.get(result.dayId) ?? [];
    dayResults.push(result);
    resultsByDay.set(result.dayId, dayResults);
  }
  for (const dayId of observedDesktopDayIds) {
    const existing = existingById.get(dayId);
    const results = resultsByDay.get(dayId) ?? [];
    if (results.length === 0) {
      if (existing) await repository.upsertDay(withoutDesktopDerivedData(existing));
      continue;
    }
    const desktopRecord = desktopDayResultsToRecord(results, existing);
    const nonDesktopEvents = (existing?.events ?? []).filter((event) => !event.evidence.some((item) => item.source === 'desktop'));
    const record = existing && nonDesktopEvents.length > 0
      ? {
          ...existing,
          coverage: desktopRecord.coverage,
          understood: desktopRecord.understood,
          work: desktopRecord.work,
          learning: desktopRecord.learning,
          desktopUsages: desktopRecord.desktopUsages,
          events: [...nonDesktopEvents, ...desktopRecord.events].sort((a, b) => a.start.localeCompare(b.start)),
        }
      : desktopRecord;
    await repository.upsertDay(record);
  }
}

async function clearDesktopDerivedDays(repository: TimelineRepository, dayIds: Set<string>) {
  if (dayIds.size === 0) return;
  const days = await repository.listDays();
  for (const day of days.filter((item) => dayIds.has(item.id))) {
    await repository.upsertDay(withoutDesktopDerivedData(day));
  }
}
