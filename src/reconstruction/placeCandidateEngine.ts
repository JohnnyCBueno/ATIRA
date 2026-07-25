import { EvidenceSource } from '../domain/types';
import {
  ApplePlaceCandidate,
  LocationSegmentRecord,
  SemanticPlaceCategory,
} from '../data/contracts';
import { NormalizedEvidence } from '../triangulation/contracts';
import { haversineMetres } from './locationEngine';

export interface RawApplePlaceCandidate {
  name: string;
  latitude: number;
  longitude: number;
  category?: string;
  street?: string;
  locality?: string;
}

export interface PlaceCandidateAssessment {
  candidate: ApplePlaceCandidate;
  confidence: number;
  independentSources: Array<EvidenceSource | 'user'>;
  evidenceIds: string[];
  reasoning: string[];
}

export type PlaceResolutionStatus = 'unknown' | 'ambiguous' | 'supported' | 'confirmed';

export interface PlaceCandidateResolution {
  staySegmentId: string;
  status: PlaceResolutionStatus;
  candidates: PlaceCandidateAssessment[];
  confidence: number;
  margin: number;
  alternatives: string[];
  confirmationQuestion?: string;
  reasoning: string[];
}

export interface AssessPlaceCandidatesInput {
  stay: LocationSegmentRecord;
  candidates: ApplePlaceCandidate[];
  evidence?: NormalizedEvidence[];
}

interface EvidenceContribution {
  evidence: NormalizedEvidence;
  amount: number;
  reason: string;
  strong: boolean;
}

const LOCATION_ONLY_CONFIDENCE_CAP = 0.68;
const SUPPORTED_CONFIDENCE = 0.78;
const SUPPORTED_MARGIN = 0.1;

export function normalizeApplePlaceCandidates(
  stay: LocationSegmentRecord,
  rawCandidates: RawApplePlaceCandidate[],
  limit = 8,
): ApplePlaceCandidate[] {
  if (stay.kind !== 'stay' || !stay.center) return [];
  const seen = new Set<string>();
  return rawCandidates
    .filter((candidate) => candidate.name.trim().length > 0)
    .filter((candidate) => Number.isFinite(candidate.latitude) && Number.isFinite(candidate.longitude))
    .map((candidate) => {
      const name = candidate.name.trim();
      const latitude = candidate.latitude;
      const longitude = candidate.longitude;
      const identity = `${name.toLocaleLowerCase()}:${latitude.toFixed(5)}:${longitude.toFixed(5)}`;
      return {
        id: `apple:${safeId(identity)}`,
        provider: 'apple_mapkit' as const,
        name,
        category: semanticCategoryFor(candidate.category),
        providerCategory: candidate.category,
        latitude,
        longitude,
        distanceMetres: Math.round(haversineMetres(stay.center!.latitude, stay.center!.longitude, latitude, longitude)),
        street: candidate.street,
        locality: candidate.locality,
      };
    })
    .sort((left, right) => left.distanceMetres - right.distanceMetres || left.name.localeCompare(right.name))
    .filter((candidate) => {
      const identity = `${candidate.name.toLocaleLowerCase()}:${candidate.latitude.toFixed(5)}:${candidate.longitude.toFixed(5)}`;
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    })
    .slice(0, Math.max(0, limit));
}

export function assessPlaceCandidates({
  stay,
  candidates,
  evidence = [],
}: AssessPlaceCandidatesInput): PlaceCandidateResolution {
  if (stay.kind !== 'stay' || !stay.center || candidates.length === 0) {
    return {
      staySegmentId: stay.id,
      status: 'unknown',
      candidates: [],
      confidence: 0,
      margin: 0,
      alternatives: [],
      reasoning: ['No nearby Apple place candidates are available for this reconstructed stay.'],
    };
  }

  const overlappingEvidence = evidence.filter((item) => overlapsStay(item, stay));
  const assessments = candidates.map((candidate) => assessCandidate(candidate, stay, overlappingEvidence));
  assessments.sort((left, right) =>
    right.confidence - left.confidence
    || left.candidate.distanceMetres - right.candidate.distanceMetres
    || left.candidate.name.localeCompare(right.candidate.name));

  const top = assessments[0];
  const runnerUp = assessments[1];
  const margin = round(top.confidence - (runnerUp?.confidence ?? 0), 2);
  const explicitlyConfirmed = top.independentSources.includes('user')
    && top.reasoning.some((reason) => reason.startsWith('You confirmed'));
  const independentlySupported = top.independentSources.length >= 2
    && top.reasoning.some((reason) => reason.startsWith('A workout record'));
  const status: PlaceResolutionStatus = explicitlyConfirmed
    ? 'confirmed'
    : independentlySupported && top.confidence >= SUPPORTED_CONFIDENCE && margin >= SUPPORTED_MARGIN
      ? 'supported'
      : 'ambiguous';
  const alternatives = assessments.slice(1, 4).map((item) => item.candidate.name);

  return {
    staySegmentId: stay.id,
    status,
    candidates: assessments,
    confidence: top.confidence,
    margin,
    alternatives,
    confirmationQuestion: status === 'confirmed' ? undefined : confirmationQuestionFor(assessments),
    reasoning: status === 'confirmed'
      ? [`${top.candidate.name} is confirmed by you.`]
      : status === 'supported'
        ? [`${top.candidate.name} is supported by location plus independent activity evidence, but remains correctable.`]
        : ['Location establishes nearby possibilities, not which nearby business you entered.'],
  };
}

