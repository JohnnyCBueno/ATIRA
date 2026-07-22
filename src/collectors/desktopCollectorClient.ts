import { CollectorRecord, CollectorStatus, DeviceRecord, RawObservation, TimelineRepository } from '../data/contracts';
import { Linking } from 'react-native';

const DESKTOP_COMPANION_URL = 'http://127.0.0.1:43123';
const REQUEST_TIMEOUT_MS = 1800;

interface DesktopCompanionHealth {
  running: boolean;
  platform: string;
  completedObservationCount: number;
  currentSession: { state: string; application: string | null } | null;
  device: DeviceRecord;
  collector: CollectorRecord;
  privacy: {
    windowTitles: boolean;
    screenshots: boolean;
    keystrokes: boolean;
    documentContents: boolean;
    urls: boolean;
  };
}

interface HuaweiHealthStatus {
  configured: boolean;
  connected: boolean;
  requestedScopes: string[];
  routeScopeRequested: boolean;
  tokenStorage: string;
  detail: string;
}

export interface BrowserIntegrationStatus {
  paired: boolean;
  pairedAt: string | null;
  lastObservedAt: string | null;
  available: boolean;
  connectedBrowserCount: number;
  browsers: { browser: string; pairedAt: string; lastObservedAt: string | null }[];
}

export async function inspectDesktopCollectionControl() {
  if (!globalThis.atiraDesktop) return { available: false, paused: false, running: false };
  const status = await globalThis.atiraDesktop.collector.status();
  return { available: true, ...status };
}

export async function setDesktopCollectionPaused(paused: boolean) {
  if (!globalThis.atiraDesktop) throw new Error('Collector pause controls are available in the installed Windows app.');
  return globalThis.atiraDesktop.collector.setPaused(paused);
}

export async function deleteDesktopCollectorHistory(range: '7d' | '30d' | 'all') {
  if (!globalThis.atiraDesktop) throw new Error('Collector deletion controls are available in the installed Windows app.');
  return globalThis.atiraDesktop.collector.delete(range);
}

export async function inspectBrowserIntegration(): Promise<BrowserIntegrationStatus> {
  try {
    const status = await fetchJson<Partial<Omit<BrowserIntegrationStatus, 'available'>> & Pick<BrowserIntegrationStatus, 'paired' | 'pairedAt' | 'lastObservedAt'>>('/integrations/browser/status');
    const browsers = status.browsers ?? (status.paired ? [{ browser: 'chrome', pairedAt: status.pairedAt ?? new Date(0).toISOString(), lastObservedAt: status.lastObservedAt }] : []);
    return { ...status, browsers, connectedBrowserCount: status.connectedBrowserCount ?? browsers.length, available: Boolean(globalThis.atiraDesktop) };
  } catch {
    return { paired: false, pairedAt: null, lastObservedAt: null, available: false, connectedBrowserCount: 0, browsers: [] };
  }
}

export async function createBrowserPairingCode() {
  if (!globalThis.atiraDesktop) throw new Error('Browser pairing is available in the installed Windows app.');
  return globalThis.atiraDesktop.collector.createBrowserPairingCode();
}

export async function unpairBrowserIntegration() {
  if (!globalThis.atiraDesktop) throw new Error('Browser pairing is available in the installed Windows app.');
  await globalThis.atiraDesktop.collector.unpairBrowser();
  return inspectBrowserIntegration();
}

