import { DayRecord, TimelineEvent } from '../domain/types';
import {
  CollectorRecord,
  CollectorStatus,
  DATABASE_SCHEMA_VERSION,
  DeviceRecord,
  EventCorrection,
  initialCollectorStatuses,
  LocationSegmentRecord,
  ObservationQuery,
  RawObservation,
  RepositoryDiagnostics,
  TimelineRepository,
} from './contracts';

const STORAGE_KEY = 'atira.prototype.repository.v1';

interface WebState {
  schemaVersion: number;
  days: DayRecord[];
  observations: RawObservation[];
  corrections: EventCorrection[];
  collectorStatuses: CollectorStatus[];
  locationSegments: LocationSegmentRecord[];
  devices: DeviceRecord[];
  collectors: CollectorRecord[];
}

let memoryState: WebState | null = null;

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function readState(): WebState | null {
  if (typeof localStorage === 'undefined') return memoryState;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as WebState;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function writeState(state: WebState) {
  memoryState = clone(state);
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

class WebTimelineRepository implements TimelineRepository {
  async initialize(seedDays: DayRecord[]) {
    const existing = readState();
    if (existing?.schemaVersion === DATABASE_SCHEMA_VERSION) return;
    if (existing && existing.schemaVersion < DATABASE_SCHEMA_VERSION) {
      const migratedObservations = existing.observations.map((observation) => ({
        ...observation,
        deviceId: observation.deviceId ?? `legacy-${observation.source}-device`,
        collectorId: observation.collectorId ?? `legacy-${observation.source}-collector`,
      }));
      const migratedDays = existing.days.map(migrateDayUsage);
      writeState({
        ...existing,
        schemaVersion: DATABASE_SCHEMA_VERSION,
        days: migratedDays,
        observations: migratedObservations,
        locationSegments: existing.locationSegments ?? [],
        devices: existing.devices ?? legacyDevices(migratedObservations),
        collectors: existing.collectors ?? legacyCollectors(migratedObservations),
      });
      return;
    }
    if (existing && existing.schemaVersion > DATABASE_SCHEMA_VERSION) {
      throw new Error('This ATIRA data store was created by a newer application version.');
    }
    writeState({
      schemaVersion: DATABASE_SCHEMA_VERSION,
      days: clone(seedDays),
      observations: [],
      corrections: [],
      collectorStatuses: clone(initialCollectorStatuses),
      locationSegments: [],
      devices: [],
      collectors: [],
    });
  }

  async listDays() {
    return clone(readState()?.days ?? []);
  }

  async upsertDay(day: DayRecord) {
    const state = readState();
    if (!state) throw new Error('Repository has not been initialized.');
    const index = state.days.findIndex((item) => item.id === day.id);
    if (index >= 0) state.days[index] = clone(day);
    else state.days.push(clone(day));
    state.days.sort((a, b) => a.id.localeCompare(b.id));
    writeState(state);
  }

  async saveEvent(dayId: string, event: TimelineEvent, correction: EventCorrection) {
    const state = readState();
    if (!state) throw new Error('Repository has not been initialized.');
    state.days = state.days.map((day) => day.id === dayId
      ? { ...day, events: day.events.map((current) => current.id === event.id ? clone(event) : current) }
      : day);
    state.corrections.push(clone(correction));
    writeState(state);
  }

  async appendObservations(observations: RawObservation[]) {
    if (observations.length === 0) return;
    const state = readState();
    if (!state) throw new Error('Repository has not been initialized.');
    const incomingById = new Map(observations.map((item) => [item.id, item]));
    state.observations = state.observations.map((item) => {
      const incoming = incomingById.get(item.id);
      if (!incoming) return item;
      incomingById.delete(item.id);
      return clone({
        ...item,
        deviceId: incoming.deviceId ?? item.deviceId,
        collectorId: incoming.collectorId ?? item.collectorId,
      });
    });
    state.observations.push(...clone([...incomingById.values()]));
    const referencedDeviceIds = new Set(state.observations.map((item) => item.deviceId).filter((id): id is string => id != null));
    const referencedCollectorIds = new Set(state.observations.map((item) => item.collectorId).filter((id): id is string => id != null));
    state.devices = state.devices.filter((device) => !device.id.startsWith('legacy-') || referencedDeviceIds.has(device.id));
    state.collectors = state.collectors.filter((collector) => collector.provider !== 'legacy_import' || referencedCollectorIds.has(collector.id));
    writeState(state);
  }

  async listObservations(query: ObservationQuery = {}) {
    const observations = readState()?.observations ?? [];
    return clone(observations.filter((item) => {
      if (query.source && item.source !== query.source) return false;
      if (query.deviceId && item.deviceId !== query.deviceId) return false;
      if (query.collectorId && item.collectorId !== query.collectorId) return false;
      if (query.from && item.startedAt < query.from) return false;
      if (query.to && item.startedAt > query.to) return false;
      return true;
    }).sort((a, b) => a.startedAt.localeCompare(b.startedAt)));
  }

  async listDevices() {
    return clone(readState()?.devices ?? []);
  }

  async upsertDevice(device: DeviceRecord) {
    const state = readState();
    if (!state) throw new Error('Repository has not been initialized.');
    const index = state.devices.findIndex((item) => item.id === device.id);
    if (index >= 0) state.devices[index] = clone({ ...state.devices[index], ...device });
    else state.devices.push(clone(device));
    writeState(state);
  }

  async listCollectors() {
    return clone(readState()?.collectors ?? []);
  }

  async upsertCollector(collector: CollectorRecord) {
    const state = readState();
    if (!state) throw new Error('Repository has not been initialized.');
    const index = state.collectors.findIndex((item) => item.id === collector.id);
    if (index >= 0) state.collectors[index] = clone({ ...state.collectors[index], ...collector });
    else state.collectors.push(clone(collector));
    writeState(state);
  }

  async replaceLocationSegments(dayId: string, segments: LocationSegmentRecord[]) {
    const state = readState();
    if (!state) throw new Error('Repository has not been initialized.');
    state.locationSegments = [
      ...(state.locationSegments ?? []).filter((item) => item.dayId !== dayId),
      ...clone(segments),
    ];
    writeState(state);
  }

  async listLocationSegments(dayId?: string) {
    const segments = readState()?.locationSegments ?? [];
    return clone(segments.filter((item) => !dayId || item.dayId === dayId).sort((a, b) => a.startedAt.localeCompare(b.startedAt)));
  }

  async listCollectorStatuses() {
    return clone(readState()?.collectorStatuses ?? []);
  }

  async upsertCollectorStatus(status: CollectorStatus) {
    const state = readState();
    if (!state) throw new Error('Repository has not been initialized.');
    const index = state.collectorStatuses.findIndex((item) => item.source === status.source);
    if (index >= 0) state.collectorStatuses[index] = clone(status);
    else state.collectorStatuses.push(clone(status));
    writeState(state);
  }

  async getDiagnostics(): Promise<RepositoryDiagnostics> {
    const state = readState();
    return {
      adapter: 'web-storage',
      schemaVersion: state?.schemaVersion ?? 0,
      dayCount: state?.days.length ?? 0,
      observationCount: state?.observations.length ?? 0,
      correctionCount: state?.corrections.length ?? 0,
      segmentCount: state?.locationSegments?.length ?? 0,
      deviceCount: state?.devices?.length ?? 0,
      collectorCount: state?.collectors?.length ?? 0,
    };
  }
}

function migrateDayUsage(day: DayRecord): DayRecord {
  const legacy = day as DayRecord & { desktopUsage?: DayRecord['desktopUsages'] extends (infer T)[] | undefined ? T : never };
  if (!legacy.desktopUsage || legacy.desktopUsages) return day;
  const { desktopUsage, ...rest } = legacy;
  return { ...rest, desktopUsages: [desktopUsage] };
}

function legacyDevices(observations: RawObservation[]): DeviceRecord[] {
  const sources = [...new Set(observations.map((item) => item.source))];
  return sources.map((source) => ({
    id: `legacy-${source}-device`,
    deviceClass: source === 'desktop' ? 'computer' : 'other',
    platform: source === 'desktop' ? 'windows' : 'unknown',
    label: source === 'desktop' ? 'Legacy Windows computer' : `Legacy ${source} source`,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  }));
}

function legacyCollectors(observations: RawObservation[]): CollectorRecord[] {
  const sources = [...new Set(observations.map((item) => item.source))];
  return sources.map((source) => ({
    id: `legacy-${source}-collector`,
    deviceId: `legacy-${source}-device`,
    source,
    provider: 'legacy_import',
    label: `Legacy ${source} collector`,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  }));
}

const repository = new WebTimelineRepository();

export function getTimelineRepository(): TimelineRepository {
  return repository;
}
