import { DeviceRecord, RawObservation } from '../data/contracts';
import { ActivityPurpose, ClassificationProvenance, DigitalActivityCategory, DigitalActivityRule, EvidenceSource } from '../domain/types';
import { classifyDigitalApplication, classifyDigitalDomain, normalizeDigitalApplication } from './digitalActivityClassifier';

export interface NormalizedDigitalSession {
  observationId: string;
  observationIds: string[];
  source: EvidenceSource;
  deviceId: string;
  deviceLabel: string;
  applicationId: string;
  applicationName: string;
  browserId?: string;
  activityLabel: string;
  category: DigitalActivityCategory;
  purpose: ActivityPurpose;
  classificationConfidence: number;
  classificationProvenance: ClassificationProvenance;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  interactiveSeconds: number;
  passiveSeconds: number;
  unclassifiedEngagementSeconds: number;
}

// A single foreground/"recent input" signal is not enough to establish that a
// person was meaningfully present through an entire night. Windows can receive
// synthetic or peripheral input that continually resets its idle timer. The
// raw observation remains immutable, but this class of session stays out of
// descriptive audits and pattern inputs until another source can corroborate it.
const UNVERIFIED_OVERNIGHT_FOREGROUND_SECONDS = 6 * 60 * 60;

interface Candidate extends NormalizedDigitalSession {
  browserContext: boolean;
  nativeApplicationId: string;
}

export function normalizeDigitalSessions(
  observations: RawObservation[],
  devices: DeviceRecord[],
  rules: DigitalActivityRule[],
): NormalizedDigitalSession[] {
  const deviceById = new Map(devices.map((device) => [device.id, device]));
  const candidates = observations.flatMap((observation): Candidate[] => {
    if (!['desktop_foreground', 'app_foreground', 'browser_foreground'].includes(observation.kind)) return [];
    if (String(observation.payload.activityState ?? 'active') !== 'active') return [];
    const started = Date.parse(observation.startedAt);
    const ended = Date.parse(observation.endedAt ?? observation.capturedAt);
    if (!Number.isFinite(started) || !Number.isFinite(ended) || ended <= started) return [];
    const durationSeconds = Math.round((ended - started) / 1000);
    if (isUnverifiedOvernightForeground(observation, started, ended, durationSeconds)) return [];
    const deviceId = observation.deviceId ?? `legacy-${observation.source}-device`;
    const domain = observation.kind === 'browser_foreground' && typeof observation.payload.domain === 'string' ? observation.payload.domain : '';
    const application = typeof observation.payload.application === 'string' ? observation.payload.application : '';
    const browserId = domain ? normalizeBrowserId(observation.payload.browser, application) : undefined;
    const classification = domain
      ? classifyDigitalDomain(domain, deviceId, rules)
      : classifyDigitalApplication(application, deviceId, rules);
    if (classification.excluded) return [];
    const interactiveSeconds = numericSeconds(observation.payload.interactiveSeconds, durationSeconds);
    const passiveSeconds = numericSeconds(observation.payload.passiveSeconds, durationSeconds - interactiveSeconds);
    return [{
      observationId: observation.id,
      observationIds: [observation.id],
      source: observation.source,
      deviceId,
      deviceLabel: deviceById.get(deviceId)?.label ?? 'Unknown device',
      applicationId: classification.applicationId,
      applicationName: classification.applicationName,
      browserId,
      activityLabel: domain ? classification.applicationName : application,
      category: classification.category,
      purpose: classification.purpose,
      classificationConfidence: classification.confidence,
      classificationProvenance: classification.provenance,
      startedAt: new Date(started).toISOString(),
      endedAt: new Date(ended).toISOString(),
      durationSeconds,
      interactiveSeconds,
      passiveSeconds,
      unclassifiedEngagementSeconds: Math.max(0, durationSeconds - interactiveSeconds - passiveSeconds),
      browserContext: Boolean(domain),
      nativeApplicationId: browserId ? browserApplicationId(browserId) : normalizeDigitalApplication(application),
    }];
  });

  const coalescedBrowser = coalesceBrowserCandidates(candidates.filter((item) => item.browserContext));
  const meaningfulCandidates = [
    ...candidates.filter((item) => !item.browserContext && item.durationSeconds >= 60),
    ...coalescedBrowser.filter((item) => item.durationSeconds >= 60),
  ];
  const browserIntervals = meaningfulCandidates.filter((item) => item.browserContext);
  return meaningfulCandidates.flatMap((candidate): NormalizedDigitalSession[] => {
    if (candidate.browserContext || !isBrowserApplication(candidate.nativeApplicationId)) return [withoutInternalFields(candidate)];
    const overlaps = browserIntervals
      .filter((item) => item.deviceId === candidate.deviceId && item.nativeApplicationId === candidate.nativeApplicationId)
      .map((item) => [Date.parse(item.startedAt), Date.parse(item.endedAt)] as const);
    return subtractIntervals(Date.parse(candidate.startedAt), Date.parse(candidate.endedAt), overlaps)
      .filter(([start, end]) => end - start >= 60_000)
      .map(([start, end], index) => ({
        ...scaleEngagement(withoutInternalFields(candidate), (end - start) / (Date.parse(candidate.endedAt) - Date.parse(candidate.startedAt))),
        observationId: index === 0 ? candidate.observationId : `${candidate.observationId}:remainder:${index}`,
        startedAt: new Date(start).toISOString(),
        endedAt: new Date(end).toISOString(),
        durationSeconds: Math.round((end - start) / 1000),
      }));
  }).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

export function isUnverifiedOvernightForeground(
  observation: Pick<RawObservation, 'kind' | 'payload'>,
  startedAt: number,
  endedAt: number,
  durationSeconds = Math.round((endedAt - startedAt) / 1_000),
) {
  if (!['desktop_foreground', 'app_foreground'].includes(observation.kind)) return false;
  if (String(observation.payload.activityState ?? 'active') !== 'active') return false;
  if (durationSeconds < UNVERIFIED_OVERNIGHT_FOREGROUND_SECONDS) return false;
  return localDayId(startedAt) !== localDayId(endedAt);
}

function numericSeconds(value: unknown, maximum: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(maximum, Math.round(value))) : 0;
}

