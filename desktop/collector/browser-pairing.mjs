import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { decryptObservationLine, encryptObservationLine } from './encrypted-observation-store.mjs';

export class BrowserPairing {
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
    };
    return { code: this.pendingCode.value, expiresAt: new Date(this.pendingCode.expiresAt).toISOString() };
  }

  async pair(code, extensionInstallId, browser = 'chrome') {
    if (!this.pendingCode || Date.now() > this.pendingCode.expiresAt || code !== this.pendingCode.value) {
      throw new Error('The pairing code is invalid or has expired.');
    }
    const token = randomBytes(32).toString('base64url');
    const client = {
      tokenHash: hash(token),
      extensionInstallId: String(extensionInstallId).slice(0, 128),
      browser: normalizeBrowser(browser),
      pairedAt: new Date().toISOString(),
      lastObservedAt: null,
    };
    const clients = (this.state?.clients ?? []).filter((item) => item.extensionInstallId !== client.extensionInstallId);
    this.state = { version: 2, clients: [...clients, client].slice(-12) };
    this.pendingCode = null;
    await this.save();
    return token;
  }

  authenticates(token) {
    return Boolean(this.clientForToken(token));
  }

  clientForToken(token) {
    if (typeof token !== 'string') return null;
    const supplied = Buffer.from(hash(token));
    return (this.state?.clients ?? []).find((client) => {
      const expected = Buffer.from(client.tokenHash);
      return supplied.length === expected.length && timingSafeEqual(supplied, expected);
    }) ?? null;
  }

  async markObserved(timestamp, token) {
    const client = this.clientForToken(token);
    if (!client) return;
    client.lastObservedAt = timestamp;
    await this.save();
  }

  async unpair() {
    this.pendingCode = null;
    this.state = null;
    await rm(this.filePath, { force: true });
  }

  status() {
    const clients = this.state?.clients ?? [];
    const pairedDates = clients.map((client) => client.pairedAt).filter(Boolean).sort();
    const observedDates = clients.map((client) => client.lastObservedAt).filter(Boolean).sort();
    return {
      paired: clients.length > 0,
      pairedAt: pairedDates[0] ?? null,
      lastObservedAt: observedDates.at(-1) ?? null,
      connectedBrowserCount: clients.length,
      browsers: clients.map((client) => ({ browser: client.browser, pairedAt: client.pairedAt, lastObservedAt: client.lastObservedAt })),
      privacy: {
        activeDomainOnly: true,
        paths: false,
        pageTitles: false,
        pageContents: false,
        searches: false,
        keystrokes: false,
        incognito: false,
      },
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
  if (Array.isArray(value?.clients)) return { version: 2, clients: value.clients.map((client) => ({ ...client, browser: value.version === 2 ? normalizeBrowser(client.browser) : normalizeBrowser(client.browser === 'other' ? 'chrome' : client.browser) })).filter((client) => client.tokenHash) };
  if (value?.tokenHash) return { version: 2, clients: [{ ...value, browser: normalizeBrowser(value.browser ?? 'chrome') }] };
  return null;
}

function normalizeBrowser(value) {
  const browser = String(value ?? '').toLowerCase();
  return ['chrome', 'edge', 'brave', 'opera', 'firefox', 'safari'].includes(browser) ? browser : 'other';
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}
