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
