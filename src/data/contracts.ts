import { DayRecord, DeviceClass, DevicePlatform, DigitalActivityRule, EvidenceSource, TimelineEvent } from '../domain/types';

export type ObservationKind =
  | 'location_sample'
  | 'motion_activity'
  | 'app_foreground'
  | 'health_sample'
  | 'calendar_interval'
  | 'desktop_foreground'
  | 'browser_foreground';

export type CapabilityState =
  | 'available_full'
  | 'available_limited'
  | 'report_only'
  | 'permission_required'
  | 'permission_denied'
  | 'unsupported_region'
  | 'unsupported_device'
  | 'temporarily_unavailable'
  | 'missing_coverage';

export interface RawObservation {
  id: string;
  deviceId?: string;
  collectorId?: string;
  source: EvidenceSource;
  kind: ObservationKind;
  startedAt: string;
  endedAt?: string;
  capturedAt: string;
  quality: number;
  payload: Record<string, string | number | boolean | null>;
}

export type LocationSegmentKind = 'stay' | 'journey' | 'coverage_gap';
export type TravelMode = 'walking' | 'cycling' | 'road' | 'fast_transit' | 'unknown';
export type ObservationOrigin = 'real' | 'synthetic' | 'mixed';

export interface SegmentPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface LocationSegmentRecord {
  id: string;
  dayId: string;
  kind: LocationSegmentKind;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  distanceMetres: number;
  confidence: number;
  sampleCount: number;
  mode?: TravelMode;
  origin?: ObservationOrigin;
  center?: { latitude: number; longitude: number };
  points: SegmentPoint[];
}

export interface ObservationQuery {
  source?: EvidenceSource;
  deviceId?: string;
  collectorId?: string;
  from?: string;
  to?: string;
}

export interface DeviceRecord {
  id: string;
  deviceClass: DeviceClass;
  platform: DevicePlatform;
  label: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollectorRecord {
  id: string;
  deviceId: string;
  source: EvidenceSource;
  provider: string;
  label: string;
  createdAt: string;
  updatedAt: string;
}

export type CollectorOperationalState = 'collecting' | 'paused' | 'offline' | 'unknown';
export type CollectorBackfillState = 'not_supported' | 'supported' | 'in_progress' | 'complete';

export interface CollectorStatus {
  source: EvidenceSource;
  state: CapabilityState;
  detail: string;
  lastObservedAt?: string;
  /** The most recent successful import into ATIRA's local repository. */
  lastSyncedAt?: string;
  /** What the collector itself reports, kept separate from data coverage. */
  operationalState?: CollectorOperationalState;
  /** Expected interval between collector health checks or heartbeats. */
  expectedHeartbeatSeconds?: number;
  /** Whether this source can later fill a gap from provider-held history. */
  backfillState?: CollectorBackfillState;
  coverage?: number;
  updatedAt: string;
}

export interface EventCorrection {
  id: string;
  dayId: string;
  eventId: string;
  action: 'confirm' | 'relabel';
  previousTitle: string;
  correctedTitle: string;
  createdAt: string;
}

export interface RepositoryDiagnostics {
  adapter: 'sqlite' | 'web-storage' | 'desktop-encrypted';
  schemaVersion: number;
  dayCount: number;
  observationCount: number;
  correctionCount: number;
  segmentCount: number;
  deviceCount: number;
  collectorCount: number;
  activityRuleCount: number;
}

export interface TimelineRepository {
  initialize(seedDays: DayRecord[]): Promise<void>;
  listDays(): Promise<DayRecord[]>;
  upsertDay(day: DayRecord): Promise<void>;
  saveEvent(dayId: string, event: TimelineEvent, correction: EventCorrection): Promise<void>;
  appendObservations(observations: RawObservation[]): Promise<void>;
  listObservations(query?: ObservationQuery): Promise<RawObservation[]>;
  deleteObservations(query?: ObservationQuery): Promise<number>;
  listDevices(): Promise<DeviceRecord[]>;
  upsertDevice(device: DeviceRecord): Promise<void>;
  reconcileLegacyDesktopIdentity(device: DeviceRecord, collector: CollectorRecord): Promise<number>;
  listDigitalActivityRules(): Promise<DigitalActivityRule[]>;
  upsertDigitalActivityRule(rule: DigitalActivityRule): Promise<void>;
  deleteDigitalActivityRule(id: string): Promise<void>;
  listCollectors(): Promise<CollectorRecord[]>;
  upsertCollector(collector: CollectorRecord): Promise<void>;
  replaceLocationSegments(dayId: string, segments: LocationSegmentRecord[]): Promise<void>;
  listLocationSegments(dayId?: string): Promise<LocationSegmentRecord[]>;
  listCollectorStatuses(): Promise<CollectorStatus[]>;
  upsertCollectorStatus(status: CollectorStatus): Promise<void>;
  getDiagnostics(): Promise<RepositoryDiagnostics>;
}

export const DATABASE_SCHEMA_VERSION = 7;

export const initialCollectorStatuses: CollectorStatus[] = [
  {
    source: 'location',
    state: 'permission_required',
    detail: 'Ready to request foreground permission on a development build.',
    operationalState: 'unknown',
    backfillState: 'not_supported',
    updatedAt: new Date(0).toISOString(),
  },
  {
    source: 'motion',
    state: 'permission_required',
    detail: 'Motion capability has not been evaluated on this device.',
    operationalState: 'unknown',
    backfillState: 'not_supported',
    updatedAt: new Date(0).toISOString(),
  },
  {
    source: 'phone',
    state: 'available_limited',
    detail: 'Phone usage collector is not connected in this runtime.',
    operationalState: 'unknown',
    backfillState: 'not_supported',
    updatedAt: new Date(0).toISOString(),
  },
  {
    source: 'health',
    state: 'permission_required',
    detail: 'Health provider has not been connected.',
    operationalState: 'unknown',
    backfillState: 'supported',
    updatedAt: new Date(0).toISOString(),
  },
  {
    source: 'calendar',
    state: 'permission_required',
    detail: 'Calendar permission has not been requested.',
    operationalState: 'unknown',
    backfillState: 'supported',
    updatedAt: new Date(0).toISOString(),
  },
  {
    source: 'desktop',
    state: 'temporarily_unavailable',
    detail: 'Desktop companion has not been paired.',
    operationalState: 'offline',
    backfillState: 'complete',
    updatedAt: new Date(0).toISOString(),
  },
];
