import { DayRecord, TimelineEvent } from '../domain/types';
import {
  CollectorStatus,
  DATABASE_SCHEMA_VERSION,
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
      writeState({
        ...existing,
        schemaVersion: DATABASE_SCHEMA_VERSION,
        locationSegments: existing.locationSegments ?? [],
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
    const existingIds = new Set(state.observations.map((item) => item.id));
    state.observations.push(...clone(observations.filter((item) => !existingIds.has(item.id))));
    writeState(state);
  }

  async listObservations(query: ObservationQuery = {}) {
    const observations = readState()?.observations ?? [];
    return clone(observations.filter((item) => {
      if (query.source && item.source !== query.source) return false;
      if (query.from && item.startedAt < query.from) return false;
      if (query.to && item.startedAt > query.to) return false;
      return true;
    }).sort((a, b) => a.startedAt.localeCompare(b.startedAt)));
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
    };
  }
}

const repository = new WebTimelineRepository();

export function getTimelineRepository(): TimelineRepository {
  return repository;
}
