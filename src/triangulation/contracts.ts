import { EvidenceSource, InsightMaturity } from '../domain/types';

export type EvidenceRole = 'observed' | 'declared' | 'derived' | 'confirmed';

export type EvidenceModality =
  | 'digital_activity'
  | 'device_state'
  | 'location'
  | 'motion'
  | 'physiology'
  | 'workout_record'
  | 'declared_intent'
  | 'user_confirmation'
  | 'other';

export type EvidenceFactType =
  | 'digital_active'
  | 'device_away'
  | 'device_locked'
  | 'location_sample'
  | 'place_presence'
  | 'movement'
  | 'sleep'
  | 'heart_rate'
  | 'steps'
  | 'workout'
  | 'declared_intent'
  | 'user_confirmation'
  | 'other';

export type EvidenceAttributeValue = string | number | boolean | null;

export interface NormalizedEvidence {
  id: string;
  role: EvidenceRole;
  source: EvidenceSource | 'user';
  modality: EvidenceModality;
  factType: EvidenceFactType;
  deviceId?: string;
  collectorId?: string;
  startedAt: string;
  endedAt: string;
  quality: number;
  attributes: Record<string, EvidenceAttributeValue>;
  observationIds: string[];
  lineageSources: EvidenceSource[];
  independenceKeys: string[];
}

export type CoverageWindowState = 'observed' | 'partial' | 'missing' | 'paused' | 'unavailable';

export interface SourceCoverageWindow {
  id: string;
  source: EvidenceSource;
  deviceId?: string;
  collectorId?: string;
  startedAt: string;
  endedAt: string;
  state: CoverageWindowState;
  quality: number;
  reason?: string;
}

export type CoverageAssessmentState = 'sufficient' | 'partial' | 'missing' | 'paused' | 'unavailable' | 'unknown';

export interface SourceCoverageAssessment {
  source: EvidenceSource;
  startedAt: string;
  endedAt: string;
  state: CoverageAssessmentState;
  coveragePercent: number;
  observedSeconds: number;
  expectedSeconds: number;
  reasons: string[];
}

export interface EvidenceSelector {
  roles?: EvidenceRole[];
  sources?: Array<EvidenceSource | 'user'>;
  modalities?: EvidenceModality[];
  factTypes?: EvidenceFactType[];
  attributeEquals?: Record<string, EvidenceAttributeValue>;
}

export interface TemporalInterpretationRule {
  id: string;
  kind: string;
  title: string;
  summary: string;
  anchor: EvidenceSelector;
  support: EvidenceSelector;
  contradictions?: EvidenceSelector;
  minimumOverlapSeconds: number;
  maximumGapSeconds: number;
  minimumIndependentObservedSources: number;
  minimumCoveragePercent: number;
  informationGain: number;
  alternatives: string[];
  confirmationQuestion?: string;
}

export interface CandidateEvidenceReference {
  evidenceId: string;
  relation: 'anchor' | 'support' | 'contradiction';
  source: EvidenceSource | 'user';
  role: EvidenceRole;
  observationIds: string[];
}

export type InterpretationStatus = 'candidate' | 'confirmed' | 'rejected';

export interface TriangulationCandidate {
  id: string;
  fingerprint: string;
  ruleId: string;
  kind: string;
  title: string;
  summary: string;
  startedAt: string;
  endedAt: string;
  confidence: number;
  status: InterpretationStatus;
  informationGain: number;
  independentObservedSources: EvidenceSource[];
  evidence: CandidateEvidenceReference[];
  coverage: SourceCoverageAssessment[];
  reasoning: string[];
  alternatives: string[];
  confirmationQuestion?: string;
}

export interface BlockedInterpretation {
  ruleId: string;
  evidenceIds: string[];
  reasons: string[];
}

export type TriangulationReadiness =
  | 'single_source'
  | 'insufficient_coverage'
  | 'no_supported_interpretation'
  | 'ready';

export interface TriangulationResult {
  readiness: TriangulationReadiness;
  observedSources: EvidenceSource[];
  candidates: TriangulationCandidate[];
  blocked: BlockedInterpretation[];
}

export interface InterpretationFeedback {
  id: string;
  candidateId?: string;
  fingerprint: string;
  answer: 'yes' | 'no';
  createdAt: string;
}

export type ConfirmationHistoryState = 'presented' | 'answered' | 'dismissed';

export interface ConfirmationHistoryRecord {
  id: string;
  candidateId: string;
  fingerprint: string;
  state: ConfirmationHistoryState;
  answer?: 'yes' | 'no';
  createdAt: string;
}

export interface ConfirmationPrompt {
  id: string;
  candidateId: string;
  fingerprint: string;
  question: string;
  priority: number;
  createdAt: string;
  expiresAt: string;
  evidenceObservationIds: string[];
}

export interface ConfirmationPolicy {
  dailyLimit: number;
  minimumConfidence: number;
  maximumConfidence: number;
  minimumInformationGain: number;
  quietHoursStart: number;
  quietHoursEnd: number;
  dismissedCooldownDays: number;
  promptExpiryHours: number;
}

export interface ConfirmationQueueResult {
  prompts: ConfirmationPrompt[];
  deferredReasons: string[];
}

export interface DailyMetricPoint {
  id: string;
  dayId: string;
  metricId: string;
  label: string;
  value: number;
  unit: string;
  source: EvidenceSource;
  role: EvidenceRole;
  coveragePercent: number;
  observationIds: string[];
}

export interface LongitudinalAssociation {
  id: string;
  maturity: Exclude<InsightMaturity, 'audit'>;
  leftMetricId: string;
  rightMetricId: string;
  pairedDayCount: number;
  historyDayCount: number;
  coefficient: number;
  confidence: number;
  summary: string;
  sources: EvidenceSource[];
  observationIds: string[];
}

export interface LongitudinalAssociationResult {
  association?: LongitudinalAssociation;
  pairedDayCount: number;
  historyDayCount: number;
  blockedReasons: string[];
}
