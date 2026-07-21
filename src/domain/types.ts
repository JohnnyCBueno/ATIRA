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

export type DeviceClass = 'phone' | 'tablet' | 'computer' | 'watch' | 'band' | 'other';

export type DevicePlatform = 'windows' | 'macos' | 'ios' | 'android' | 'harmonyos' | 'web' | 'unknown';

export interface DesktopUsageSession {
  id: string;
  deviceId: string;
  applicationId: string;
  applicationName: string;
  category: DigitalActivityCategory;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
}

export interface DesktopUsageApplication {
  deviceId: string;
  applicationId: string;
  applicationName: string;
  category: DigitalActivityCategory;
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
