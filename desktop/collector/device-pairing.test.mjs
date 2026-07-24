import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DevicePairing } from './device-pairing.mjs';

test('pairs once, authenticates the issued token, and stores only its hash', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'atira-device-pairing-'));
  const filePath = path.join(directory, 'device-pairing.atira');
  const pairing = new DevicePairing({ filePath, encryptionKey: null });
  const { code } = pairing.createCode();
  const token = await pairing.pair(code, 'phone-1', 'Johnny’s iPhone');

  assert.equal(pairing.authenticates(token), true);
  assert.equal(pairing.authenticates('wrong-token'), false);
  assert.equal((await readFile(filePath, 'utf8')).includes(token), false);
  await assert.rejects(() => pairing.pair(code, 'phone-2'), /invalid or has expired/);
});

test('unpair revokes the device token', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'atira-device-pairing-'));
  const pairing = new DevicePairing({ filePath: path.join(directory, 'device-pairing.atira'), encryptionKey: null });
  const { code } = pairing.createCode();
  const token = await pairing.pair(code, 'phone-1');

  await pairing.unpair();

  assert.equal(pairing.authenticates(token), false);
  assert.deepEqual(pairing.status(), { paired: false, label: null, pairedAt: null, lastSyncedAt: null });
});

test('five wrong attempts revoke the pending pairing code', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'atira-device-pairing-'));
  const pairing = new DevicePairing({ filePath: path.join(directory, 'device-pairing.atira'), encryptionKey: null });
  const { code } = pairing.createCode();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await assert.rejects(() => pairing.pair('wrong-code', 'phone-1'), /invalid or has expired/);
  }

  await assert.rejects(() => pairing.pair(code, 'phone-1'), /invalid or has expired/);
});
