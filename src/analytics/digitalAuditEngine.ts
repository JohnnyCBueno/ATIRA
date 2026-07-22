import { DeviceRecord, RawObservation } from '../data/contracts';
import {
  ActivityPurpose,
  DigitalActivityCategory,
  DigitalActivityRule,
  DigitalAudit,
  DigitalAuditApplication,
  DigitalAuditDay,
  DigitalAuditRange,
  DigitalInsight,
  DigitalSignal,
  EvidenceSource,
} from '../domain/types';
import { normalizeDigitalSessions } from '../reconstruction/digitalSessionNormalizer';

const rangeDays: Record<DigitalAuditRange, number> = { '7d': 7, '30d': 30, '90d': 90 };

interface AuditSession {
  observationId: string;
  observationIds: string[];
  source: EvidenceSource;
  deviceId: string;
  deviceLabel: string;
  applicationId: string;
  applicationName: string;
  browserId?: string;
  category: DigitalActivityCategory;
  purpose: ActivityPurpose;
  classificationConfidence: number;
  classificationProvenance: DigitalAuditApplication['classificationProvenance'];
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  interactiveSeconds: number;
  passiveSeconds: number;
  unclassifiedEngagementSeconds: number;
}

export function buildDigitalAudit(
  observations: RawObservation[],
  devices: DeviceRecord[],
  rules: DigitalActivityRule[],
  range: DigitalAuditRange,
  now = new Date(),
): DigitalAudit {
  const expectedDayCount = rangeDays[range];
  const end = endOfLocalDay(now);
  const start = startOfLocalDay(addLocalDays(end, -(expectedDayCount - 1)));
  const priorEnd = new Date(start.getTime() - 1);
  const priorStart = startOfLocalDay(addLocalDays(start, -expectedDayCount));
  const allSessions = normalizeSessions(observations, devices, rules);
  const currentSessions = sessionsWithin(allSessions, start, end);
  const priorSessions = sessionsWithin(allSessions, priorStart, priorEnd);
  const days = summarizeDays(currentSessions, start, expectedDayCount);
  const observedDayCount = days.filter((day) => day.observed).length;
  const priorObservedDayCount = new Set(priorSessions.map((session) => localDayId(new Date(session.startedAt)))).size;
  const applications = summarizeApplications(currentSessions);
  const totalSeconds = currentSessions.reduce((total, session) => total + session.durationSeconds, 0);
  const priorTotal = priorSessions.reduce((total, session) => total + session.durationSeconds, 0);
  const minimumComparableDays = Math.ceil(expectedDayCount / 2);
  const hasComparablePeriods = observedDayCount >= minimumComparableDays && priorObservedDayCount >= minimumComparableDays && priorTotal > 0;
  const signals = hasComparablePeriods ? buildSignals(currentSessions, priorSessions) : [];
  const insights = buildEstablishedInsights(allSessions, currentSessions, range);

  return {
    range,
    startedAt: start.toISOString(),
    endedAt: end.toISOString(),
    expectedDayCount,
    observedDayCount,
    missingDayCount: expectedDayCount - observedDayCount,
    coveragePercent: Math.round((observedDayCount / expectedDayCount) * 100),
    totalSeconds,
    sources: [...new Set(currentSessions.map((session) => session.source))],
    priorTotalSeconds: hasComparablePeriods ? priorTotal : null,
    maturity: insights.length > 0 ? 'established' : signals.length > 0 ? 'emerging' : 'audit',
    applications,
    days,
    hours: summarizeHours(currentSessions),
    categories: summarizeCategories(currentSessions),
    purposes: summarizePurposes(currentSessions),
    devices: summarizeDevices(currentSessions),
    engagement: summarizeEngagement(observations, start, end),
    signals,
    insights,
  };
}

function summarizeHours(sessions: AuditSession[]) {
  return Array.from({ length: 24 }, (_, hour) => {
    const hourSessions = sessions.filter((session) => new Date(session.startedAt).getHours() === hour);
    return {
      hour,
      totalSeconds: hourSessions.reduce((total, session) => total + session.durationSeconds, 0),
      categories: summarizeCategories(hourSessions),
      purposes: summarizePurposes(hourSessions),
    };
  });
}

