import { EvidenceSource } from '../domain/types';
import { assessSourceCoverage, hasSufficientCoverage } from './coverageEngine';
import {
  BlockedInterpretation,
  EvidenceSelector,
  InterpretationFeedback,
  NormalizedEvidence,
  SourceCoverageWindow,
  TemporalInterpretationRule,
  TriangulationCandidate,
  TriangulationResult,
} from './contracts';

export const defaultTemporalInterpretationRules: TemporalInterpretationRule[] = [
  {
    id: 'phone-attention-shift',
    kind: 'phone_attention_shift',
    title: 'Phone activity overlapped a desktop-away interval',
    summary: 'Observed phone activity coincided with a period when the computer recorded no recent interaction. This does not reveal why the phone was used.',
    anchor: { roles: ['observed', 'derived'], sources: ['desktop'], factTypes: ['device_away'] },
    support: { roles: ['observed', 'derived'], sources: ['phone'], factTypes: ['digital_active'] },
    contradictions: { roles: ['observed', 'derived'], sources: ['desktop'], factTypes: ['digital_active'] },
    minimumOverlapSeconds: 60,
    maximumGapSeconds: 0,
    minimumIndependentObservedSources: 2,
    minimumCoveragePercent: 60,
    informationGain: 0.55,
    alternatives: ['The phone may have remained active without sustained attention.', 'Computer interaction may have been missed by the collector.'],
    confirmationQuestion: 'Did you switch from the computer to your phone during this interval?',
  },
  {
    id: 'movement-break',
    kind: 'movement_break',
    title: 'Movement overlapped a desktop-away interval',
    summary: 'Observed movement coincided with a period away from the computer. ATIRA can describe the overlap without claiming the purpose of the movement.',
    anchor: { roles: ['observed', 'derived'], sources: ['desktop'], factTypes: ['device_away'] },
    support: { roles: ['observed', 'derived'], sources: ['motion'], factTypes: ['movement'] },
    contradictions: { roles: ['observed', 'derived'], sources: ['desktop'], factTypes: ['digital_active'] },
    minimumOverlapSeconds: 120,
    maximumGapSeconds: 60,
    minimumIndependentObservedSources: 2,
    minimumCoveragePercent: 60,
    informationGain: 0.7,
    alternatives: ['The movement may have been incidental rather than a deliberate break.', 'The motion source may belong to a device that was moved independently.'],
    confirmationQuestion: 'Did you take a movement break from the computer?',
  },
  {
    id: 'workout-corroborated-by-motion',
    kind: 'corroborated_workout',
    title: 'A workout record coincided with observed movement',
    summary: 'A recorded workout and a separate movement stream overlapped. This supports that an exercise period occurred without assessing its quality or health effect.',
    anchor: { roles: ['observed', 'derived'], sources: ['health'], factTypes: ['workout'] },
    support: { roles: ['observed', 'derived'], sources: ['motion'], factTypes: ['movement'] },
    minimumOverlapSeconds: 120,
    maximumGapSeconds: 120,
    minimumIndependentObservedSources: 2,
    minimumCoveragePercent: 60,
    informationGain: 0.35,
    alternatives: ['The workout record may have been started manually but not completed as intended.'],
  },
  {
    id: 'work-place-desktop-overlap',
    kind: 'work_place_desktop_activity',
    title: 'Desktop activity occurred at a known work place',
    summary: 'Observed desktop activity overlapped presence at a place the user has identified as work. This does not make every application used there productive.',
    anchor: { roles: ['derived', 'confirmed'], sources: ['location'], factTypes: ['place_presence'], attributeEquals: { placeKind: 'work' } },
    support: { roles: ['observed', 'derived'], sources: ['desktop'], factTypes: ['digital_active'] },
    minimumOverlapSeconds: 300,
    maximumGapSeconds: 0,
    minimumIndependentObservedSources: 2,
    minimumCoveragePercent: 60,
    informationGain: 0.45,
    alternatives: ['The work place may have been visited for a non-work reason.', 'The computer activity may have been personal.'],
  },
];

