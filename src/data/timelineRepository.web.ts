import { DayRecord, DigitalActivityRule, TimelineEvent } from '../domain/types';
import {
  CollectorRecord,
  CollectorStatus,
  DATABASE_SCHEMA_VERSION,
  DeviceRecord,
  EventCorrection,
  initialCollectorStatuses,
  LocationSegmentRecord,
  ObservationQuery,
  PlaceCandidateSetRecord,
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
  activityRules: DigitalActivityRule[];
  placeCandidateSets: PlaceCandidateSetRecord[];
}

let memoryState: WebState | null = null;

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function readBrowserState(): WebState | null {
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

async function readState(): Promise<WebState | null> {
  if (globalThis.atiraDesktop) return globalThis.atiraDesktop.repository.read() as Promise<WebState | null>;
  return readBrowserState();
}

async function writeState(state: WebState) {
  memoryState = clone(state);
  if (globalThis.atiraDesktop) {
    await globalThis.atiraDesktop.repository.write(state);
    return;
  }
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

class WebTimelineRepository implements TimelineRepository {
  async initialize(seedDays: DayRecord[]) {
    const encryptedExisting = await readState();
    const legacyBrowserState = globalThis.atiraDesktop && !encryptedExisting ? readBrowserState() : null;
    const existing = encryptedExisting ?? legacyBrowserState;
    if (existing?.schemaVersion === DATABASE_SCHEMA_VERSION) {
      if (legacyBrowserState) {
        await writeState(existing);
        if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
      }
      return;
    }
    if (existing && existing.schemaVersion < DATABASE_SCHEMA_VERSION) {
      const migratedObservations = existing.observations.map((observation) => ({
        ...observation,
        deviceId: observation.deviceId ?? `legacy-${observation.source}-device`,
        collectorId: observation.collectorId ?? `legacy-${observation.source}-collector`,
      }));
      const observedDayIds = new Set(migratedObservations.map((observation) => observation.startedAt.slice(0, 10)));
      const migratedDays = existing.days.map(migrateDayUsage).map(sanitizeLegacyDemoDay).filter((day) => observedDayIds.has(day.id) || Boolean(day.desktopUsages?.length));
      await writeState({
        ...existing,
        schemaVersion: DATABASE_SCHEMA_VERSION,
        days: migratedDays,
        observations: migratedObservations,
        locationSegments: existing.locationSegments ?? [],
        devices: existing.devices ?? legacyDevices(migratedObservations),
        collectors: existing.collectors ?? legacyCollectors(migratedObservations),
        activityRules: existing.activityRules ?? [],
        placeCandidateSets: existing.placeCandidateSets ?? [],
      });
      if (legacyBrowserState && typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
      return;
    }
    if (existing && existing.schemaVersion > DATABASE_SCHEMA_VERSION) {
      throw new Error('This ATIRA data store was created by a newer application version.');
    }
    await writeState({
      schemaVersion: DATABASE_SCHEMA_VERSION,
      days: clone(seedDays),
      observations: [],
      corrections: [],
      collectorStatuses: clone(initialCollectorStatuses),
      locationSegments: [],
      devices: [],
      collectors: [],
      activityRules: [],
      placeCandidateSets: [],
    });
  }

  async listDays() {
    return clone((await readState())?.days ?? []);
  }

  async upsertDay(day: DayRecord) {
    const state = await readState();
    if (!state) throw new Error('Repository has not been initialized.');
    const index = state.days.findIndex((item) => item.id === day.id);
    if (index >= 0) state.days[index] = clone(day);
    else state.days.push(clone(day));
    state.days.sort((a, b) => a.id.localeCompare(b.id));
    await writeState(state);
  }

  async saveEvent(dayId: string, event: TimelineEvent, correction: EventCorrection) {
    const state = await readState();
    if (!state) throw new Error('Repository has not been initialized.');
    state.days = state.days.map((day) => day.id === dayId
      ? { ...day, events: day.events.map((current) => current.id === event.id ? clone(event) : current) }
      : day);
    state.corrections.push(clone(correction));
    await writeState(state);
  }

  async appendObservations(observations: RawObservation[]) {
    if (observations.length === 0) return;
    const state = await readState();
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
    await writeState(state);
  }

  async listObservations(query: ObservationQuery = {}) {
    const observations = (await readState())?.observations ?? [];
    return clone(observations.filter((item) => {
      if (query.source && item.source !== query.source) return false;
      if (query.deviceId && item.deviceId !== query.deviceId) return false;
      if (query.collectorId && item.collectorId !== query.collectorId) return false;
      if (query.from && item.startedAt < query.from) return false;
      if (query.to && item.startedAt > query.to) return false;
      return true;
    }).sort((a, b) => a.startedAt.localeCompare(b.startedAt)));
  }

  async deleteObservations(query: ObservationQuery = {}) {
    const state = await readState();
    if (!state) throw new Error('Repository has not been initialized.');
    const before = state.observations.length;
    state.observations = state.observations.filter((item) => !observationMatches(item, query));
    await writeState(state);
    return before - state.observations.length;
  }

  async listDevices() {
    return clone((await readState())?.devices ?? []);
  }

  async upsertDevice(device: DeviceRecord) {
    const state = await readState();
    if (!state) throw new Error('Repository has not been initialized.');
    const index = state.devices.findIndex((item) => item.id === device.id);
    if (index >= 0) state.devices[index] = clone({ ...state.devices[index], ...device });
    else state.devices.push(clone(device));
    await writeState(state);
  }

  async reconcileLegacyDesktopIdentity(device: DeviceRecord, collector: CollectorRecord) {
    const state = await readState();
    if (!state) throw new Error('Repository has not been initialized.');
    if (device.id.startsWith('legacy-') || device.deviceClass !== 'computer' || device.platform !== 'windows') return 0;
    // Until cross-device sync exists, every Windows companion identity in this
    // repository was created by an earlier collector on this same installation.
    const legacyDeviceIds = new Set(state.devices
      .filter((item) => item.id !== device.id && item.deviceClass === 'computer' && item.platform === 'windows' && (
        item.id.startsWith('legacy-desktop-') || state.collectors.some((candidate) => candidate.deviceId === item.id && candidate.provider === 'atira_windows_companion')
      ))
      .map((item) => item.id));
    legacyDeviceIds.add('legacy-desktop-device');
    let reconciled = 0;
    state.observations = state.observations.map((observation) => {
      if (observation.source !== 'desktop' || !observation.deviceId || !legacyDeviceIds.has(observation.deviceId)) return observation;
      reconciled += 1;
      return { ...observation, deviceId: device.id, collectorId: collector.id };
    });
    const currentRules = new Map(state.activityRules
      .filter((rule) => rule.deviceId === device.id)
      .map((rule) => [rule.applicationId, rule]));
    const movedRules = state.activityRules.flatMap((rule): DigitalActivityRule[] => {
      if (!legacyDeviceIds.has(rule.deviceId)) return [rule];
      if (currentRules.has(rule.applicationId)) return [];
      const moved = { ...rule, id: `${device.id}:${rule.applicationId}`, deviceId: device.id, updatedAt: new Date().toISOString() };
      currentRules.set(rule.applicationId, moved);
      return [moved];
    });
    state.activityRules = movedRules;
    const referencedDevices = new Set(state.observations.map((item) => item.deviceId));
    const referencedCollectors = new Set(state.observations.map((item) => item.collectorId));
    state.devices = state.devices.filter((item) => !legacyDeviceIds.has(item.id) || referencedDevices.has(item.id));
    state.collectors = state.collectors.filter((item) => !legacyDeviceIds.has(item.deviceId) || referencedCollectors.has(item.id));
    await writeState(state);
    return reconciled;
  }

  async listDigitalActivityRules() {
    return clone((await readState())?.activityRules ?? []);
  }

  async upsertDigitalActivityRule(rule: DigitalActivityRule) {
    const state = await readState();
    if (!state) throw new Error('Repository has not been initialized.');
    state.activityRules ??= [];
    const index = state.activityRules.findIndex((item) => item.id === rule.id);
    if (index >= 0) state.activityRules[index] = clone({ ...state.activityRules[index], ...rule });
    else state.activityRules.push(clone(rule));
    await writeState(state);
  }

  async deleteDigitalActivityRule(id: string) {
    const state = await readState();
    if (!state) throw new Error('Repository has not been initialized.');
    state.activityRules = (state.activityRules ?? []).filter((item) => item.id !== id);
    await writeState(state);
  }

  async listCollectors() {
    return clone((await readState())?.collectors ?? []);
  }

  async upsertCollector(collector: CollectorRecord) {
    const state = await readState();
    if (!state) throw new Error('Repository has not been initialized.');
    const index = state.collectors.findIndex((item) => item.id === collector.id);
    if (index >= 0) state.collectors[index] = clone({ ...state.collectors[index], ...collector });
    else state.collectors.push(clone(collector));
    await writeState(state);
  }

  async replaceLocationSegments(dayId: string, segments: LocationSegmentRecord[]) {
    const state = await readState();
    if (!state) throw new Error('Repository has not been initialized.');
    state.locationSegments = [
      ...(state.locationSegments ?? []).filter((item) => item.dayId !== dayId),
      ...clone(segments),
    ];
    await writeState(state);
  }

  async listLocationSegments(dayId?: string) {
    const segments = (await readState())?.locationSegments ?? [];
    return clone(segments.filter((item) => !dayId || item.dayId === dayId).sort((a, b) => a.startedAt.localeCompare(b.startedAt)));
  }

  async listPlaceCandidateSets(dayId?: string) {
    const candidateSets = (await readState())?.placeCandidateSets ?? [];
    return clone(candidateSets
      .filter((item) => !dayId || item.dayId === dayId)
      .sort((left, right) => left.searchedAt.localeCompare(right.searchedAt)));
  }

  async upsertPlaceCandidateSet(candidateSet: PlaceCandidateSetRecord) {
    const state = await readState();
    if (!state) throw new Error('Repository has not been initialized.');
    state.placeCandidateSets ??= [];
    const index = state.placeCandidateSets.findIndex((item) => item.segmentId === candidateSet.segmentId);
    if (index >= 0) state.placeCandidateSets[index] = clone(candidateSet);
    else state.placeCandidateSets.push(clone(candidateSet));
    await writeState(state);
  }

  async listCollectorStatuses() {
    return clone((await readState())?.collectorStatuses ?? []);
  }

  async upsertCollectorStatus(status: CollectorStatus) {
    const state = await readState();
    if (!state) throw new Error('Repository has not been initialized.');
    const index = state.collectorStatuses.findIndex((item) => item.source === status.source);
    if (index >= 0) state.collectorStatuses[index] = clone(status);
    else state.collectorStatuses.push(clone(status));
    await writeState(state);
  }

  async getDiagnostics(): Promise<RepositoryDiagnostics> {
    const state = await readState();
    return {
      adapter: globalThis.atiraDesktop ? 'desktop-encrypted' : 'web-storage',
      schemaVersion: state?.schemaVersion ?? 0,
      dayCount: state?.days.length ?? 0,
      observationCount: state?.observations.length ?? 0,
      correctionCount: state?.corrections.length ?? 0,
      segmentCount: state?.locationSegments?.length ?? 0,
      deviceCount: state?.devices?.length ?? 0,
      collectorCount: state?.collectors?.length ?? 0,
      activityRuleCount: state?.activityRules?.length ?? 0,
      placeCandidateSetCount: state?.placeCandidateSets?.length ?? 0,
    };
  }
}

function migrateDayUsage(day: DayRecord): DayRecord {
  const legacy = day as DayRecord & { desktopUsage?: DayRecord['desktopUsages'] extends (infer T)[] | undefined ? T : never };
  if (!legacy.desktopUsage || legacy.desktopUsages) return day;
  const { desktopUsage, ...rest } = legacy;
  return { ...rest, desktopUsages: [desktopUsage] };
}

function sanitizeLegacyDemoDay(day: DayRecord): DayRecord {
  if (!['2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18', '2026-07-19', '2026-07-20'].includes(day.id)) return day;
  const desktopEvents = day.events.filter((event) => event.evidence.some((evidence) => evidence.source === 'desktop'));
  return {
    ...day,
    coverage: day.desktopUsages?.length ? day.coverage : 0,
    understood: day.desktopUsages?.length ? day.understood : '0m',
    work: day.desktopUsages?.length ? day.work : '0m',
    movement: '—',
    learning: day.desktopUsages?.length ? day.learning : '0m',
    distance: '—',
    routePath: '',
    inferredRoutePath: undefined,
    places: [],
    events: desktopEvents,
  };
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

function observationMatches(item: RawObservation, query: ObservationQuery) {
  if (query.source && item.source !== query.source) return false;
  if (query.deviceId && item.deviceId !== query.deviceId) return false;
  if (query.collectorId && item.collectorId !== query.collectorId) return false;
  if (query.from && item.startedAt < query.from) return false;
  if (query.to && item.startedAt > query.to) return false;
  return true;
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