function normalizeSessions(observations: RawObservation[], devices: DeviceRecord[], rules: DigitalActivityRule[]): AuditSession[] {
  return normalizeDigitalSessions(observations, devices, rules);
}

function sessionsWithin(sessions: AuditSession[], start: Date, end: Date) {
  const startTime = start.getTime();
  const endTime = end.getTime();
  return sessions.filter((session) => {
    const time = Date.parse(session.startedAt);
    return time >= startTime && time <= endTime;
  });
}

function summarizeApplications(sessions: AuditSession[]): DigitalAuditApplication[] {
  const grouped = new Map<string, DigitalAuditApplication>();
  for (const session of sessions) {
    const key = `${session.deviceId}\u0000${session.browserId ?? ''}\u0000${session.applicationId}`;
    const application = grouped.get(key) ?? {
      deviceId: session.deviceId,
      deviceLabel: session.deviceLabel,
      applicationId: session.applicationId,
      applicationName: session.applicationName,
      browserId: session.browserId,
      category: session.category,
      purpose: session.purpose,
      classificationConfidence: session.classificationConfidence,
      classificationProvenance: session.classificationProvenance,
      durationSeconds: 0,
      interactiveSeconds: 0,
      passiveSeconds: 0,
      unclassifiedEngagementSeconds: 0,
      sessionCount: 0,
      observationIds: [],
    };
    application.durationSeconds += session.durationSeconds;
    application.interactiveSeconds += session.interactiveSeconds;
    application.passiveSeconds += session.passiveSeconds;
    application.unclassifiedEngagementSeconds += session.unclassifiedEngagementSeconds;
    application.sessionCount += 1;
    application.observationIds.push(...session.observationIds);
    grouped.set(key, application);
  }
  return [...grouped.values()].sort((a, b) => b.durationSeconds - a.durationSeconds);
}

function summarizeDays(sessions: AuditSession[], start: Date, count: number): DigitalAuditDay[] {
  return Array.from({ length: count }, (_, index) => {
    const date = addLocalDays(start, index);
    const dayId = localDayId(date);
    const daySessions = sessions.filter((session) => localDayId(new Date(session.startedAt)) === dayId);
    return {
      dayId,
      observed: daySessions.length > 0,
      totalSeconds: daySessions.reduce((total, session) => total + session.durationSeconds, 0),
      categories: summarizeCategories(daySessions),
      purposes: summarizePurposes(daySessions),
    };
  });
}

function summarizeCategories(sessions: AuditSession[]) {
  const totals = new Map<DigitalActivityCategory, number>();
  for (const session of sessions) totals.set(session.category, (totals.get(session.category) ?? 0) + session.durationSeconds);
  return allCategories.map((category) => ({ category, durationSeconds: totals.get(category) ?? 0 }));
}

function summarizePurposes(sessions: AuditSession[]) {
  const totals = new Map<ActivityPurpose, number>();
  for (const session of sessions) totals.set(session.purpose, (totals.get(session.purpose) ?? 0) + session.durationSeconds);
  return allPurposes.map((purpose) => ({ purpose, durationSeconds: totals.get(purpose) ?? 0 }));
}

function summarizeDevices(sessions: AuditSession[]) {
  const totals = new Map<string, { deviceId: string; deviceLabel: string; durationSeconds: number }>();
  for (const session of sessions) {
    const device = totals.get(session.deviceId) ?? { deviceId: session.deviceId, deviceLabel: session.deviceLabel, durationSeconds: 0 };
    device.durationSeconds += session.durationSeconds;
    totals.set(session.deviceId, device);
  }
  return [...totals.values()].sort((a, b) => b.durationSeconds - a.durationSeconds);
}