export function buildTemporalTriangulation(
  evidence: NormalizedEvidence[],
  coverageWindows: SourceCoverageWindow[],
  rules: TemporalInterpretationRule[] = defaultTemporalInterpretationRules,
): TriangulationResult {
  const observedSources = observedLineageSources(evidence);
  const candidates: TriangulationCandidate[] = [];
  const blocked: BlockedInterpretation[] = [];

  for (const rule of rules) {
    const anchors = evidence.filter((item) => matchesSelector(item, rule.anchor));
    const supports = evidence.filter((item) => matchesSelector(item, rule.support));
    for (const anchor of anchors) {
      for (const support of supports) {
        if (anchor.id === support.id) continue;
        const relation = temporalRelationship(anchor, support);
        if (relation.overlapSeconds < rule.minimumOverlapSeconds && relation.gapSeconds > rule.maximumGapSeconds) continue;
        const periodStart = relation.overlapSeconds > 0
          ? Math.max(Date.parse(anchor.startedAt), Date.parse(support.startedAt))
          : Math.min(Date.parse(anchor.startedAt), Date.parse(support.startedAt));
        const periodEnd = relation.overlapSeconds > 0
          ? Math.min(Date.parse(anchor.endedAt), Date.parse(support.endedAt))
          : Math.max(Date.parse(anchor.endedAt), Date.parse(support.endedAt));
        const startedAt = new Date(periodStart).toISOString();
        const endedAt = new Date(Math.max(periodStart + 1_000, periodEnd)).toISOString();
        const contradictions = rule.contradictions
          ? evidence.filter((item) => matchesSelector(item, rule.contradictions!) && overlapsPeriod(item, startedAt, endedAt))
          : [];
        const sources = observedLineageSources([anchor, support]);
        const coverage = assessSourceCoverage(coverageWindows, sources, startedAt, endedAt);
        const reasons: string[] = [];
        if (sources.length < rule.minimumIndependentObservedSources) {
          reasons.push(`Requires ${rule.minimumIndependentObservedSources} independent observed source types; found ${sources.length}.`);
        }
        for (const assessment of coverage) {
          if (!hasSufficientCoverage(assessment, rule.minimumCoveragePercent)) {
            reasons.push(`${assessment.source} coverage was ${assessment.coveragePercent}% or unavailable for the candidate period.`);
          }
        }
        if (reasons.length > 0) {
          blocked.push({ ruleId: rule.id, evidenceIds: [anchor.id, support.id], reasons });
          continue;
        }

        const minimumCoverage = coverage.length > 0 ? Math.min(...coverage.map((item) => item.coveragePercent)) / 100 : 0;
        const temporalStrength = relation.overlapSeconds > 0
          ? Math.min(1, relation.overlapSeconds / Math.max(1, rule.minimumOverlapSeconds))
          : Math.max(0, 1 - relation.gapSeconds / Math.max(1, rule.maximumGapSeconds));
        const sourceStrength = Math.min(1, sources.length / Math.max(1, rule.minimumIndependentObservedSources));
        const baseConfidence = ((anchor.quality + support.quality) / 2) * 0.55
          + temporalStrength * 0.2
          + minimumCoverage * 0.15
          + sourceStrength * 0.1;
        const confidence = round(clamp(baseConfidence - contradictions.length * 0.18), 2);
        const candidateId = `candidate:${stableHash(`${rule.id}|${anchor.id}|${support.id}`)}`;
        const fingerprint = `interpretation:${stableHash([
          rule.id,
          roundToFiveMinutes(startedAt),
          roundToFiveMinutes(endedAt),
          ...[anchor.deviceId, support.deviceId].filter(Boolean).sort(),
        ].join('|'))}`;
        const candidate: TriangulationCandidate = {
          id: candidateId,
          fingerprint,
          ruleId: rule.id,
          kind: rule.kind,
          title: rule.title,
          summary: rule.summary,
          startedAt,
          endedAt,
          confidence,
          status: 'candidate',
          informationGain: clamp(rule.informationGain),
          independentObservedSources: sources,
          evidence: [
            reference(anchor, 'anchor'),
            reference(support, 'support'),
            ...contradictions.map((item) => reference(item, 'contradiction')),
          ],
          coverage,
          reasoning: [
            relation.overlapSeconds > 0
              ? `${Math.round(relation.overlapSeconds)} seconds of temporal overlap were observed.`
              : `The evidence streams were ${Math.round(relation.gapSeconds)} seconds apart.`,
            `${sources.length} independent observed source type${sources.length === 1 ? '' : 's'} contributed.`,
            contradictions.length > 0
              ? `${contradictions.length} contradictory observation${contradictions.length === 1 ? '' : 's'} lowered confidence.`
              : 'No configured contradictory evidence was found in the candidate period.',
          ],
          alternatives: rule.alternatives,
          confirmationQuestion: rule.confirmationQuestion,
        };
        candidates.push(candidate);
      }
    }
  }

  const uniqueCandidates = deduplicateCandidates(candidates);
  return {
    readiness: readinessFor(observedSources, uniqueCandidates, blocked),
    observedSources,
    candidates: uniqueCandidates,
    blocked,
  };
}

