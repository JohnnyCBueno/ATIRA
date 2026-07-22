export type AppProfile = 'ios-eu' | 'ios-global' | 'android';

export type EventState =
  | 'confirmed'
  | 'inferred_high'
  | 'inferred_medium'
  | 'unknown'
  | 'corrected'
  | 'manual';

export type EventCategory =
  | 'sleep'
  | 'travel'
  | 'creation'
  | 'communication'
  | 'food'
  | 'exercise'
  | 'learning'
  | 'home'
  | 'digital'
  | 'break';

export type EvidenceSource =
  | 'location'
  | 'motion'
  | 'calendar'
  | 'desktop'
  | 'phone'
  | 'health';

export interface EvidenceItem {
  id: string;
  source: EvidenceSource;
  label: string;
  detail: string;
  strength: 'strong' | 'supporting' | 'weak';
}

export interface TimelineEvent {
  id: string;
  title: string;
  category: EventCategory;
  start: string;
  end: string;
  duration: string;
  place?: string;
  state: EventState;
  confidence?: number;
  summary: string;
  evidence: EvidenceItem[];
  alternatives: string[];
}

export type DigitalActivityCategory =
  | 'creation'
  | 'communication'
  | 'learning'
  | 'entertainment'
  | 'browser'
  | 'ai_assistance'
  | 'other';

export type ActivityPurpose = 'work' | 'learning' | 'personal' | 'unknown';

export type ClassificationProvenance = 'system_default' | 'user_rule' | 'unclassified';

export type DigitalAuditRange = '7d' | '30d' | '90d';

export type InsightMaturity = 'audit' | 'emerging' | 'established';

export type EngagementState = 'interactive' | 'passive' | 'away' | 'locked';

export interface EngagementSummary {
  interactiveSeconds: number;
  passiveSeconds: number;
  awaySeconds: number;
  lockedSeconds: number;
  unclassifiedSeconds: number;
  classifiedActiveCoveragePercent: number;
}

export interface DigitalActivityRule {
  id: string;
  deviceId: string;
  applicationId: string;
  alias?: string;
  category?: DigitalActivityCategory;
  purpose?: ActivityPurpose;
  excluded: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DigitalAuditDay {
  dayId: string;
  observed: boolean;
  totalSeconds: number;
  categories: { category: DigitalActivityCategory; durationSeconds: number }[];
  purposes: { purpose: ActivityPurpose; durationSeconds: number }[];
}

export interface DigitalAuditHour {
  hour: number;
  totalSeconds: number;
  categories: { category: DigitalActivityCategory; durationSeconds: number }[];
  purposes: { purpose: ActivityPurpose; durationSeconds: number }[];
}

export interface DigitalAuditApplication {
  deviceId: string;
  deviceLabel: string;
  applicationId: string;
  applicationName: string;
  browserId?: string;
  category: DigitalActivityCategory;
  purpose: ActivityPurpose;
  classificationConfidence: number;
  classificationProvenance: ClassificationProvenance;
  durationSeconds: number;
  interactiveSeconds: number;
  passiveSeconds: number;
  unclassifiedEngagementSeconds: number;
  sessionCount: number;
  observationIds: string[];
}

export interface DigitalAuditEvidence {
  id: string;
  label: string;
  detail: string;
  source: EvidenceSource;
  observationIds: string[];
}

export interface DigitalSignal {
  id: string;
  maturity: 'emerging';
  title: string;
  summary: string;
  confidence: number;
  evidence: DigitalAuditEvidence[];
}

export interface DigitalInsight {
  id: string;
  maturity: 'established';
  title: string;
  summary: string;
  confidence: number;
  evidence: DigitalAuditEvidence[];
}

export interface DigitalAudit {
  range: DigitalAuditRange;
  startedAt: string;
  endedAt: string;
  expectedDayCount: number;
  observedDayCount: number;
  missingDayCount: number;
  coveragePercent: number;
  totalSeconds: number;
  sources: EvidenceSource[];
  priorTotalSeconds: number | null;
  maturity: InsightMaturity;
  applications: DigitalAuditApplication[];
  days: DigitalAuditDay[];
  hours: DigitalAuditHour[];
  categories: { category: DigitalActivityCategory; durationSeconds: number }[];
  purposes: { purpose: ActivityPurpose; durationSeconds: number }[];
  devices: { deviceId: string; deviceLabel: string; durationSeconds: number }[];
  engagement: EngagementSummary;
  signals: DigitalSignal[];
  insights: DigitalInsight[];
}

export type DeviceClass = 'phone' | 'tablet' | 'computer' | 'watch' | 'band' | 'other';

export type DevicePlatform = 'windows' | 'macos' | 'ios' | 'android' | 'harmonyos' | 'web' | 'unknown';

export interface DesktopUsageSession {
  id: string;
  deviceId: string;
  applicationId: string;
  applicationName: string;
  browserId?: string;
  category: DigitalActivityCategory;
  purpose: ActivityPurpose;
  classificationConfidence: number;
  classificationProvenance: ClassificationProvenance;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
}

export interface DesktopUsageApplication {
  deviceId: string;
  applicationId: string;
  applicationName: string;
  browserId?: string;
  category: DigitalActivityCategory;
  purpose: ActivityPurpose;
  classificationConfidence: number;
  classificationProvenance: ClassificationProvenance;
  durationSeconds: number;
  sessions: DesktopUsageSession[];
}

export interface DesktopUsageHour {
  hour: number;
  totalSeconds: number;
  categories: { category: DigitalActivityCategory; durationSeconds: number }[];
}

export interface DesktopUsageSummary {
  deviceId: string;
  deviceLabel: string;
  deviceClass: DeviceClass;
  platform: DevicePlatform;
  totalSeconds: number;
  applications: DesktopUsageApplication[];
  hours: DesktopUsageHour[];
}

export interface DayPlace {
  id: string;
  title: string;
  detail: string;
  x: number;
  y: number;
  kind: 'home' | 'work' | 'food' | 'exercise' | 'other';
}

export interface DayRecord {
  id: string;
  weekday: string;
  dayNumber: string;
  month: string;
  relativeLabel: string;
  coverage: number;
  understood: string;
  work: string;
  movement: string;
  learning: string;
  distance: string;
  routePath: string;
  inferredRoutePath?: string;
  places: DayPlace[];
  events: TimelineEvent[];
  desktopUsages?: DesktopUsageSummary[];
}

export interface CapabilityItem {
  id: string;
  label: string;
  detail: string;
  status: 'full' | 'limited' | 'connected' | 'unavailable';
}

export interface AppProfileDefinition {
  id: AppProfile;
  shortLabel: string;
  title: string;
  description: string;
  capabilities: CapabilityItem[];
}