function summarizeEngagement(observations: RawObservation[], start: Date, end: Date) {
  const totals = { interactiveSeconds: 0, passiveSeconds: 0, awaySeconds: 0, lockedSeconds: 0, unclassifiedSeconds: 0 };
  for (const observation of observations) {
    if (!['desktop_foreground', 'app_foreground'].includes(observation.kind)) continue;
    const started = Date.parse(observation.startedAt);
    const ended = Date.parse(observation.endedAt ?? observation.capturedAt);
    if (!Number.isFinite(started) || !Number.isFinite(ended) || started < start.getTime() || started > end.getTime() || ended <= started) continue;
    const duration = Math.round((ended - started) / 1000);
    const state = String(observation.payload.activityState ?? 'active');
    if (state === 'idle') totals.awaySeconds += numericPayloadSeconds(observation.payload.awaySeconds, duration) || duration;
    else if (state === 'locked') totals.lockedSeconds += numericPayloadSeconds(observation.payload.lockedSeconds, duration) || duration;
    else {
      const interactive = numericPayloadSeconds(observation.payload.interactiveSeconds, duration);
      const passive = numericPayloadSeconds(observation.payload.passiveSeconds, duration - interactive);
      totals.interactiveSeconds += interactive;
      totals.passiveSeconds += passive;
      totals.unclassifiedSeconds += Math.max(0, duration - interactive - passive);
    }
  }
  const classified = totals.interactiveSeconds + totals.passiveSeconds;
  const active = classified + totals.unclassifiedSeconds;
  return { ...totals, classifiedActiveCoveragePercent: active > 0 ? Math.round((classified / active) * 100) : 0 };
}

function numericPayloadSeconds(value: unknown, maximum: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(maximum, Math.round(value))) : 0;
}

function buildSignals(current: AuditSession[], prior: AuditSession[]): DigitalSignal[] {
  const currentTotal = current.reduce((total, session) => total + session.durationSeconds, 0);
  const priorTotal = prior.reduce((total, session) => total + session.durationSeconds, 0);
  if (currentTotal === 0 || priorTotal === 0) return [];
  const candidates = allCategories.map((category) => {
    const currentSeconds = current.filter((session) => session.category === category).reduce((total, session) => total + session.durationSeconds, 0);
    const priorSeconds = prior.filter((session) => session.category === category).reduce((total, session) => total + session.durationSeconds, 0);
    return { category, currentSeconds, priorSeconds, shareChange: currentSeconds / currentTotal - priorSeconds / priorTotal };
  }).sort((a, b) => Math.abs(b.shareChange) - Math.abs(a.shareChange));
  const strongest = candidates[0];
  if (!strongest || Math.abs(strongest.shareChange) < 0.15) return [];
  const direction = strongest.shareChange > 0 ? 'larger' : 'smaller';
  const relevant = current.filter((session) => session.category === strongest.category);
  return [{
    id: `digital-signal-${strongest.category}`,
    maturity: 'emerging',
    title: `${labelCategory(strongest.category)} changed across comparable periods`,
    summary: `${labelCategory(strongest.category)} occupied a ${direction} share of observed digital time. This is provisional and may reflect coverage differences.`,
    confidence: Math.min(0.79, 0.55 + Math.abs(strongest.shareChange)),
    evidence: [{
      id: `digital-signal-evidence-${strongest.category}`,
      label: 'Comparable-period application sessions',
      detail: `${formatPercent(strongest.currentSeconds / currentTotal)} now versus ${formatPercent(strongest.priorSeconds / priorTotal)} previously.`,
      source: relevant[0]?.source ?? 'desktop',
      observationIds: relevant.flatMap((session) => session.observationIds),
    }],
  }];
}