export function semanticCategoryFor(providerCategory?: string): SemanticPlaceCategory {
  const value = providerCategory?.toLocaleLowerCase() ?? '';
  if (containsAny(value, ['fitness', 'gym', 'yoga', 'climbing'])) return 'fitness';
  if (containsAny(value, ['restaurant', 'cafe', 'bakery', 'food', 'brewery', 'winery'])) return 'food';
  if (containsAny(value, ['store', 'shop', 'market', 'mall', 'pharmacy'])) return 'retail';
  if (containsAny(value, ['hospital', 'clinic', 'doctor', 'dentist', 'health'])) return 'healthcare';
  if (containsAny(value, ['school', 'university', 'library'])) return 'education';
  if (containsAny(value, ['airport', 'station', 'transit', 'parking'])) return 'transit';
  if (containsAny(value, ['park', 'museum', 'theater', 'cinema', 'stadium', 'beach'])) return 'recreation';
  if (containsAny(value, ['hotel', 'lodging'])) return 'accommodation';
  return 'other';
}

function assessCandidate(
  candidate: ApplePlaceCandidate,
  stay: LocationSegmentRecord,
  evidence: NormalizedEvidence[],
): PlaceCandidateAssessment {
  const proximity = Math.max(0, 1 - candidate.distanceMetres / 180);
  const locationConfidence = Math.min(
    LOCATION_ONLY_CONFIDENCE_CAP,
    0.34 + proximity * 0.24 + stay.confidence * 0.1,
  );
  const contributions = evidence
    .map((item) => contributionFor(item, candidate))
    .filter((item): item is EvidenceContribution => item != null);
  const explicitConfirmation = contributions.find((item) => item.evidence.source === 'user' && item.strong);
  const confidence = explicitConfirmation
    ? 1
    : Math.min(0.96, locationConfidence + contributions.reduce((total, item) => total + item.amount * item.evidence.quality, 0));
  const sources = new Set<EvidenceSource | 'user'>(['location']);
  contributions.forEach((item) => sources.add(item.evidence.source));
  return {
    candidate,
    confidence: round(confidence, 2),
    independentSources: [...sources],
    evidenceIds: contributions.map((item) => item.evidence.id),
    reasoning: [
      `Apple Maps lists ${candidate.name} ${candidate.distanceMetres} m from the reconstructed stay centre.`,
      ...contributions.map((item) => item.reason),
      ...(contributions.length === 0 ? ['No independent evidence identifies this candidate.'] : []),
    ],
  };
}

function contributionFor(
  evidence: NormalizedEvidence,
  candidate: ApplePlaceCandidate,
): EvidenceContribution | null {
  const confirmedCandidateId = evidence.attributes.placeCandidateId;
  const confirmedPlaceName = evidence.attributes.placeName;
  if (
    evidence.source === 'user'
    && evidence.factType === 'user_confirmation'
    && (confirmedCandidateId === candidate.id || confirmedPlaceName === candidate.name)
  ) {
    return {
      evidence,
      amount: 1,
      reason: `You confirmed ${candidate.name}.`,
      strong: true,
    };
  }

  if (
    candidate.category === 'fitness'
    && (evidence.factType === 'workout' || evidence.modality === 'workout_record')
  ) {
    return {
      evidence,
      amount: 0.28,
      reason: 'A workout record overlaps this stay and supports a fitness venue.',
      strong: true,
    };
  }

  if (
    candidate.category === 'fitness'
    && evidence.factType === 'heart_rate'
    && isElevatedPhysiology(evidence)
  ) {
    return {
      evidence,
      amount: 0.1,
      reason: 'Elevated heart-rate evidence overlaps this stay and weakly supports physical activity.',
      strong: false,
    };
  }

  if (
    ['fitness', 'recreation'].includes(candidate.category)
    && evidence.source === 'motion'
    && evidence.factType === 'movement'
  ) {
    return {
      evidence,
      amount: 0.07,
      reason: 'Movement evidence overlaps this stay and weakly supports an active place.',
      strong: false,
    };
  }

  return null;
}

function isElevatedPhysiology(evidence: NormalizedEvidence) {
  if (evidence.attributes.elevated === true) return true;
  const intensity = evidence.attributes.relativeIntensity;
  return typeof intensity === 'number' && intensity >= 0.5;
}

function overlapsStay(evidence: NormalizedEvidence, stay: LocationSegmentRecord) {
  const evidenceStart = Date.parse(evidence.startedAt);
  const evidenceEnd = Date.parse(evidence.endedAt);
  const stayStart = Date.parse(stay.startedAt);
  const stayEnd = Date.parse(stay.endedAt);
  return Number.isFinite(evidenceStart)
    && Number.isFinite(evidenceEnd)
    && evidenceStart <= stayEnd
    && evidenceEnd >= stayStart;
}

function confirmationQuestionFor(assessments: PlaceCandidateAssessment[]) {
  const names = assessments.slice(0, 2).map((item) => item.candidate.name);
  if (names.length === 1) return `Were you at ${names[0]}, or somewhere else?`;
  return `Were you at ${names[0]}, ${names[1]}, or somewhere else?`;
}

function containsAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

function safeId(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9:.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLocaleLowerCase();
}

function round(value: number, places: number) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