function scaleEngagement<T extends NormalizedDigitalSession>(session: T, ratio: number): T {
  return {
    ...session,
    interactiveSeconds: Math.round(session.interactiveSeconds * ratio),
    passiveSeconds: Math.round(session.passiveSeconds * ratio),
    unclassifiedEngagementSeconds: Math.round(session.unclassifiedEngagementSeconds * ratio),
  };
}

function withoutInternalFields(candidate: Candidate): NormalizedDigitalSession {
  const { browserContext: _browserContext, nativeApplicationId: _nativeApplicationId, ...session } = candidate;
  return session;
}

function isBrowserApplication(applicationId: string) {
  return ['chrome', 'msedge', 'firefox', 'brave', 'opera'].includes(applicationId);
}

function coalesceBrowserCandidates(candidates: Candidate[]) {
  const sorted = [...candidates].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const runs: Candidate[] = [];
  for (const candidate of sorted) {
    const current = runs.at(-1);
    const gap = current ? Date.parse(candidate.startedAt) - Date.parse(current.endedAt) : Number.POSITIVE_INFINITY;
    if (current && current.deviceId === candidate.deviceId && current.nativeApplicationId === candidate.nativeApplicationId && current.applicationId === candidate.applicationId && gap <= 5_000) {
      const end = Math.max(Date.parse(current.endedAt), Date.parse(candidate.endedAt));
      current.endedAt = new Date(end).toISOString();
      current.durationSeconds = Math.round((end - Date.parse(current.startedAt)) / 1000);
      current.observationIds.push(...candidate.observationIds);
      continue;
    }
    runs.push({ ...candidate, observationIds: [...candidate.observationIds] });
  }
  return runs;
}

function normalizeBrowserId(value: unknown, application: string) {
  const browser = String(value ?? '').toLowerCase();
  if (['chrome', 'edge', 'brave', 'opera', 'firefox', 'safari'].includes(browser)) return browser;
  const applicationId = normalizeDigitalApplication(application);
  return applicationId === 'msedge' ? 'edge' : ['chrome', 'brave', 'opera', 'firefox', 'safari'].includes(applicationId) ? applicationId : 'chrome';
}

function browserApplicationId(browserId: string) {
  return browserId === 'edge' ? 'msedge' : browserId;
}

function subtractIntervals(start: number, end: number, intervals: readonly (readonly [number, number])[]) {
  let fragments: [number, number][] = [[start, end]];
  for (const [cutStart, cutEnd] of intervals) {
    fragments = fragments.flatMap(([fragmentStart, fragmentEnd]) => {
      if (cutEnd <= fragmentStart || cutStart >= fragmentEnd) return [[fragmentStart, fragmentEnd]];
      const next: [number, number][] = [];
      if (cutStart > fragmentStart) next.push([fragmentStart, Math.min(cutStart, fragmentEnd)]);
      if (cutEnd < fragmentEnd) next.push([Math.max(cutEnd, fragmentStart), fragmentEnd]);
      return next;
    });
  }
  return fragments;
}

function localDayId(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