function buildEstablishedInsights(allSessions: AuditSession[], current: AuditSession[], range: DigitalAuditRange): DigitalInsight[] {
  if (range === '7d' || allSessions.length === 0) return [];
  const observedDays = new Set(allSessions.map((session) => localDayId(new Date(session.startedAt))));
  const first = new Date(allSessions[0].startedAt);
  const last = new Date(allSessions.at(-1)?.startedAt ?? allSessions[0].startedAt);
  const historyDays = Math.floor((startOfLocalDay(last).getTime() - startOfLocalDay(first).getTime()) / 86_400_000) + 1;
  if (historyDays < 28 || observedDays.size < 20) return [];
  const applications = summarizeApplications(current);
  const strongest = applications[0];
  if (!strongest) return [];
  const supportingSessions = current.filter((session) => session.deviceId === strongest.deviceId && session.applicationId === strongest.applicationId);
  const supportingDays = new Set(supportingSessions.map((session) => localDayId(new Date(session.startedAt))));
  const supportingWeeks = new Set(supportingSessions.map((session) => weekId(new Date(session.startedAt))));
  if (supportingDays.size < 3 || supportingWeeks.size < 3) return [];
  const recurrence: DigitalInsight = {
    id: `digital-insight-recurrence-${strongest.deviceId}-${strongest.applicationId}`,
    maturity: 'established',
    title: `${strongest.applicationName} is a recurring part of your observed digital routine`,
    summary: `It appeared on ${supportingDays.size} observed days across ${supportingWeeks.size} separate weeks. ATIRA is describing recurrence, not whether that time was productive.`,
    confidence: Math.min(0.9, 0.7 + supportingWeeks.size * 0.03),
    evidence: [{
      id: `digital-insight-evidence-${strongest.deviceId}-${strongest.applicationId}`,
      label: `${strongest.deviceLabel} sessions`,
      detail: `${supportingSessions.length} sessions totalling ${formatDuration(strongest.durationSeconds)} in the selected range.`,
      source: supportingSessions[0]?.source ?? 'desktop',
      observationIds: supportingSessions.flatMap((session) => session.observationIds),
    }],
  };
  const engagementCandidate = applications
    .filter((application) => application.interactiveSeconds + application.passiveSeconds >= 30 * 60 && application.sessionCount >= 3)
    .sort((a, b) => (b.interactiveSeconds + b.passiveSeconds) - (a.interactiveSeconds + a.passiveSeconds))[0];
  if (!engagementCandidate) return [recurrence];
  const classifiedSeconds = engagementCandidate.interactiveSeconds + engagementCandidate.passiveSeconds;
  const interactiveShare = engagementCandidate.interactiveSeconds / classifiedSeconds;
  if (interactiveShare > 0.35 && interactiveShare < 0.65) return [recurrence];
  const engagementSessions = current.filter((session) => session.deviceId === engagementCandidate.deviceId && session.applicationId === engagementCandidate.applicationId);
  const posture = interactiveShare >= 0.65 ? 'consistently hands-on' : 'predominantly passive';
  const interpretation = interactiveShare >= 0.65
    ? 'Recent input accompanied most of this foreground time, suggesting active manipulation rather than an application simply remaining visible.'
    : 'Most foreground time occurred without recent input, which may represent reading, watching, waiting, or an application left visible.';
  return [recurrence, {
    id: `digital-insight-engagement-${engagementCandidate.deviceId}-${engagementCandidate.applicationId}`,
    maturity: 'established',
    title: `${engagementCandidate.applicationName} use was ${posture}`,
    summary: `${interpretation} This describes interaction intensity, not the quality or productivity of the result.`,
    confidence: Math.min(0.88, 0.68 + Math.abs(interactiveShare - 0.5) * 0.4),
    evidence: [{
      id: `digital-insight-engagement-evidence-${engagementCandidate.deviceId}-${engagementCandidate.applicationId}`,
      label: 'Interaction-qualified foreground sessions',
      detail: `${formatPercent(interactiveShare)} interactive and ${formatPercent(1 - interactiveShare)} passive across ${formatDuration(classifiedSeconds)} of classified foreground time.`,
      source: engagementSessions[0]?.source ?? 'desktop',
      observationIds: engagementSessions.flatMap((session) => session.observationIds),
    }],
  }];
}

const allCategories: readonly DigitalActivityCategory[] = ['creation', 'communication', 'learning', 'entertainment', 'browser', 'ai_assistance', 'other'];
const allPurposes: readonly ActivityPurpose[] = ['work', 'learning', 'personal', 'unknown'];

function startOfLocalDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function endOfLocalDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999); }
function addLocalDays(date: Date, days: number) { const next = new Date(date); next.setDate(next.getDate() + days); return next; }
function localDayId(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function weekId(date: Date) { const start = startOfLocalDay(date); start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); return localDayId(start); }
function labelCategory(category: DigitalActivityCategory) { return category.replace('_', ' ').replace(/^./, (letter) => letter.toUpperCase()); }
function formatPercent(value: number) { return `${Math.round(value * 100)}%`; }
function formatDuration(seconds: number) { const hours = Math.floor(seconds / 3600); const minutes = Math.round((seconds % 3600) / 60); return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`; }
