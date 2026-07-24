import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { decryptObservationLine, encryptObservationLine } from './encrypted-observation-store.mjs';

export class DevicePairing {
  constructor({ filePath, encryptionKey }) {
    this.filePath = filePath;
    this.encryptionKey = encryptionKey;
    this.state = null;
    this.pendingCode = null;
  }

  async load() {
    try {
      const value = await readFile(this.filePath, 'utf8');
      const decoded = this.encryptionKey
        ? decryptObservationLine(value.trim(), this.encryptionKey)
        : JSON.parse(value);
      this.state = normalizeState(decoded);
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error;
    }
  }

  createCode() {
    this.pendingCode = {
      value: String(randomInt(0, 1_000_000)).padStart(6, '0'),
      expiresAt: Date.now() + 5 * 60_000,
      attemptsRemaining: 5,
    };
    return { code: this.pendingCode.value, expiresAt: new Date(this.pendingCode.expiresAt).toISOString() };
  }

  async pair(code, clientId, label = 'ATIRA mobile device') {
    if (!this.pendingCode || Date.now() > this.pendingCode.expiresAt) {
      this.pendingCode = null;
      throw new Error('The pairing code is invalid or has expired.');
    }
    if (code !== this.pendingCode.value) {
      this.pendingCode.attemptsRemaining -= 1;
      if (this.pendingCode.attemptsRemaining <= 0) this.pendingCode = null;
      throw new Error('The pairing code is invalid or has expired.');
    }
    const token = randomBytes(32).toString('base64url');
    this.state = {
      version: 1,
      tokenHash: hash(token),
      clientId: String(clientId).slice(0, 128),
      label: String(label).slice(0, 80),
      pairedAt: new Date().toISOString(),
      lastSyncedAt: null,
    };
    this.pendingCode = null;
    await this.save();
    return token;
  }

  authenticates(token) {
    if (typeof token !== 'string' || !this.state?.tokenHash) return false;
    const supplied = Buffer.from(hash(token));
    const expected = Buffer.from(this.state.tokenHash);
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  }

  async markSynced(timestamp = new Date().toISOString()) {
    if (!this.state) return;
    this.state.lastSyncedAt = timestamp;
    await this.save();
  }

  async unpair() {
    this.pendingCode = null;
    this.state = null;
    await rm(this.filePath, { force: true });
  }

  status() {
    return {
      paired: Boolean(this.state),
      label: this.state?.label ?? null,
      pairedAt: this.state?.pairedAt ?? null,
      lastSyncedAt: this.state?.lastSyncedAt ?? null,
    };
  }

  async save() {
    if (!this.state) return;
    const contents = this.encryptionKey
      ? `${encryptObservationLine(this.state, this.encryptionKey)}\n`
      : `${JSON.stringify(this.state)}\n`;
    await writeFile(this.filePath, contents, { encoding: 'utf8', mode: 0o600 });
  }
}

function normalizeState(value) {
  return value?.version === 1 && value?.tokenHash
    ? {
        version: 1,
        tokenHash: String(value.tokenHash),
        clientId: String(value.clientId ?? ''),
        label: String(value.label ?? 'ATIRA mobile device'),
        pairedAt: String(value.pairedAt ?? new Date(0).toISOString()),
        lastSyncedAt: value.lastSyncedAt ? String(value.lastSyncedAt) : null,
      }
    : null;
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}
