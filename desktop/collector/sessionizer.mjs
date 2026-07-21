import { createHash } from 'node:crypto';

export class DesktopSessionizer {
  #current = null;

  push(sample) {
    const normalized = normalizeSample(sample);
    if (!this.#current) {
      this.#current = startSession(normalized);
      return null;
    }
    if (sessionKey(normalized) === this.#current.key) {
      this.#current.lastSampleAt = normalized.capturedAt;
      this.#current.sampleCount += 1;
      this.#current.maximumIdleSeconds = Math.max(this.#current.maximumIdleSeconds, normalized.idleSeconds);
      return null;
    }
    const completed = toObservation(this.#current, normalized.capturedAt);
    this.#current = startSession(normalized);
    return completed;
  }

  flush(endedAt = new Date().toISOString()) {
    if (!this.#current) return null;
    const completed = toObservation(this.#current, endedAt);
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
  };
}

function sessionKey(sample) {
  return [sample.state, sample.application ?? '', sample.windowTitle ?? ''].join('|');
}

function toObservation(session, endedAtInput) {
  const endedAt = new Date(endedAtInput).toISOString();
  const digest = createHash('sha256').update(`${session.key}|${session.startedAt}`).digest('hex').slice(0, 20);
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
      windowTitle: session.windowTitle,
      windowTitleCaptured: session.windowTitle !== null,
      platform: 'windows',
    },
  };
}
