import { RawObservation } from '../data/contracts';
import { DayRecord, EventCategory, TimelineEvent } from '../domain/types';

export type DesktopActivityKind =
  | 'focused_work'
  | 'communication'
  | 'learning'
  | 'entertainment'
  | 'browser'
  | 'ai_assistance'
  | 'computer_activity'
  | 'idle'
  | 'locked';

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
  blocks: DesktopActivityBlock[];
  observedSeconds: number;
  focusedWorkSeconds: number;
  learningSeconds: number;
  coveragePercent: number;
  startedAt: string;
  endedAt: string;
}

interface ClassifiedSession {
  observationId: string;
  dayId: string;
  kind: DesktopActivityKind;
  title: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  application: string | null;
  confidence: number;
}

const focusedApplications = ['code', 'devenv', 'rider64', 'webstorm64', 'pycharm64', 'idea64', 'excel', 'winword', 'powerpnt', 'figma', 'photoshop', 'illustrator', 'blender', 'autocad', 'notion', 'obsidian'];
const communicationApplications = ['teams', 'ms-teams', 'slack', 'zoom', 'outlook', 'thunderbird', 'webex'];
const learningApplications = ['anki', 'kindle', 'duolingo'];
const entertainmentApplications = ['spotify', 'vlc', 'steam', 'epicgameslauncher'];
const browserApplications = ['chrome', 'msedge', 'firefox', 'brave', 'opera'];
const systemApplications = ['explorer', 'taskmgr', 'powershell', 'pwsh', 'cmd', 'windowsterminal'];

export function reconstructDesktopActivity(observations: RawObservation[]): DesktopDayReconstruction[] {
  const sessions = observations
    .filter((observation) => observation.source === 'desktop' && observation.kind === 'desktop_foreground')
    .map(classifyObservation)
    .filter((session): session is ClassifiedSession => session != null)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const sessionsByDay = new Map<string, ClassifiedSession[]>();
  for (const session of sessions) {
    const daySessions = sessionsByDay.get(session.dayId) ?? [];
    daySessions.push(session);
    sessionsByDay.set(session.dayId, daySessions);
  }
  return [...sessionsByDay.entries()].map(([dayId, daySessions]) => reconstructDay(dayId, daySessions));
}

export function desktopDayToRecord(result: DesktopDayReconstruction, existing?: DayRecord, now = new Date()): DayRecord {
  const correctedEvents = new Map((existing?.events ?? [])
    .filter((event) => ['confirmed', 'corrected'].includes(event.state))
    .map((event) => [event.id, event]));
  const events = result.blocks.map((block) => {
    const inferred = blockToEvent(block);
    const corrected = correctedEvents.get(inferred.id);
    return corrected ? { ...inferred, title: corrected.title, state: corrected.state, confidence: corrected.confidence } : inferred;
  });
  const date = parseLocalDay(result.dayId);
  return {
    id: result.dayId,
    weekday: date.toLocaleDateString([], { weekday: 'short' }),
    dayNumber: String(date.getDate()),
    month: date.toLocaleDateString([], { month: 'long' }),
    relativeLabel: relativeDayLabel(date, now),
    coverage: result.coveragePercent,
    understood: formatDuration(result.observedSeconds),
    work: formatDuration(result.focusedWorkSeconds),
    movement: '—',
    learning: formatDuration(result.learningSeconds),
    distance: '—',
    routePath: '',
    places: [],
    events,
  };
}

function reconstructDay(dayId: string, sessions: ClassifiedSession[]): DesktopDayReconstruction {
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
    blocks,
    observedSeconds,
    focusedWorkSeconds: blocks.filter((block) => ['focused_work', 'communication'].includes(block.kind)).reduce((total, block) => total + block.durationSeconds, 0),
    learningSeconds: blocks.filter((block) => block.kind === 'learning').reduce((total, block) => total + block.durationSeconds, 0),
    coveragePercent: spanSeconds > 0 ? Math.min(100, Math.round((observedSeconds / spanSeconds) * 100)) : 0,
    startedAt,
    endedAt,
  };
}

function classifyObservation(observation: RawObservation): ClassifiedSession | null {
  const startedAt = new Date(observation.startedAt);
  const endedAt = new Date(observation.endedAt ?? observation.capturedAt);
  if (!Number.isFinite(startedAt.getTime()) || !Number.isFinite(endedAt.getTime()) || endedAt <= startedAt) return null;
  const durationSeconds = Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));
  const state = String(observation.payload.activityState ?? 'active');
  const sampleCount = Number(observation.payload.sampleCount ?? 0);
  const application = typeof observation.payload.application === 'string' ? observation.payload.application : null;
  if (state === 'idle' && durationSeconds < 60) return null;
  if (state === 'locked' && durationSeconds < 30) return null;
  if (state === 'active' && (!application || (durationSeconds < 5 && sampleCount < 2))) return null;
  const classification = classifyApplication(application, state);
  return {
    observationId: observation.id,
    dayId: localDayId(startedAt),
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationSeconds,
    application,
    ...classification,
  };
}

function classifyApplication(application: string | null, state: string): Pick<ClassifiedSession, 'kind' | 'title' | 'confidence'> {
  if (state === 'locked') return { kind: 'locked', title: 'Computer locked', confidence: 0.98 };
  if (state === 'idle') return { kind: 'idle', title: 'Away from computer', confidence: 0.94 };
  const normalized = (application ?? '').toLowerCase().replace(/\.exe$/, '').replace(/[^a-z0-9-]/g, '');
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
    browser: 'digital', ai_assistance: 'digital', computer_activity: 'digital', idle: 'break', locked: 'break',
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
  if (block.kind === 'idle') return `The computer received no input for ${formatDuration(block.durationSeconds)}; this is treated as a possible break, not proof that you left.`;
  if (block.kind === 'locked') return `Windows reported a locked desktop for ${formatDuration(block.durationSeconds)}.`;
  return `${applications} stayed foreground across ${block.observationIds.length} session${block.observationIds.length === 1 ? '' : 's'}, supporting this ${block.title.toLowerCase()} inference.`;
}

function eventAlternatives(kind: DesktopActivityKind) {
  if (['idle', 'locked'].includes(kind)) return ['Short break', 'Meeting away from desk', 'Finished for the day'];
  if (kind === 'communication') return ['Meetings', 'Email and messages', 'Personal communication'];
  if (kind === 'focused_work') return ['Focused work', 'Administrative work', 'Learning'];
  if (kind === 'learning') return ['Study', 'Reading', 'Practice'];
  return ['Work', 'Learning', 'Entertainment', 'General computer use'];
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
