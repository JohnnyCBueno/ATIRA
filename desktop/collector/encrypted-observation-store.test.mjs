import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { appendEncryptedObservation, decryptObservationLine, encryptObservationLine, loadEncryptedObservations, parseEncryptionKey, rewriteEncryptedObservations } from './encrypted-observation-store.mjs';

test('encrypted observation lines do not expose application names or timestamps', () => {
  const key = parseEncryptionKey('ab'.repeat(32));
  const observation = { id: 'one', startedAt: '2026-07-21T09:00:00.000Z', payload: { application: 'ChatGPT' } };
  const encrypted = encryptObservationLine(observation, key);
  assert.equal(encrypted.includes('ChatGPT'), false);
  assert.equal(encrypted.includes('2026-07-21'), false);
  assert.deepEqual(decryptObservationLine(encrypted, key), observation);
});

test('encrypted store appends, loads, and rewrites records', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'atira-encrypted-store-'));
  const filePath = path.join(directory, 'observations.atira');
  const key = parseEncryptionKey('cd'.repeat(32));
  await appendEncryptedObservation(filePath, { id: 'one', payload: { application: 'Code' } }, key);
  await appendEncryptedObservation(filePath, { id: 'two', payload: { application: 'Teams' } }, key);
  assert.deepEqual((await loadEncryptedObservations(filePath, key)).map((item) => item.id), ['one', 'two']);
  await rewriteEncryptedObservations(filePath, [{ id: 'two', payload: { application: 'Teams' } }], key);
  assert.deepEqual((await loadEncryptedObservations(filePath, key)).map((item) => item.id), ['two']);
  const raw = await readFile(filePath, 'utf8');
  assert.equal(raw.includes('Teams'), false);
});
