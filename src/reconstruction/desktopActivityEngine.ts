import { DeviceRecord, RawObservation } from '../data/contracts';
import { DayRecord, DesktopUsageHour, DesktopUsageSummary, DeviceClass, DevicePlatform, DigitalActivityCategory, EventCategory, TimelineEvent } from '../domain/types';

export type DesktopActivityKind =
  | 'focused_work'
  | 'communication'
  | 'learning'
  | 'entertainment'
  | 'browser'
  | 'ai_assistance'
  | 'computer_activity';

export interface DesktopActivityBlock {
  id: string;
  dayId: string;
  kind: DesktopActivityKind;
  title: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  applications: string[];
  confidence: number;
  observationIds: string[];
}

export interface DesktopDayReconstruction {
  dayId: string;
  deviceId: string;
  deviceLabel: string;
  deviceClass: DeviceClass;
  platform: DevicePlatform;
  blocks: DesktopActivityBlock[];
  observedSeconds: number;
  focusedWorkSeconds: number;
  learningSeconds: number;
  coveragePercent: number;
  startedAt: string;
  endedAt: string;
  usage: DesktopUsageSummary;
}

interface ClassifiedSession {
  observationId: string;
  deviceId: string;
  dayId: string;
  kind: DesktopActivityKind;
  title: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  application: string | null;
  applicationId: string;
  applicationName: string;
  usageCategory: DigitalActivityCategory;
  confidence: number;
}

const focusedApplications = ['code', 'devenv', 'rider64', 'webstorm64', 'pycharm64', 'idea64', 'excel', 'winword', 'powerpnt', 'figma', 'photoshop', 'illustrator', 'blender', 'autocad', 'notion', 'obsidian', 'powershell', 'pwsh', 'cmd', 'windowsterminal'];
const communicationApplications = ['teams', 'ms-teams', 'slack', 'zoom', 'outlook', 'thunderbird', 'webex'];
const learningApplications = ['anki', 'kindle', 'duolingo'];
const entertainmentApplications = ['spotify', 'vlc', 'steam', 'epicgameslauncher'];
const browserApplications = ['chrome', 'msedge', 'firefox', 'brave', 'opera'];
const systemApplications = ['explorer', 'taskmgr'];
const ignoredApplications = new Set(['atira', 'electron']);

export function reconstructDesktopActivity(observations: RawObservation[], devices: DeviceRecord[] = []): DesktopDayReconstruction[] {
  const deviceById = new Map(devices.map((device) => [device.id, device]));
  const sessions = observations
    .filter((observation) => observation.source === 'desktop' && observation.kind === 'desktop_foreground')
    .map(classifyObservation)
    .filter((session): session is ClassifiedSession => session != null)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const sessionsByDayAndDevice = new Map<string, ClassifiedSession[]>();
  for (const session of sessions) {
    const key = `${session.dayId}\u0000${session.deviceId}`;
    const daySessions = sessionsByDayAndDevice.get(key) ?? [];
    daySessions.push(session);
    sessionsByDayAndDevice.set(key, daySessions);
  }
  return [...sessionsByDayAndDevice.values()].map((daySessions) => {
    const first = daySessions[0];
    return reconstructDay(first.dayId, deviceFor(first.deviceId, deviceById), daySessions);
  });
}

export function desktopDayToRecord(result: DesktopDayReconstruction, existing?: DayRecord, now = new Date()): DayRecord {
  return desktopDayResultsToRecord([result], existing, now);
}

export function desktopDayResultsToRecord(results: DesktopDayReconstruction[], existing?: DayRecord, now = new Date()): DayRecord {
  if (results.length === 0) throw new Error('At least one desktop reconstruction is required.');
  const dayId = results[0].dayId;
  if (results.some((result) => result.dayId !== dayId)) throw new Error('Desktop reconstructions must belong to one day.');
  const correctedEvents = new Map((existing?.events ?? [])
    .filter((event) => ['confirmed', 'corrected'].includes(event.state))
    .map((event) => [event.id, event]));
  const blocks = results.flatMap((result) => result.blocks).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const events = blocks.map((block) => {
    const inferred = blockToEvent(block);
    const corrected = correctedEvents.get(inferred.id);
    return corrected ? { ...inferred, title: corrected.title, state: corrected.state, confidence: corrected.confidence } : inferred;
  });
  const observedSeconds = unionDuration(blocks);
  const focusedWorkSeconds = unionDuration(blocks.filter((block) => ['focused_work', 'communication'].includes(block.kind)));
  const learningSeconds = unionDuration(blocks.filter((block) => block.kind === 'learning'));
  const startedAt = blocks[0]?.startedAt ?? `${dayId}T00:00:00.000Z`;
  const endedAt = blocks.at(-1)?.endedAt ?? startedAt;
  const spanSeconds = Math.max(observedSeconds, (Date.parse(endedAt) - Date.parse(startedAt)) / 1000);
  const date = parseLocalDay(dayId);
  return {
    id: dayId,
    weekday: date.toLocaleDateString([], { weekday: 'short' }),
    dayNumber: String(date.getDate()),
    month: date.toLocaleDateString([], { month: 'long' }),
    relativeLabel: relativeDayLabel(date, now),
    coverage: spanSeconds > 0 ? Math.min(100, Math.round((observedSeconds / spanSeconds) * 100)) : 0,
    understood: formatDuration(observedSeconds),
    work: formatDuration(focusedWorkSeconds),
    movement: '—',
    learning: formatDuration(learningSeconds),
    distance: '—',
    routePath: '',
    places: [],
    events,
    desktopUsages: results.map((result) => result.usage).sort((a, b) => a.deviceLabel.localeCompare(b.deviceLabel)),
  };
}

