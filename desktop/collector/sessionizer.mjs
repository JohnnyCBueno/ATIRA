import { createHash } from 'node:crypto';

export class DesktopSessionizer {
  #current = null;
  #observationNamespace;

  constructor({ observationNamespace = 'unregistered-device' } = {}) {
    this.#observationNamespace = observationNamespace;
  }

  push(sample) {
    const normalized = normalizeSample(sample);
    if (!this.#current) {
      this.#current = startSession(normalized);
      return null;
    }
    accrueEngagement(this.#current, normalized);
    if (sessionKey(normalized) === this.#current.key) {
      this.#current.lastSampleAt = normalized.capturedAt;
      this.#current.sampleCount += 1;
      this.#current.maximumIdleSeconds = Math.max(this.#current.maximumIdleSeconds, normalized.idleSeconds);
      this.#current.lastEngagementState = engagementState(normalized);
      return null;
    }
    const completed = toObservation(this.#current, normalized.capturedAt, this.#observationNamespace);
    this.#current = startSession(normalized);
    return completed;
  }

  flush(endedAt = new Date().toISOString()) {
    if (!this.#current) return null;
    accrueEngagement(this.#current, {
      capturedAt: new Date(endedAt).toISOString(),
      state: this.#current.state,
      idleSeconds: this.#current.maximumIdleSeconds,
    });
    const completed = toObservation(this.#current, endedAt, this.#observationNamespace);
    this.#current = null;
    return completed;
  }

  snapshot() {
    if (!this.#current) return null;
    return {
      state: this.#current.state,
      application: this.#current.application,
      startedAt: this.#current.startedAt,
      lastSampleAt: this.#current.lastSampleAt,
      sampleCount: this.#current.sampleCount,
      engagementState: dominantEngagement(this.#current.engagementSeconds),
    };
  }
}

function normalizeSample(sample) {
  const capturedAt = new Date(sample?.capturedAt).toISOString();
  const state = ['active', 'idle', 'locked'].includes(sample?.state) ? sample.state : 'idle';
  return {
    capturedAt,
    state,
    application: state === 'active' && typeof sample?.processName === 'string' ? sample.processName : null,
    processId: state === 'active' && Number.isInteger(sample?.processId) ? sample.processId : null,
    idleSeconds: Number.isFinite(sample?.idleSeconds) ? Math.max(0, Math.round(sample.idleSeconds)) : 0,
    windowTitle: typeof sample?.windowTitle === 'string' && sample.windowTitle.length > 0 ? sample.windowTitle : null,
  };
}

function startSession(sample) {
  return {
    key: sessionKey(sample),
    state: sample.state,
    application: sample.application,
    processId: sample.processId,
    windowTitle: sample.windowTitle,
    startedAt: sample.capturedAt,
    lastSampleAt: sample.capturedAt,
    sampleCount: 1,
    maximumIdleSeconds: sample.idleSeconds,
    lastEngagementState: engagementState(sample),
    engagementSeconds: { interactive: 0, passive: 0, away: 0, locked: 0 },
  };
}

function engagementState(sample) {
  if (sample.state === 'locked') return 'locked';
  if (sample.state === 'idle') return 'away';
  return sample.idleSeconds < 15 ? 'interactive' : 'passive';
}

function accrueEngagement(session, nextSample) {
  const elapsedSeconds = Math.max(0, Math.round((Date.parse(nextSample.capturedAt) - Date.parse(session.lastSampleAt)) / 1000));
  if (elapsedSeconds === 0) return;
  let state = session.lastEngagementState;
  if (session.state === 'active') {
    if (nextSample.state === 'locked') state = 'locked';
    else if (Number.isFinite(nextSample.idleSeconds)) state = nextSample.idleSeconds < 15 ? 'interactive' : 'passive';
  }
  session.engagementSeconds[state] += elapsedSeconds;
}

function dominantEngagement(seconds) {
  return Object.entries(seconds).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'away';
}

function sessionKey(sample) {
  return [sample.state, sample.application ?? '', sample.windowTitle ?? ''].join('|');
}

function toObservation(session, endedAtInput, observationNamespace) {
  const endedAt = new Date(endedAtInput).toISOString();
  const digest = createHash('sha256').update(`${observationNamespace}|${session.key}|${session.startedAt}`).digest('hex').slice(0, 20);
  const durationSeconds = Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(session.startedAt)) / 1000));
  return {
    id: `desktop-${digest}`,
    source: 'desktop',
    kind: 'desktop_foreground',
    startedAt: session.startedAt,
    endedAt,
    capturedAt: endedAt,
    quality: session.sampleCount > 1 ? 0.96 : 0.72,
    payload: {
      application: session.application,
      activityState: session.state,
      processId: session.processId,
      durationSeconds,
      sampleCount: session.sampleCount,
      maximumIdleSeconds: session.maximumIdleSeconds,
      engagementState: dominantEngagement(session.engagementSeconds),
      interactiveSeconds: session.engagementSeconds.interactive,
      passiveSeconds: session.engagementSeconds.passive,
      awaySeconds: session.engagementSeconds.away,
      lockedSeconds: session.engagementSeconds.locked,
      windowTitle: session.windowTitle,
      windowTitleCaptured: session.windowTitle !== null,
      platform: 'windows',
    },
  };
}
