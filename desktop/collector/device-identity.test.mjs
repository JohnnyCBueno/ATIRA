import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadOrCreateDesktopIdentity } from './device-identity.mjs';

test('desktop identity is random, local, and stable across restarts', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'atira-identity-'));
  try {
    const clock = () => new Date('2026-07-21T12:00:00.000Z');
    const first = await loadOrCreateDesktopIdentity(directory, clock);
    const second = await loadOrCreateDesktopIdentity(directory, () => new Date('2027-01-01T00:00:00.000Z'));
    assert.deepEqual(second, first);
    assert.match(first.device.id, /^device-[0-9a-f-]{36}$/);
    assert.equal(first.collector.deviceId, first.device.id);
    assert.equal(first.device.label, 'Windows computer');
    const persisted = JSON.parse(await readFile(path.join(directory, 'identity.json'), 'utf8'));
    assert.deepEqual(persisted, first);
    assert.equal('macAddress' in persisted.device, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
