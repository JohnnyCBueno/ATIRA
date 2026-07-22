import {
  ConfirmationHistoryRecord,
  ConfirmationPolicy,
  ConfirmationPrompt,
  ConfirmationQueueResult,
  TriangulationCandidate,
} from './contracts';

export const defaultConfirmationPolicy: ConfirmationPolicy = {
  dailyLimit: 2,
  minimumConfidence: 0.4,
  maximumConfidence: 0.82,
  minimumInformationGain: 0.5,
  quietHoursStart: 21,
  quietHoursEnd: 9,
  dismissedCooldownDays: 7,
  promptExpiryHours: 24,
};

export function buildConfirmationQueue(
  candidates: TriangulationCandidate[],
  history: ConfirmationHistoryRecord[],
  now = new Date(),
  policy: ConfirmationPolicy = defaultConfirmationPolicy,
): ConfirmationQueueResult {
  const deferredReasons: string[] = [];
  if (isQuietHour(now.getHours(), policy.quietHoursStart, policy.quietHoursEnd)) {
    return { prompts: [], deferredReasons: ['Confirmation prompts are deferred during quiet hours.'] };
  }
  const todayId = localDayId(now);
  const presentedToday = history.filter((item) => item.state === 'presented' && localDayId(new Date(item.createdAt)) === todayId).length;
  const remaining = Math.max(0, policy.dailyLimit - presentedToday);
  if (remaining === 0) return { prompts: [], deferredReasons: ['The daily confirmation limit has been reached.'] };

  const eligible = candidates.flatMap((candidate) => {
    if (candidate.status !== 'candidate' || !candidate.confirmationQuestion) return [];
    if (candidate.confidence < policy.minimumConfidence || candidate.confidence > policy.maximumConfidence) return [];
    if (candidate.informationGain < policy.minimumInformationGain) return [];
    const prior = history
      .filter((item) => item.fingerprint === candidate.fingerprint)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
    if (prior?.state === 'answered') return [];
    if (prior?.state === 'presented') return [];
    if (prior?.state === 'dismissed') {
      const retryAt = Date.parse(prior.createdAt) + policy.dismissedCooldownDays * 86_400_000;
      if (retryAt > now.getTime()) return [];
    }
    const uncertainty = 1 - Math.abs(candidate.confidence - 0.5) * 2;
    const priority = clamp(candidate.informationGain * 0.7 + uncertainty * 0.3);
    return [{ candidate, priority }];
  }).sort((left, right) => right.priority - left.priority);

  if (eligible.length > remaining) deferredReasons.push('Lower-value questions were deferred to respect the daily confirmation limit.');
  const prompts = eligible.slice(0, remaining).map(({ candidate, priority }): ConfirmationPrompt => ({
    id: `prompt:${candidate.id}`,
    candidateId: candidate.id,
    fingerprint: candidate.fingerprint,
    question: candidate.confirmationQuestion!,
    priority: round(priority, 2),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + policy.promptExpiryHours * 3_600_000).toISOString(),
    evidenceObservationIds: [...new Set(candidate.evidence.flatMap((item) => item.observationIds))],
  }));
  return { prompts, deferredReasons };
}

function isQuietHour(hour: number, start: number, end: number) {
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

function localDayId(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function clamp(value: number) { return Math.max(0, Math.min(1, value)); }
function round(value: number, places: number) { const factor = 10 ** places; return Math.round(value * factor) / factor; }
