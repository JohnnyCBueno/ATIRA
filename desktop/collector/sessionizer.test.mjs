import assert from 'node:assert/strict';
import test from 'node:test';
import { DesktopSessionizer } from './sessionizer.mjs';

const sample = (capturedAt, processName, state = 'active') => ({
  capturedAt,
  state,
  processName,
  processId: processName === 'Code' ? 101 : 202,
  idleSeconds: state === 'idle' ? 360 : 1,
  windowTitle: null,
});

test('continuous samples become one foreground observation', () => {
  const sessionizer = new DesktopSessionizer();
  assert.equal(sessionizer.push(sample('2026-07-21T09:00:00.000Z', 'Code')), null);
  assert.equal(sessionizer.push(sample('2026-07-21T09:00:05.000Z', 'Code')), null);
  const observation = sessionizer.push(sample('2026-07-21T09:00:10.000Z', 'chrome'));
  assert.equal(observation.payload.application, 'Code');
  assert.equal(observation.payload.durationSeconds, 10);
  assert.equal(observation.payload.sampleCount, 2);
  assert.equal(observation.payload.windowTitleCaptured, false);
});

test('idle and locked time are separate privacy-safe sessions', () => {
  const sessionizer = new DesktopSessionizer();
  sessionizer.push(sample('2026-07-21T10:00:00.000Z', 'Code'));
  const active = sessionizer.push(sample('2026-07-21T10:05:00.000Z', null, 'idle'));
  const idle = sessionizer.push(sample('2026-07-21T10:10:00.000Z', null, 'locked'));
  assert.equal(active.payload.activityState, 'active');
  assert.equal(idle.payload.activityState, 'idle');
  assert.equal(idle.payload.application, null);
});

test('flush closes the current session and clears it', () => {
  const sessionizer = new DesktopSessionizer();
  sessionizer.push(sample('2026-07-21T11:00:00.000Z', 'Code'));
  const observation = sessionizer.flush('2026-07-21T11:01:00.000Z');
  assert.equal(observation.payload.durationSeconds, 60);
  assert.equal(sessionizer.snapshot(), null);
});

test('observation ids are namespaced by device', () => {
  const first = new DesktopSessionizer({ observationNamespace: 'device-one' });
  const second = new DesktopSessionizer({ observationNamespace: 'device-two' });
  first.push(sample('2026-07-21T12:00:00.000Z', 'Code'));
  second.push(sample('2026-07-21T12:00:00.000Z', 'Code'));
  assert.notEqual(first.flush('2026-07-21T12:01:00.000Z').id, second.flush('2026-07-21T12:01:00.000Z').id);
});