export async function inspectDesktopCollector(): Promise<CollectorStatus> {
  try {
    const health = await fetchJson<DesktopCompanionHealth>('/health');
    const current = health.currentSession?.application ?? health.currentSession?.state ?? 'waiting for first sample';
    return {
      source: 'desktop',
      state: 'available_limited',
      detail: `${health.device.label} is running locally. Current state: ${current}. Window titles are ${health.privacy.windowTitles ? 'enabled' : 'off'}.`,
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return {
      source: 'desktop',
      state: 'temporarily_unavailable',
      detail: 'Windows companion is not running. Start it with: npm run desktop:collector',
      updatedAt: new Date().toISOString(),
    };
  }
}

export async function syncDesktopObservations(repository: TimelineRepository): Promise<CollectorStatus> {
  let payload: { device: unknown; collector: unknown; observations: unknown[] };
  try {
    payload = await fetchJson<{ device: unknown; collector: unknown; observations: unknown[] }>('/observations');
  } catch (cause) {
    throw new Error('Desktop companion is not reachable. Start it in PowerShell with: npm run desktop:collector', { cause });
  }
  if (!isDeviceRecord(payload.device) || !isCollectorRecord(payload.collector) || payload.collector.deviceId !== payload.device.id) {
    throw new Error('Desktop companion returned an invalid device identity.');
  }
  const device = payload.device;
  const collector = payload.collector;
  await repository.upsertDevice(device);
  await repository.upsertCollector(collector);
  await repository.reconcileLegacyDesktopIdentity(device, collector);
  const observations = payload.observations
    .filter(isDesktopObservation)
    .map((observation) => ({ ...observation, deviceId: device.id, collectorId: collector.id }));
  const before = await repository.getDiagnostics();
  await repository.appendObservations(observations);
  const after = await repository.getDiagnostics();
  const added = Math.max(0, after.observationCount - before.observationCount);
  const lastObservedAt = observations.at(-1)?.endedAt ?? observations.at(-1)?.startedAt;
  const status: CollectorStatus = {
    source: 'desktop',
    state: 'available_full',
    detail: `Synced ${added} new desktop session${added === 1 ? '' : 's'} from ${device.label}.`,
    lastObservedAt,
    updatedAt: new Date().toISOString(),
  };
  await repository.upsertCollectorStatus(status);
  return status;
}

export async function inspectHuaweiHealthConnector(): Promise<CollectorStatus> {
  try {
    const status = await fetchJson<HuaweiHealthStatus>('/integrations/huawei/status');
    return {
      source: 'health',
      state: status.connected ? 'available_limited' : 'permission_required',
      detail: `${status.detail}${status.routeScopeRequested ? ' Workout-route permission is included.' : ' Workout routes are not requested by default.'}`,
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return {
      source: 'health',
      state: 'temporarily_unavailable',
      detail: 'HUAWEI Health setup is available through the Windows companion when it is running.',
      updatedAt: new Date().toISOString(),
    };
  }
}

export async function connectOrSyncHuaweiHealth(repository: TimelineRepository): Promise<CollectorStatus> {
  const status = await fetchJson<HuaweiHealthStatus>('/integrations/huawei/status');
  if (!status.connected) {
    const payload = await fetchJson<{ authorizationUrl: string }>('/integrations/huawei/connect');
    await Linking.openURL(payload.authorizationUrl);
    return {
      source: 'health',
      state: 'permission_required',
      detail: 'Complete HUAWEI ID authorization in the browser, then return to ATIRA. Health import will begin automatically.',
      updatedAt: new Date().toISOString(),
    };
  }
  return syncHuaweiHealthObservations(repository);
}

export async function syncHuaweiHealthObservations(repository: TimelineRepository): Promise<CollectorStatus> {
  const payload = await fetchJson<{ observations: unknown[] }>('/integrations/huawei/workouts?days=7');
  const observations = payload.observations.filter(isHealthObservation);
  const before = await repository.getDiagnostics();
  await repository.appendObservations(observations);
  const after = await repository.getDiagnostics();
  const added = Math.max(0, after.observationCount - before.observationCount);
  const status: CollectorStatus = {
    source: 'health',
    state: 'available_full',
    detail: `Imported ${added} new HUAWEI Health workout${added === 1 ? '' : 's'} from the last seven days. Sleep, heart-rate, and step sample queries are the next connector slice.`,
    lastObservedAt: observations.at(-1)?.endedAt ?? observations.at(-1)?.startedAt,
    updatedAt: new Date().toISOString(),
  };
  await repository.upsertCollectorStatus(status);
  return status;
}

async function fetchJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${DESKTOP_COMPANION_URL}${path}`, { signal: controller.signal });
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(errorPayload?.error ?? `Desktop companion returned ${response.status}.`);
    }
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

function isHealthObservation(value: unknown): value is RawObservation {
  if (!value || typeof value !== 'object') return false;
  const observation = value as Partial<RawObservation>;
  return observation.source === 'health' && observation.kind === 'health_sample' &&
    typeof observation.id === 'string' && typeof observation.startedAt === 'string' &&
    typeof observation.capturedAt === 'string' && typeof observation.quality === 'number' &&
    observation.payload != null && typeof observation.payload === 'object';
}

function isDesktopObservation(value: unknown): value is RawObservation {
  if (!value || typeof value !== 'object') return false;
  const observation = value as Partial<RawObservation>;
  return observation.source === 'desktop' &&
    ['desktop_foreground', 'browser_foreground'].includes(String(observation.kind)) &&
    typeof observation.id === 'string' &&
    typeof observation.startedAt === 'string' &&
    typeof observation.endedAt === 'string' &&
    typeof observation.capturedAt === 'string' &&
    typeof observation.quality === 'number' &&
    observation.payload != null && typeof observation.payload === 'object';
}

function isDeviceRecord(value: unknown): value is DeviceRecord {
  if (!value || typeof value !== 'object') return false;
  const device = value as Partial<DeviceRecord>;
  return typeof device.id === 'string' && typeof device.label === 'string' &&
    ['phone', 'tablet', 'computer', 'watch', 'band', 'other'].includes(String(device.deviceClass)) &&
    ['windows', 'macos', 'ios', 'android', 'harmonyos', 'web', 'unknown'].includes(String(device.platform)) &&
    typeof device.createdAt === 'string' && typeof device.updatedAt === 'string';
}

function isCollectorRecord(value: unknown): value is CollectorRecord {
  if (!value || typeof value !== 'object') return false;
  const collector = value as Partial<CollectorRecord>;
  return typeof collector.id === 'string' && typeof collector.deviceId === 'string' &&
    collector.source === 'desktop' && collector.provider === 'atira_windows_companion' &&
    typeof collector.label === 'string' && typeof collector.createdAt === 'string' && typeof collector.updatedAt === 'string';
}
