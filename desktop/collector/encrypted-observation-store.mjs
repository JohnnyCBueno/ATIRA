import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { appendFile, readFile, writeFile } from 'node:fs/promises';

const prefix = 'ATIRA1:';

export function parseEncryptionKey(value) {
  if (!value) return null;
  const key = Buffer.from(value, 'hex');
  if (key.length !== 32) throw new Error('ATIRA collector encryption key must contain 32 bytes.');
  return key;
}

export function encryptObservationLine(observation, key) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(observation), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${prefix}${Buffer.concat([nonce, tag, ciphertext]).toString('base64')}`;
}

export function decryptObservationLine(line, key) {
  if (!line.startsWith(prefix)) throw new Error('Observation record is not an ATIRA encrypted record.');
  const payload = Buffer.from(line.slice(prefix.length), 'base64');
  if (payload.length < 29) throw new Error('Encrypted observation record is incomplete.');
  const nonce = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));
}

export async function appendEncryptedObservation(filePath, observation, key) {
  await appendFile(filePath, `${encryptObservationLine(observation, key)}\n`, 'utf8');
}

export async function loadEncryptedObservations(filePath, key) {
  const contents = await readFile(filePath, 'utf8');
  const observations = [];
  for (const line of contents.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { observations.push(decryptObservationLine(line, key)); } catch { /* isolate a damaged record */ }
  }
  return observations;
}

export async function rewriteEncryptedObservations(filePath, observations, key) {
  const body = observations.map((observation) => encryptObservationLine(observation, key)).join('\n');
  await writeFile(filePath, body ? `${body}\n` : '', { encoding: 'utf8', mode: 0o600 });
}