function unionDuration(blocks: DesktopActivityBlock[]) {
  const intervals = blocks
    .map((block) => [Date.parse(block.startedAt), Date.parse(block.endedAt)] as const)
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
    .sort((a, b) => a[0] - b[0]);
  let totalMilliseconds = 0;
  let currentStart = intervals[0]?.[0];
  let currentEnd = intervals[0]?.[1];
  if (currentStart == null || currentEnd == null) return 0;
  for (const [start, end] of intervals.slice(1)) {
    if (start <= currentEnd) currentEnd = Math.max(currentEnd, end);
    else {
      totalMilliseconds += currentEnd - currentStart;
      currentStart = start;
      currentEnd = end;
    }
  }
  return Math.round((totalMilliseconds + currentEnd - currentStart) / 1000);
}

function reconstructDay(dayId: string, device: DeviceRecord, sessions: ClassifiedSession[]): DesktopDayReconstruction {
  const blocks: DesktopActivityBlock[] = [];
  for (const session of sessions) {
    const current = blocks.at(-1);
    const gapSeconds = current ? Math.max(0, (Date.parse(session.startedAt) - Date.parse(current.endedAt)) / 1000) : Infinity;
    if (current && current.kind === session.kind && gapSeconds <= 120) {
      current.endedAt = session.endedAt;
      current.durationSeconds += session.durationSeconds;
      current.confidence = Math.min(current.confidence, session.confidence);
      current.observationIds.push(session.observationId);
      if (session.application && !current.applications.includes(session.application)) current.applications.push(session.application);
      continue;
    }
    blocks.push({
      id: `desktop-block-${session.observationId}`,
      dayId,
      kind: session.kind,
      title: session.title,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationSeconds: session.durationSeconds,
      applications: session.application ? [session.application] : [],
      confidence: session.confidence,
      observationIds: [session.observationId],
    });
  }
  const observedSeconds = blocks.reduce((total, block) => total + block.durationSeconds, 0);
  const startedAt = blocks[0]?.startedAt ?? `${dayId}T00:00:00.000Z`;
  const endedAt = blocks.at(-1)?.endedAt ?? startedAt;
  const spanSeconds = Math.max(observedSeconds, (Date.parse(endedAt) - Date.parse(startedAt)) / 1000);
  return {
    dayId,
    deviceId: device.id,
    deviceLabel: device.label,
    deviceClass: device.deviceClass,
    platform: device.platform,
    blocks,
    observedSeconds,
    focusedWorkSeconds: blocks.filter((block) => ['focused_work', 'communication'].includes(block.kind)).reduce((total, block) => total + block.durationSeconds, 0),
    learningSeconds: blocks.filter((block) => block.kind === 'learning').reduce((total, block) => total + block.durationSeconds, 0),
    coveragePercent: spanSeconds > 0 ? Math.min(100, Math.round((observedSeconds / spanSeconds) * 100)) : 0,
    startedAt,
    endedAt,
    usage: summarizeUsage(sessions, device),
  };
}

function classifyObservation(observation: RawObservation): ClassifiedSession | null {
  const startedAt = new Date(observation.startedAt);
  const endedAt = new Date(observation.endedAt ?? observation.capturedAt);
  if (!Number.isFinite(startedAt.getTime()) || !Number.isFinite(endedAt.getTime()) || endedAt <= startedAt) return null;
  const durationSeconds = Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));
  const state = String(observation.payload.activityState ?? 'active');
  const application = typeof observation.payload.application === 'string' ? observation.payload.application : null;
  if (state !== 'active' || !application || durationSeconds < 60) return null;
  const applicationId = normalizeApplication(application);
  if (!applicationId || ignoredApplications.has(applicationId)) return null;
  const classification = classifyApplication(application);
  return {
    observationId: observation.id,
    deviceId: observation.deviceId ?? 'legacy-desktop-device',
    dayId: localDayId(startedAt),
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationSeconds,
    application,
    applicationId,
    applicationName: displayApplicationName(applicationId, application),
    usageCategory: usageCategoryForKind(classification.kind),
    ...classification,
  };
}