export function applyInterpretationFeedback(
  candidates: TriangulationCandidate[],
  feedback: InterpretationFeedback[],
): TriangulationCandidate[] {
  return candidates.map((candidate) => {
    const answer = [...feedback]
      .filter((item) => item.fingerprint === candidate.fingerprint || item.candidateId === candidate.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
    if (!answer) return candidate;
    return answer.answer === 'yes'
      ? { ...candidate, status: 'confirmed', confidence: 1, reasoning: [...candidate.reasoning, 'The user confirmed this interpretation.'] }
      : { ...candidate, status: 'rejected', confidence: 0, reasoning: [...candidate.reasoning, 'The user rejected this interpretation; it must not support later claims.'] };
  });
}

function matchesSelector(item: NormalizedEvidence, selector: EvidenceSelector) {
  if (selector.roles && !selector.roles.includes(item.role)) return false;
  if (selector.sources && !selector.sources.includes(item.source)) return false;
  if (selector.modalities && !selector.modalities.includes(item.modality)) return false;
  if (selector.factTypes && !selector.factTypes.includes(item.factType)) return false;
  if (selector.attributeEquals && Object.entries(selector.attributeEquals).some(([key, value]) => item.attributes[key] !== value)) return false;
  return true;
}

function observedLineageSources(evidence: NormalizedEvidence[]) {
  const sources = new Set<EvidenceSource>();
  for (const item of evidence) {
    if (!['observed', 'derived', 'confirmed'].includes(item.role)) continue;
    for (const source of item.lineageSources) sources.add(source);
  }
  return [...sources].sort();
}

function temporalRelationship(left: NormalizedEvidence, right: NormalizedEvidence) {
  const leftStart = Date.parse(left.startedAt);
  const leftEnd = Date.parse(left.endedAt);
  const rightStart = Date.parse(right.startedAt);
  const rightEnd = Date.parse(right.endedAt);
  const overlapMilliseconds = Math.max(0, Math.min(leftEnd, rightEnd) - Math.max(leftStart, rightStart));
  const gapMilliseconds = overlapMilliseconds > 0 ? 0 : Math.max(0, Math.max(leftStart, rightStart) - Math.min(leftEnd, rightEnd));
  return { overlapSeconds: overlapMilliseconds / 1_000, gapSeconds: gapMilliseconds / 1_000 };
}

function overlapsPeriod(item: NormalizedEvidence, startedAt: string, endedAt: string) {
  return Date.parse(item.startedAt) < Date.parse(endedAt) && Date.parse(item.endedAt) > Date.parse(startedAt);
}

function reference(item: NormalizedEvidence, relation: 'anchor' | 'support' | 'contradiction') {
  return {
    evidenceId: item.id,
    relation,
    source: item.source,
    role: item.role,
    observationIds: item.observationIds,
  };
}

function readinessFor(
  observedSources: EvidenceSource[],
  candidates: TriangulationCandidate[],
  blocked: BlockedInterpretation[],
): TriangulationResult['readiness'] {
  if (observedSources.length < 2) return 'single_source';
  if (candidates.length > 0) return 'ready';
  if (blocked.some((item) => item.reasons.some((reason) => reason.includes('coverage')))) return 'insufficient_coverage';
  return 'no_supported_interpretation';
}

function deduplicateCandidates(candidates: TriangulationCandidate[]) {
  const byFingerprint = new Map<string, TriangulationCandidate>();
  for (const candidate of candidates) {
    const existing = byFingerprint.get(candidate.fingerprint);
    if (!existing || candidate.confidence > existing.confidence) byFingerprint.set(candidate.fingerprint, candidate);
  }
  return [...byFingerprint.values()].sort((left, right) => left.startedAt.localeCompare(right.startedAt));
}

function roundToFiveMinutes(value: string) {
  const milliseconds = Date.parse(value);
  return new Date(Math.floor(milliseconds / 300_000) * 300_000).toISOString();
}

function stableHash(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

function clamp(value: number) { return Math.max(0, Math.min(1, value)); }
function round(value: number, places: number) { const factor = 10 ** places; return Math.round(value * factor) / factor; }