function classifyApplication(application: string | null): Pick<ClassifiedSession, 'kind' | 'title' | 'confidence'> {
  const normalized = normalizeApplication(application ?? '');
  if (normalized === 'chatgpt') return { kind: 'ai_assistance', title: 'ChatGPT activity', confidence: 0.55 };
  if (focusedApplications.some((name) => normalized.includes(name))) return { kind: 'focused_work', title: 'Focused desktop work', confidence: 0.82 };
  if (communicationApplications.some((name) => normalized.includes(name))) return { kind: 'communication', title: 'Communication block', confidence: 0.86 };
  if (learningApplications.some((name) => normalized.includes(name))) return { kind: 'learning', title: 'Learning on desktop', confidence: 0.78 };
  if (entertainmentApplications.some((name) => normalized.includes(name))) return { kind: 'entertainment', title: 'Entertainment activity', confidence: 0.7 };
  if (browserApplications.some((name) => normalized.includes(name))) return { kind: 'browser', title: 'Browser activity', confidence: 0.45 };
  if (systemApplications.some((name) => normalized.includes(name))) return { kind: 'computer_activity', title: 'Desktop administration', confidence: 0.68 };
  return { kind: 'computer_activity', title: `${application ?? 'Computer'} activity`, confidence: 0.52 };
}

function blockToEvent(block: DesktopActivityBlock): TimelineEvent {
  const category: Record<DesktopActivityKind, EventCategory> = {
    focused_work: 'creation', communication: 'communication', learning: 'learning', entertainment: 'digital',
    browser: 'digital', ai_assistance: 'digital', computer_activity: 'digital',
  };
  const appDetail = block.applications.length > 0 ? block.applications.join(', ') : 'No foreground application';
  return {
    id: `desktop-event-${block.observationIds[0]}`,
    title: block.title,
    category: category[block.kind],
    start: formatClock(block.startedAt),
    end: formatClock(block.endedAt),
    duration: formatDuration(block.durationSeconds),
    state: block.confidence >= 0.8 ? 'inferred_high' : 'inferred_medium',
    confidence: block.confidence,
    summary: eventSummary(block, appDetail),
    evidence: [{
      id: `desktop-evidence-${block.observationIds[0]}`,
      source: 'desktop',
      label: block.applications.length > 1 ? 'Foreground applications' : 'Foreground application',
      detail: `${appDetail} · ${block.observationIds.length} completed session${block.observationIds.length === 1 ? '' : 's'}`,
      strength: block.confidence >= 0.8 ? 'strong' : 'supporting',
    }],
    alternatives: eventAlternatives(block.kind),
  };
}

function eventSummary(block: DesktopActivityBlock, applications: string) {
  if (block.kind === 'browser') return `The browser was foreground for ${formatDuration(block.durationSeconds)}. Without domains or window titles, ATIRA cannot infer whether that time was productive.`;
  if (block.kind === 'ai_assistance') return `ChatGPT was foreground for ${formatDuration(block.durationSeconds)}. The app name alone does not reveal whether this was work, learning, or personal use.`;
  return `${applications} stayed foreground across ${block.observationIds.length} session${block.observationIds.length === 1 ? '' : 's'}, supporting this ${block.title.toLowerCase()} inference.`;
}

function eventAlternatives(kind: DesktopActivityKind) {
  if (kind === 'communication') return ['Meetings', 'Email and messages', 'Personal communication'];
  if (kind === 'focused_work') return ['Focused work', 'Administrative work', 'Learning'];
  if (kind === 'learning') return ['Study', 'Reading', 'Practice'];
  return ['Work', 'Learning', 'Entertainment', 'General computer use'];
}

function summarizeUsage(sessions: ClassifiedSession[], device: DeviceRecord): DesktopUsageSummary {
  const applications = new Map<string, DesktopUsageSummary['applications'][number]>();
  const hourCategories = Array.from({ length: 24 }, () => new Map<DigitalActivityCategory, number>());
  const hourTotals = Array.from({ length: 24 }, () => 0);

  for (const session of sessions) {
    const usageSession = {
      id: session.observationId,
      deviceId: session.deviceId,
      applicationId: session.applicationId,
      applicationName: session.applicationName,
      category: session.usageCategory,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationSeconds: session.durationSeconds,
    };
    const application = applications.get(session.applicationId) ?? {
      deviceId: session.deviceId,
      applicationId: session.applicationId,
      applicationName: session.applicationName,
      category: session.usageCategory,
      durationSeconds: 0,
      sessions: [],
    };
    application.durationSeconds += session.durationSeconds;
    application.sessions.push(usageSession);
    applications.set(session.applicationId, application);
    distributeSessionAcrossHours(session, hourTotals, hourCategories);
  }

  const hours: DesktopUsageHour[] = hourTotals.map((totalSeconds, hour) => ({
    hour,
    totalSeconds,
    categories: [...hourCategories[hour].entries()]
      .map(([category, durationSeconds]) => ({ category, durationSeconds }))
      .sort((a, b) => b.durationSeconds - a.durationSeconds),
  }));
  const sortedApplications = [...applications.values()]
    .map((application) => ({ ...application, sessions: application.sessions.sort((a, b) => a.startedAt.localeCompare(b.startedAt)) }))
    .sort((a, b) => b.durationSeconds - a.durationSeconds);

  return {
    deviceId: device.id,
    deviceLabel: device.label,
    deviceClass: device.deviceClass,
    platform: device.platform,
    totalSeconds: sortedApplications.reduce((total, application) => total + application.durationSeconds, 0),
    applications: sortedApplications,
    hours,
  };
}

function deviceFor(deviceId: string, devices: Map<string, DeviceRecord>): DeviceRecord {
  return devices.get(deviceId) ?? {
    id: deviceId,
    deviceClass: 'computer',
    platform: 'unknown',
    label: deviceId === 'legacy-desktop-device' ? 'Legacy Windows computer' : 'Unknown computer',
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

function distributeSessionAcrossHours(
  session: ClassifiedSession,
  totals: number[],
  categories: Map<DigitalActivityCategory, number>[],
) {
  let cursor = Date.parse(session.startedAt);
  const end = Date.parse(session.endedAt);
  while (cursor < end) {
    const current = new Date(cursor);
    const nextHour = new Date(current);
    nextHour.setMinutes(60, 0, 0);
    const boundary = Math.min(end, nextHour.getTime());
    const seconds = Math.max(0, Math.round((boundary - cursor) / 1000));
    const hour = current.getHours();
    totals[hour] += seconds;
    categories[hour].set(session.usageCategory, (categories[hour].get(session.usageCategory) ?? 0) + seconds);
    cursor = boundary;
  }
}

function usageCategoryForKind(kind: DesktopActivityKind): DigitalActivityCategory {
  if (kind === 'focused_work') return 'creation';
  if (kind === 'communication') return 'communication';
  if (kind === 'learning') return 'learning';
  if (kind === 'entertainment') return 'entertainment';
  if (kind === 'browser') return 'browser';
  if (kind === 'ai_assistance') return 'ai_assistance';
  return 'other';
}

function normalizeApplication(application: string) {
  return application.toLowerCase().replace(/\.exe$/, '').replace(/[^a-z0-9-]/g, '');
}

function displayApplicationName(applicationId: string, fallback: string) {
  const knownNames: Record<string, string> = {
    chatgpt: 'ChatGPT', chrome: 'Google Chrome', msedge: 'Microsoft Edge', firefox: 'Firefox', brave: 'Brave',
    excel: 'Microsoft Excel', winword: 'Microsoft Word', powerpnt: 'Microsoft PowerPoint', outlook: 'Microsoft Outlook',
    teams: 'Microsoft Teams', 'ms-teams': 'Microsoft Teams', slack: 'Slack', zoom: 'Zoom', spotify: 'Spotify',
    code: 'Visual Studio Code', figma: 'Figma', notion: 'Notion', obsidian: 'Obsidian', explorer: 'File Explorer',
    powershell: 'PowerShell', pwsh: 'PowerShell', cmd: 'Command Prompt', windowsterminal: 'Windows Terminal',
  };
  if (knownNames[applicationId]) return knownNames[applicationId];
  const cleaned = fallback.replace(/\.exe$/i, '').trim();
  return cleaned ? `${cleaned[0].toUpperCase()}${cleaned.slice(1)}` : 'Other';
}

function localDayId(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDay(dayId: string) {
  const [year, month, day] = dayId.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function relativeDayLabel(date: Date, now: Date) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const difference = Math.round((today.getTime() - date.getTime()) / 86_400_000);
  if (difference === 0) return 'Today';
  if (difference === 1) return 'Yesterday';
  if (difference > 1 && difference < 7) return `${difference} days ago`;
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function formatDuration(seconds: number) {
  if (seconds <= 0) return '0m';
  const roundedMinutes = Math.round(seconds / 60);
  if (roundedMinutes < 1) return '<1m';
  if (roundedMinutes < 60) return `${roundedMinutes}m`;
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
}

function formatClock(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}
